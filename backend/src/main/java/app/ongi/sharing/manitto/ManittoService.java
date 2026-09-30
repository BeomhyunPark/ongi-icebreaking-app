package app.ongi.sharing.manitto;

import static app.ongi.sharing.manitto.ManittoDtos.*;
import static org.springframework.http.HttpStatus.*;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import app.ongi.sharing.common.ApiException;
import app.ongi.sharing.session.SessionTokenService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ManittoService {
    private final JdbcTemplate db;
    private final SessionTokenService tokens;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public ManittoService(JdbcTemplate db, SessionTokenService tokens, Clock clock) {
        this.db = db;
        this.tokens = tokens;
        this.clock = clock;
    }

    @Transactional
    public Session create(Create input) {
        String alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 12; i++) code.append(alphabet.charAt(random.nextInt(alphabet.length())));
        Instant expiry = clock.instant().plus(Duration.ofDays(30));
        db.update("INSERT INTO manitto_rooms(code, title, expires_at) VALUES (?, ?, ?)",
            code.toString(), input.title().strip(), Timestamp.from(expiry));
        String token = tokens.createToken();
        db.update("INSERT INTO manitto_members(id, room_code, name, host, participating, token_hash) VALUES (?, ?, ?, true, ?, ?)",
            UUID.randomUUID(), code.toString(), input.name().strip(), input.participating(), tokens.hash(token));
        return new Session(state(code.toString(), token), token);
    }

    @Transactional
    public Session join(String code, String existingToken, Join input) {
        Room room = room(code);
        if (existingToken != null && !membersForToken(code, existingToken).isEmpty()) {
            return new Session(snapshot(room, member(code, existingToken)), existingToken);
        }
        if (room.assigned()) fail("ASSIGNED", "이미 배정된 모임에는 새로 참가할 수 없어요.");
        if (participants(code).size() >= 100) fail("FULL", "최대 100명까지 참가할 수 있어요.");
        String name = input.name().strip();
        if (db.queryForObject("SELECT count(*) FROM manitto_members WHERE room_code = ? AND name = ?", Integer.class, code, name) > 0)
            fail("NAME_TAKEN", "같은 이름이 있어요. 구분할 수 있는 이름을 입력해주세요.");
        String token = tokens.createToken();
        db.update("INSERT INTO manitto_members(id, room_code, name, host, participating, token_hash) VALUES (?, ?, ?, false, true, ?)",
            UUID.randomUUID(), code, name, tokens.hash(token));
        return new Session(snapshot(room, member(code, token)), token);
    }

    // The room lock serializes joins, assignment, mission edits and completion changes.
    // A snapshot is read under the same lock so the dashboard never mixes two states.
    @Transactional
    public State state(String code, String token) {
        return snapshot(room(code), member(code, token));
    }

    @Transactional
    public State assign(String code, String token) {
        Room room = room(code);
        host(code, token);
        if (!room.assigned()) {
            List<Member> members = new ArrayList<>(participants(code));
            if (members.size() < 2) fail("TOO_FEW", "참가자가 2명 이상이어야 배정할 수 있어요.");
            Collections.shuffle(members, random);
            // One shuffled cycle guarantees no self assignment and exactly one giver per recipient.
            for (int i = 0; i < members.size(); i++) {
                db.update("UPDATE manitto_members SET recipient_id = ? WHERE id = ?",
                    members.get((i + 1) % members.size()).id(), members.get(i).id());
            }
            db.update("UPDATE manitto_rooms SET assigned = true WHERE code = ?", code);
        }
        return snapshot(room(code), member(code, token));
    }

    @Transactional
    public State addMission(String code, String token, MissionInput input) {
        Room room = room(code);
        Member host = host(code, token);
        if (!room.assigned()) fail("NOT_ASSIGNED", "마니또를 배정한 뒤 미션을 등록해주세요.");
        // Client-generated ID makes a retry after a lost response safe.
        List<String> existing = db.query("SELECT content FROM manitto_missions WHERE room_code = ? AND id = ?",
            (rs, row) -> rs.getString(1), code, input.id());
        if (!existing.isEmpty()) {
            if (!existing.getFirst().equals(input.content().strip())) fail("MISSION_CONFLICT", "이미 등록된 미션이에요.");
            return snapshot(room, host);
        }
        if (db.queryForObject("SELECT count(*) FROM manitto_missions WHERE room_code = ?", Integer.class, code) >= 50)
            fail("MISSION_LIMIT", "미션은 최대 50개까지 등록할 수 있어요.");
        db.update("INSERT INTO manitto_missions(id, room_code, content, created_at) VALUES (?, ?, ?, ?)",
            input.id(), code, input.content().strip(), Timestamp.from(clock.instant()));
        return snapshot(room, host);
    }

    @Transactional
    public State complete(String code, String token, UUID missionId, boolean completed) {
        Room room = room(code);
        Member me = member(code, token);
        if (!me.participating()) throw new ApiException(FORBIDDEN, "PARTICIPANT_REQUIRED", "참가자만 완료 표시를 할 수 있어요.");
        if (!room.assigned()) fail("NOT_ASSIGNED", "아직 마니또가 배정되지 않았어요.");
        if (db.queryForObject("SELECT count(*) FROM manitto_missions WHERE room_code = ? AND id = ?", Integer.class, code, missionId) == 0)
            throw new ApiException(NOT_FOUND, "MISSION_NOT_FOUND", "미션을 찾을 수 없어요.");
        if (completed) db.update("INSERT INTO manitto_completions(room_code, mission_id, member_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", code, missionId, me.id());
        else db.update("DELETE FROM manitto_completions WHERE mission_id = ? AND member_id = ?", missionId, me.id());
        return snapshot(room, me);
    }

    @Transactional
    public void close(String code, String token) {
        room(code);
        host(code, token);
        db.update("DELETE FROM manitto_rooms WHERE code = ?", code);
    }

    @Scheduled(fixedDelay = 3_600_000)
    public void removeExpired() {
        db.update("DELETE FROM manitto_rooms WHERE expires_at <= ?", Timestamp.from(clock.instant()));
    }

    private Room room(String code) {
        List<Room> rooms = db.query("SELECT * FROM manitto_rooms WHERE code = ? AND expires_at > ? FOR UPDATE",
            (rs, row) -> new Room(rs.getString("code"), rs.getString("title"), rs.getBoolean("assigned"), rs.getTimestamp("expires_at").toInstant()),
            code, Timestamp.from(clock.instant()));
        if (rooms.isEmpty()) throw new ApiException(NOT_FOUND, "ROOM_NOT_FOUND", "종료되었거나 만료된 모임이에요. 초대 코드를 확인해주세요.");
        return rooms.getFirst();
    }

    private List<Member> membersForToken(String code, String token) {
        if (token == null) return List.of();
        return db.query("SELECT * FROM manitto_members WHERE room_code = ? AND token_hash = ?",
            (rs, row) -> new Member(rs.getObject("id", UUID.class), rs.getString("name"), rs.getBoolean("host"),
                rs.getBoolean("participating"), rs.getObject("recipient_id", UUID.class)), code, tokens.hash(token));
    }
    private Member member(String code, String token) {
        List<Member> members = membersForToken(code, token);
        if (members.isEmpty()) throw new ApiException(UNAUTHORIZED, "SESSION_REQUIRED", "참가한 브라우저로 열어주세요. 처음이라면 이름을 입력해 참가해주세요.");
        return members.getFirst();
    }
    private Member host(String code, String token) {
        Member member = member(code, token);
        if (!member.host()) throw new ApiException(FORBIDDEN, "HOST_REQUIRED", "진행자만 할 수 있어요.");
        return member;
    }
    private List<Member> participants(String code) {
        return db.query("SELECT * FROM manitto_members WHERE room_code = ? AND participating = true ORDER BY name, id",
            (rs, row) -> new Member(rs.getObject("id", UUID.class), rs.getString("name"), rs.getBoolean("host"),
                true, rs.getObject("recipient_id", UUID.class)), code);
    }
    private State snapshot(Room room, Member me) {
        String recipient = me.recipientId() == null ? null : db.queryForObject(
            "SELECT name FROM manitto_members WHERE room_code = ? AND id = ?", String.class, room.code(), me.recipientId());
        List<Mission> missions = db.query("""
            SELECT m.*, EXISTS(SELECT 1 FROM manitto_completions c WHERE c.mission_id = m.id AND c.member_id = ?) AS completed
            FROM manitto_missions m WHERE m.room_code = ? ORDER BY m.created_at, m.id
            """, (rs, row) -> new Mission(rs.getObject("id", UUID.class), rs.getString("content"),
                rs.getTimestamp("created_at").toInstant(), rs.getBoolean("completed")), me.id(), room.code());
        List<Member> participants = participants(room.code());
        Map<UUID, List<UUID>> completions = new HashMap<>();
        if (me.host()) db.query("SELECT member_id, mission_id FROM manitto_completions WHERE room_code = ?", rs -> {
            completions.computeIfAbsent(rs.getObject("member_id", UUID.class), ignored -> new ArrayList<>())
                .add(rs.getObject("mission_id", UUID.class));
        }, room.code());
        List<Progress> dashboard = me.host() ? participants.stream().map(p -> new Progress(p.id(), p.name(),
            completions.getOrDefault(p.id(), List.of()))).toList() : List.of();
        return new State(room.code(), room.title(), room.assigned(), room.expiresAt(),
            new Me(me.id(), me.name(), me.host(), me.participating(), recipient), participants.size(), missions, dashboard);
    }
    private static void fail(String code, String message) { throw new ApiException(CONFLICT, code, message); }
    private record Room(String code, String title, boolean assigned, Instant expiresAt) {}
    private record Member(UUID id, String name, boolean host, boolean participating, UUID recipientId) {}
}
