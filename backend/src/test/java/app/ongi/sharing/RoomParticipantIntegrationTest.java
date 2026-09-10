package app.ongi.sharing;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class RoomParticipantIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbcTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @AfterEach
    void cleanRooms() {
        jdbcTemplate.update("DELETE FROM rooms");
    }

    @Test
    void createsRoomWithUniqueRandomCodeAndHostSession() throws Exception {
        Set<String> codes = new HashSet<>();

        for (int index = 0; index < 20; index++) {
            MvcResult result = createRoom("청년부 " + index);
            String code = jsonValue(result, "roomCode");
            codes.add(code);
            org.assertj.core.api.Assertions.assertThat(code).matches("[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}");
            org.assertj.core.api.Assertions.assertThat(result.getResponse().getCookie("ongi_host_session")).isNotNull();
        }

        org.assertj.core.api.Assertions.assertThat(codes).hasSize(20);
    }

    @Test
    void participantJoinsAndRecoversSession() throws Exception {
        MvcResult room = createRoom("화요 소그룹");
        String code = jsonValue(room, "roomCode");

        MvcResult joined = join(code, "홍길동")
            .andExpect(status().isOk())
            .andExpect(cookie().exists("ongi_participant_session"))
            .andExpect(jsonPath("$.participant.name", is("홍길동")))
            .andExpect(jsonPath("$.status", is("WRITING")))
            .andReturn();

        String roomId = jsonValue(joined, "roomId");
        Cookie participantCookie = joined.getResponse().getCookie("ongi_participant_session");

        mockMvc.perform(get("/api/rooms/{roomId}/participants/me", roomId).cookie(participantCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name", is("홍길동")))
            .andExpect(jsonPath("$.responseCompleted", is(false)));

        mockMvc.perform(get("/api/rooms/{roomId}/state", roomId).cookie(participantCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.roomCode").doesNotExist());
    }

    @Test
    void participantCannotCompleteWithOnlyBlankAnswers() throws Exception {
        MvcResult room = createRoom("빈 답변 방지 모임");
        String roomId = jsonValue(room, "roomId");
        MvcResult joined = join(jsonValue(room, "roomCode"), "참여자")
            .andExpect(status().isOk())
            .andReturn();
        Cookie participantCookie = joined.getResponse().getCookie("ongi_participant_session");
        String questionId = objectMapper.readTree(mockMvc.perform(get("/api/rooms/{roomId}/questions", roomId)
                .cookie(participantCookie))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString()).path("questions").get(0).path("id").asText();

        saveAnswer(roomId, participantCookie, questionId, "   ");

        mockMvc.perform(post("/api/rooms/{roomId}/responses/complete", roomId)
                .cookie(participantCookie)
                .header("X-OnGi-Client", "web"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code", is("ANSWER_REQUIRED")));
    }

    @Test
    void hostLocksRoomAndNewJoinIsRejectedWithoutLeakingStatus() throws Exception {
        MvcResult room = createRoom("닫힌 모임");
        String code = jsonValue(room, "roomCode");
        String roomId = jsonValue(room, "roomId");
        Cookie hostCookie = room.getResponse().getCookie("ongi_host_session");
        MvcResult participant = join(code, "기존 참여자").andReturn();
        Cookie participantCookie = participant.getResponse().getCookie("ongi_participant_session");

        MvcResult locked = mockMvc.perform(post("/api/rooms/{roomId}/lock", roomId)
                .cookie(hostCookie)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":1}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("LOCKED")))
            .andReturn();

        join(code, "새 참여자")
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code", is("ROOM_NOT_JOINABLE")));

        mockMvc.perform(get("/api/rooms/{roomId}/state", roomId).cookie(participantCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("LOCKED")));

        long lockedVersion = objectMapper.readTree(locked.getResponse().getContentAsString()).path("version").asLong();
        mockMvc.perform(post("/api/rooms/{roomId}/unlock", roomId)
                .cookie(hostCookie)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + lockedVersion + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("WRITING")));

        join(code, "새 참여자")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.participant.name", is("새 참여자")));
    }

    @Test
    void expiredRoomRejectsNewParticipantJoin() throws Exception {
        MvcResult room = createRoom("만료된 모임");
        String code = jsonValue(room, "roomCode");
        String roomId = jsonValue(room, "roomId");
        jdbcTemplate.update(
            "UPDATE rooms SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE public_id = ?::uuid",
            roomId
        );

        join(code, "늦은 참여자")
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code", is("ROOM_NOT_JOINABLE")));
    }

    @Test
    void participantCannotAccessAnotherRoomOrHostEndpoints() throws Exception {
        MvcResult roomA = createRoom("A 모임");
        MvcResult roomB = createRoom("B 모임");
        MvcResult participantA = join(jsonValue(roomA, "roomCode"), "A 참여자").andReturn();
        Cookie participantCookie = participantA.getResponse().getCookie("ongi_participant_session");

        mockMvc.perform(get("/api/rooms/{roomId}/state", jsonValue(roomB, "roomId"))
                .cookie(participantCookie))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code", is("ROOM_SESSION_REQUIRED")));

        mockMvc.perform(get("/api/rooms/{roomId}/participants", jsonValue(roomA, "roomId"))
                .cookie(participantCookie))
            .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/rooms/{roomId}/unlock", jsonValue(roomA, "roomId"))
                .cookie(participantCookie)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":1}"))
            .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/rooms/{roomId}/cancel", jsonValue(roomA, "roomId"))
                .cookie(participantCookie)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":1}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void hostSeesOnlyParticipantProgressNotAnswers() throws Exception {
        MvcResult room = createRoom("현황 모임");
        join(jsonValue(room, "roomCode"), "첫째").andReturn();
        join(jsonValue(room, "roomCode"), "둘째").andReturn();

        mockMvc.perform(get("/api/rooms/{roomId}/participants", jsonValue(room, "roomId"))
                .cookie(room.getResponse().getCookie("ongi_host_session")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.participants", hasSize(2)))
            .andExpect(jsonPath("$.participants[0].name", is("첫째")))
            .andExpect(jsonPath("$.participants[0].responseCompleted", is(false)))
            .andExpect(jsonPath("$.participants[0].answer").doesNotExist());
    }

    @Test
    void hostCanJoinAsParticipantWithoutLosingHostAuthority() throws Exception {
        MvcResult room = createRoom("진행자 참여 모임");
        String roomId = jsonValue(room, "roomId");
        String code = jsonValue(room, "roomCode");
        Cookie hostCookie = room.getResponse().getCookie("ongi_host_session");
        MvcResult hostJoined = join(code, "진행자").andExpect(status().isOk()).andReturn();
        Cookie hostParticipantCookie = hostJoined.getResponse().getCookie("ongi_participant_session");
        MvcResult otherJoined = join(code, "참여자").andExpect(status().isOk()).andReturn();
        Cookie otherParticipantCookie = otherJoined.getResponse().getCookie("ongi_participant_session");

        String questionId = objectMapper.readTree(mockMvc.perform(get("/api/rooms/{roomId}/questions", roomId)
                .cookie(hostParticipantCookie))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString()).path("questions").get(0).path("id").asText();
        saveAnswer(roomId, hostParticipantCookie, questionId, "진행자도 함께 나누는 답변");
        saveAnswer(roomId, otherParticipantCookie, questionId, "참여자의 답변");
        completeAnswers(roomId, hostParticipantCookie);
        completeAnswers(roomId, otherParticipantCookie);

        MvcResult state = mockMvc.perform(get("/api/rooms/{roomId}/state", roomId)
                .cookie(hostCookie, hostParticipantCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role", is("HOST")))
            .andExpect(jsonPath("$.participantJoined", is(true)))
            .andExpect(jsonPath("$.responseCompleted", is(true)))
            .andExpect(jsonPath("$.participantCount", is(2)))
            .andReturn();

        mockMvc.perform(get("/api/rooms/{roomId}/participants/me", roomId)
                .cookie(hostCookie, hostParticipantCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name", is("진행자")));

        long version = objectMapper.readTree(state.getResponse().getContentAsString()).path("version").asLong();
        MvcResult locked = mockMvc.perform(post("/api/rooms/{roomId}/lock", roomId)
                .cookie(hostCookie, hostParticipantCookie)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + version + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role", is("HOST")))
            .andExpect(jsonPath("$.participantJoined", is(true)))
            .andReturn();

        long lockedVersion = objectMapper.readTree(locked.getResponse().getContentAsString()).path("version").asLong();
        mockMvc.perform(post("/api/rooms/{roomId}/start-sharing", roomId)
                .cookie(hostCookie, hostParticipantCookie)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + lockedVersion + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total", is(2)));
    }

    @Test
    void hostCanCancelRoomBeforeSharingAndPersonalDataIsDeleted() throws Exception {
        MvcResult room = createRoom("실수로 만든 모임");
        String roomId = jsonValue(room, "roomId");
        String code = jsonValue(room, "roomCode");
        Cookie hostCookie = room.getResponse().getCookie("ongi_host_session");
        MvcResult joined = join(code, "참여자").andExpect(status().isOk()).andReturn();
        Cookie participantCookie = joined.getResponse().getCookie("ongi_participant_session");
        String questionId = objectMapper.readTree(mockMvc.perform(get("/api/rooms/{roomId}/questions", roomId)
                .cookie(participantCookie))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString()).path("questions").get(0).path("id").asText();
        saveAnswer(roomId, participantCookie, questionId, "삭제될 작성 중 답변");

        MvcResult state = mockMvc.perform(get("/api/rooms/{roomId}/state", roomId).cookie(hostCookie))
            .andExpect(status().isOk())
            .andReturn();
        long version = objectMapper.readTree(state.getResponse().getContentAsString()).path("version").asLong();

        MvcResult cancelled = mockMvc.perform(post("/api/rooms/{roomId}/cancel", roomId)
                .cookie(hostCookie)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + version + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.cancelled", is(true)))
            .andReturn();

        org.assertj.core.api.Assertions.assertThat(cancelled.getResponse().getHeaders("Set-Cookie"))
            .hasSize(2)
            .allMatch(header -> header.contains("Max-Age=0"));
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM rooms", Integer.class)).isZero();
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM participants", Integer.class)).isZero();
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM responses", Integer.class)).isZero();
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM room_sessions", Integer.class)).isZero();

        mockMvc.perform(get("/api/rooms/{roomId}/state", roomId).cookie(participantCookie))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void completesAnonymousSharingFlowWithoutIdentityLeakAndDeletesPersonalData() throws Exception {
        MvcResult room = createRoom("익명 나눔");
        String roomId = jsonValue(room, "roomId");
        String code = jsonValue(room, "roomCode");
        Cookie host = room.getResponse().getCookie("ongi_host_session");
        MvcResult joinedOne = join(code, "은혜").andExpect(status().isOk()).andReturn();
        MvcResult joinedTwo = join(code, "사랑").andExpect(status().isOk()).andReturn();
        Cookie one = joinedOne.getResponse().getCookie("ongi_participant_session");
        Cookie two = joinedTwo.getResponse().getCookie("ongi_participant_session");

        String questionId = objectMapper.readTree(mockMvc.perform(get("/api/rooms/{roomId}/questions", roomId).cookie(one))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString()).path("questions").get(0).path("id").asText();

        saveAnswer(roomId, one, questionId, "저는 요즘 산책을 좋아해요.");
        saveAnswer(roomId, two, questionId, "저는 요즘 기타를 배우고 있어요.");
        completeAnswers(roomId, one);
        completeAnswers(roomId, two);

        MvcResult locked = mockMvc.perform(post("/api/rooms/{roomId}/lock", roomId)
                .cookie(host)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":1}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.completedParticipantCount", is(2)))
            .andReturn();

        mockMvc.perform(post("/api/rooms/{roomId}/responses/reopen", roomId)
                .cookie(one).header("X-OnGi-Client", "web"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.completed", is(false)));
        mockMvc.perform(get("/api/rooms/{roomId}/state", roomId).cookie(host))
            .andExpect(jsonPath("$.completedParticipantCount", is(1)));
        mockMvc.perform(post("/api/rooms/{roomId}/start-sharing", roomId)
                .cookie(host).header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + objectMapper.readTree(locked.getResponse().getContentAsString()).path("version").asLong() + "}"))
            .andExpect(status().isConflict());
        saveAnswer(roomId, one, questionId, "수정한 답변");
        completeAnswers(roomId, one);

        long lockedVersion = objectMapper.readTree(locked.getResponse().getContentAsString()).path("version").asLong();
        MvcResult started = mockMvc.perform(post("/api/rooms/{roomId}/start-sharing", roomId)
                .cookie(host)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + lockedVersion + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.state", is("ANONYMOUS")))
            .andExpect(jsonPath("$.participantName").doesNotExist())
            .andReturn();

        mockMvc.perform(post("/api/rooms/{roomId}/responses/reopen", roomId)
                .cookie(one).header("X-OnGi-Client", "web"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code", is("RESPONSES_NOT_WRITABLE")));

        String anonymousJson = started.getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(anonymousJson)
            .doesNotContain("participantId", "participantName", "sessionToken", "hostToken", "은혜", "사랑");

        Cookie author = canReveal(roomId, one) ? one : two;
        Cookie other = author == one ? two : one;
        mockMvc.perform(post("/api/rooms/{roomId}/sharing/reveal", roomId)
                .cookie(other)
                .header("X-OnGi-Client", "web"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code", is("NOT_CURRENT_AUTHOR")));

        MvcResult revealed = mockMvc.perform(post("/api/rooms/{roomId}/sharing/reveal", roomId)
                .cookie(author)
                .header("X-OnGi-Client", "web"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.state", is("REVEALED")))
            .andExpect(jsonPath("$.participantName").isNotEmpty())
            .andReturn();

        JsonNode revealedJson = objectMapper.readTree(revealed.getResponse().getContentAsString());
        long version = revealedJson.path("roomVersion").asLong();
        MvcResult next = next(roomId, host, version, 0)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.state", is("ANONYMOUS")))
            .andReturn();

        next(roomId, host, version, 0)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code", is("STATE_CHANGED")));

        Cookie secondAuthor = canReveal(roomId, one) ? one : two;
        MvcResult secondReveal = mockMvc.perform(post("/api/rooms/{roomId}/sharing/reveal", roomId)
                .cookie(secondAuthor)
                .header("X-OnGi-Client", "web"))
            .andExpect(status().isOk())
            .andReturn();
        long secondVersion = objectMapper.readTree(secondReveal.getResponse().getContentAsString()).path("roomVersion").asLong();
        MvcResult finished = next(roomId, host, secondVersion, 1)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.state", is("FINISHED")))
            .andReturn();
        long finishedVersion = objectMapper.readTree(finished.getResponse().getContentAsString()).path("roomVersion").asLong();

        mockMvc.perform(post("/api/rooms/{roomId}/complete", roomId)
                .cookie(host)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + finishedVersion + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("COMPLETED")));

        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM participants", Integer.class)).isZero();
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM responses", Integer.class)).isZero();
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM sharing_rounds", Integer.class)).isZero();

        mockMvc.perform(get("/api/rooms/{roomId}/state", roomId).cookie(one))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("COMPLETED")));

        join(code, "늦은 참여자")
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code", is("ROOM_NOT_JOINABLE")));
    }

    @Test
    void participantCanLeaveWhileLockedAndRemoveAnswersSessionsAndCounts() throws Exception {
        MvcResult room = createRoom("나가기 검증");
        String roomId = jsonValue(room, "roomId");
        String code = jsonValue(room, "roomCode");
        Cookie host = room.getResponse().getCookie("ongi_host_session");
        MvcResult joined = join(code, "나갈 사람").andExpect(status().isOk()).andReturn();
        Cookie person = joined.getResponse().getCookie("ongi_participant_session");
        Cookie other = join(code, "남을 사람").andExpect(status().isOk()).andReturn().getResponse().getCookie("ongi_participant_session");
        String participantId = objectMapper.readTree(joined.getResponse().getContentAsString()).path("participant").path("id").asText();
        String questionId = objectMapper.readTree(mockMvc.perform(get("/api/rooms/{roomId}/questions", roomId).cookie(person))
            .andReturn().getResponse().getContentAsString()).path("questions").get(0).path("id").asText();
        saveAnswer(roomId, person, questionId, "삭제할 답변");
        completeAnswers(roomId, person);
        saveAnswer(roomId, other, questionId, "유지할 답변");
        jdbcTemplate.update("UPDATE rooms SET status = 'LOCKED' WHERE public_id = ?", UUID.fromString(roomId));
        mockMvc.perform(post("/api/rooms/{roomId}/leave", roomId).cookie(host).header("X-OnGi-Client", "web"))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/rooms/{roomId}/leave", roomId).header("X-OnGi-Client", "web"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/rooms/{roomId}/leave", roomId).cookie(person).header("X-OnGi-Client", "web"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.left", is(true)))
            .andExpect(cookie().maxAge("ongi_participant_session", 0));
        mockMvc.perform(get("/api/rooms/{roomId}/state", roomId).cookie(person)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/rooms/{roomId}/state", roomId).cookie(host))
            .andExpect(jsonPath("$.participantCount", is(1))).andExpect(jsonPath("$.completedParticipantCount", is(0)));
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM responses WHERE participant_id = ?", Integer.class, UUID.fromString(participantId))).isZero();
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM room_sessions WHERE participant_id = ?", Integer.class, UUID.fromString(participantId))).isZero();
        mockMvc.perform(get("/api/rooms/{roomId}/responses/me", roomId).cookie(other))
            .andExpect(status().isOk()).andExpect(jsonPath("$.answers[0].answer", is("유지할 답변")));
        jdbcTemplate.update("UPDATE rooms SET status = 'WRITING' WHERE public_id = ?", UUID.fromString(roomId));
        Cookie rejoined = join(code, "나갈 사람").andExpect(status().isOk()).andReturn().getResponse().getCookie("ongi_participant_session");
        jdbcTemplate.update("UPDATE rooms SET status = 'SHARING' WHERE public_id = ?", UUID.fromString(roomId));
        mockMvc.perform(post("/api/rooms/{roomId}/leave", roomId).cookie(rejoined).header("X-OnGi-Client", "web"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code", is("ROOM_NOT_LEAVABLE")));
    }

    private void saveAnswer(String roomId, Cookie cookie, String questionId, String answer) throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/rooms/{roomId}/responses", roomId)
                .cookie(cookie)
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"answers\":[{\"questionId\":\"" + questionId + "\",\"answer\":\"" + answer + "\"}]}"))
            .andExpect(status().isOk());
    }

    private void completeAnswers(String roomId, Cookie cookie) throws Exception {
        mockMvc.perform(post("/api/rooms/{roomId}/responses/complete", roomId)
                .cookie(cookie)
                .header("X-OnGi-Client", "web"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.completed", is(true)));
    }

    private boolean canReveal(String roomId, Cookie cookie) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/rooms/{roomId}/sharing/current", roomId).cookie(cookie))
            .andExpect(status().isOk())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("canReveal").asBoolean();
    }

    private org.springframework.test.web.servlet.ResultActions next(String roomId, Cookie host, long version, int round) throws Exception {
        return mockMvc.perform(post("/api/rooms/{roomId}/next", roomId)
            .cookie(host)
            .header("X-OnGi-Client", "web")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"expectedVersion\":" + version + ",\"expectedRound\":" + round + "}"));
    }

    private MvcResult createRoom(String title) throws Exception {
        return mockMvc.perform(post("/api/rooms")
                .header("X-OnGi-Client", "web")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"" + title + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("CREATED")))
            .andReturn();
    }

    private org.springframework.test.web.servlet.ResultActions join(String code, String name) throws Exception {
        return mockMvc.perform(post("/api/room-joins")
            .header("X-OnGi-Client", "web")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"roomCode\":\"" + code + "\",\"name\":\"" + name + "\"}"));
    }

    private String jsonValue(MvcResult result, String field) throws Exception {
        return objectMapper
            .readTree(result.getResponse().getContentAsString())
            .get(field)
            .asText();
    }
}
