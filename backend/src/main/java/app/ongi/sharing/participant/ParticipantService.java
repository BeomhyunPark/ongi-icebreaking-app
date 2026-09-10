package app.ongi.sharing.participant;

import static app.ongi.sharing.participant.ParticipantDtos.JoinRoomResponse;
import static app.ongi.sharing.participant.ParticipantDtos.ParticipantListResponse;
import static app.ongi.sharing.participant.ParticipantDtos.ParticipantMe;
import static app.ongi.sharing.participant.ParticipantDtos.ParticipantStatus;

import java.text.Normalizer;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import app.ongi.sharing.common.ApiException;
import app.ongi.sharing.config.OngiProperties;
import app.ongi.sharing.room.Room;
import app.ongi.sharing.room.RoomCodeGenerator;
import app.ongi.sharing.room.RoomRepository;
import app.ongi.sharing.room.RoomStatus;
import app.ongi.sharing.realtime.RoomEventPublisher;
import app.ongi.sharing.realtime.RoomEventType;
import app.ongi.sharing.session.RoomAccess;
import app.ongi.sharing.session.RoomSession;
import app.ongi.sharing.session.RoomSessionRepository;
import app.ongi.sharing.session.SessionRole;
import app.ongi.sharing.session.SessionTokenService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParticipantService {

    private final RoomRepository roomRepository;
    private final ParticipantRepository participantRepository;
    private final RoomSessionRepository sessionRepository;
    private final SessionTokenService tokenService;
    private final OngiProperties properties;
    private final Clock clock;
    private final RoomEventPublisher eventPublisher;

    public ParticipantService(RoomRepository roomRepository, ParticipantRepository participantRepository, RoomSessionRepository sessionRepository, SessionTokenService tokenService, OngiProperties properties, Clock clock, RoomEventPublisher eventPublisher) {
        this.roomRepository = roomRepository;
        this.participantRepository = participantRepository;
        this.sessionRepository = sessionRepository;
        this.tokenService = tokenService;
        this.properties = properties;
        this.clock = clock;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public JoinedParticipant join(String requestedCode, String requestedName) {
        Instant now = clock.instant();
        String code = RoomCodeGenerator.normalize(requestedCode);
        Room room = roomRepository.findByCodeForUpdate(code).orElseThrow(this::notJoinable);
        if (room.isExpired(now) || (room.getStatus() != RoomStatus.CREATED && room.getStatus() != RoomStatus.WRITING)) {
            throw notJoinable();
        }
        if (participantRepository.countByRoomId(room.getId()) >= properties.room().maximumParticipants()) {
            throw notJoinable();
        }
        String name = requestedName.strip().replaceAll("\\s+", " ");
        if (name.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NAME_REQUIRED", "이름을 입력해주세요.");
        }
        String normalizedName = Normalizer.normalize(name, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
        Participant participant;
        try {
            participant = participantRepository.saveAndFlush(new Participant(UUID.randomUUID(), room, name, normalizedName, now));
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "NAME_ALREADY_USED", "이미 사용 중인 이름이에요.");
        }
        room.markWriting();
        String rawToken = tokenService.createToken();
        sessionRepository.save(new RoomSession(
            UUID.randomUUID(), room, SessionRole.PARTICIPANT, participant,
            tokenService.hash(rawToken), now, room.getExpiresAt()
        ));
        roomRepository.flush();
        eventPublisher.publishAfterCommit(room.getPublicId(), RoomEventType.PARTICIPANT_JOINED, room.getVersion());
        JoinRoomResponse response = new JoinRoomResponse(
            room.getPublicId(), room.getTitle(), room.getStatus(), toMe(participant), room.getExpiresAt()
        );
        return new JoinedParticipant(response, rawToken);
    }

    @Transactional
    public void leave(RoomAccess access) {
        Room room = roomRepository.findByIdForUpdate(access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ROOM_SESSION_REQUIRED", "이 모임에 다시 참여해주세요."));
        if (access.role() == SessionRole.HOST) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HOST_CANNOT_LEAVE", "진행자는 진행자 화면에서 모임을 관리해주세요.");
        }
        if (room.getStatus() != RoomStatus.CREATED && room.getStatus() != RoomStatus.WRITING && room.getStatus() != RoomStatus.LOCKED) {
            throw new ApiException(HttpStatus.CONFLICT, "ROOM_NOT_LEAVABLE", "나눔이 이미 시작되어 지금은 모임에서 나갈 수 없어요.");
        }
        if (access.participantId() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "PARTICIPANT_SESSION_REQUIRED", "참여자 정보가 없어요.");
        }
        Participant participant = participantRepository.findByIdAndRoomId(access.participantId(), access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "PARTICIPANT_SESSION_REQUIRED", "참여자 정보가 없어요."));
        sessionRepository.deleteAllByRoomIdAndParticipantId(room.getId(), participant.getId());
        // Foreign keys remove this participant's answers in the same transaction.
        participantRepository.delete(participant);
        participantRepository.flush();
        eventPublisher.publishAfterCommit(room.getPublicId(), RoomEventType.PARTICIPANT_PROGRESS_CHANGED, room.getVersion());
    }

    @Transactional(readOnly = true)
    public ParticipantMe me(RoomAccess access) {
        if (access.participantId() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "PARTICIPANT_SESSION_REQUIRED", "참여자 정보가 없어요.");
        }
        Participant participant = participantRepository.findByIdAndRoomId(access.participantId(), access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "PARTICIPANT_SESSION_REQUIRED", "참여자 정보가 없어요."));
        return toMe(participant);
    }

    @Transactional(readOnly = true)
    public ParticipantListResponse list(RoomAccess access) {
        if (access.role() != SessionRole.HOST) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HOST_REQUIRED", "진행자만 참여 현황을 볼 수 있어요.");
        }
        return new ParticipantListResponse(participantRepository.findAllByRoomIdOrderByJoinedAt(access.roomId())
            .stream()
            .map(participant -> new ParticipantStatus(participant.getName(), participant.isResponseCompleted(), participant.getJoinedAt()))
            .toList());
    }

    private ParticipantMe toMe(Participant participant) {
        return new ParticipantMe(participant.getId(), participant.getName(), participant.isResponseCompleted());
    }

    private ApiException notJoinable() {
        return new ApiException(HttpStatus.NOT_FOUND, "ROOM_NOT_JOINABLE", "코드를 확인하거나 진행자에게 문의해주세요.");
    }

    public record JoinedParticipant(JoinRoomResponse response, String rawToken) {}
}
