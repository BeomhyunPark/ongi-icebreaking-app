package app.ongi.sharing.room;

import app.ongi.sharing.common.StateTransitionException;
import app.ongi.sharing.common.StateTransitionException.Reason;

import static app.ongi.sharing.room.RoomDtos.CreateRoomResponse;
import static app.ongi.sharing.room.RoomDtos.RoomStateResponse;
import static app.ongi.sharing.room.RoomDtos.CancelRoomResponse;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

import app.ongi.sharing.common.ApiException;
import app.ongi.sharing.config.OngiProperties;
import app.ongi.sharing.participant.ParticipantRepository;
import app.ongi.sharing.question.QuestionSet;
import app.ongi.sharing.question.QuestionSetRepository;
import app.ongi.sharing.session.RoomAccess;
import app.ongi.sharing.session.RoomSession;
import app.ongi.sharing.session.RoomSessionRepository;
import app.ongi.sharing.session.SessionRole;
import app.ongi.sharing.session.SessionTokenService;
import app.ongi.sharing.sharing.SharingRoundRepository;
import app.ongi.sharing.realtime.RoomEventPublisher;
import app.ongi.sharing.realtime.RoomEventType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomService {

    private static final String DEFAULT_QUESTION_SET = "anonymous-introduction-v1";

    private final RoomRepository roomRepository;
    private final QuestionSetRepository questionSetRepository;
    private final ParticipantRepository participantRepository;
    private final RoomSessionRepository sessionRepository;
    private final RoomCodeGenerator codeGenerator;
    private final SessionTokenService tokenService;
    private final OngiProperties properties;
    private final Clock clock;
    private final SharingRoundRepository sharingRoundRepository;
    private final RoomEventPublisher eventPublisher;

    public RoomService(RoomRepository roomRepository, QuestionSetRepository questionSetRepository, ParticipantRepository participantRepository, RoomSessionRepository sessionRepository, RoomCodeGenerator codeGenerator, SessionTokenService tokenService, OngiProperties properties, Clock clock, SharingRoundRepository sharingRoundRepository, RoomEventPublisher eventPublisher) {
        this.roomRepository = roomRepository;
        this.questionSetRepository = questionSetRepository;
        this.participantRepository = participantRepository;
        this.sessionRepository = sessionRepository;
        this.codeGenerator = codeGenerator;
        this.tokenService = tokenService;
        this.properties = properties;
        this.clock = clock;
        this.sharingRoundRepository = sharingRoundRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public CreatedRoom create(String requestedTitle) {
        Instant now = clock.instant();
        QuestionSet questionSet = questionSetRepository.findBySlugAndActiveTrue(DEFAULT_QUESTION_SET)
            .orElseThrow(() -> new IllegalStateException("Default question set is missing"));
        String code = uniqueCode();
        String title = requestedTitle == null || requestedTitle.isBlank() ? "우리 모임" : requestedTitle.strip();
        Room room = roomRepository.save(new Room(
            UUID.randomUUID(), UUID.randomUUID(), code, title, questionSet, now,
            now.plus(properties.room().activeLifetime())
        ));
        String rawToken = tokenService.createToken();
        sessionRepository.save(new RoomSession(
            UUID.randomUUID(), room, SessionRole.HOST, null, tokenService.hash(rawToken), now, room.getExpiresAt()
        ));
        return new CreatedRoom(
            new CreateRoomResponse(room.getPublicId(), RoomCodeGenerator.display(code), title, room.getStatus(), room.getVersion(), room.getExpiresAt()),
            rawToken
        );
    }

    @Transactional(readOnly = true)
    public RoomStateResponse state(RoomAccess access) {
        Room room = roomRepository.findById(access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ROOM_SESSION_REQUIRED", "이 모임에 다시 참여해주세요."));
        long participantCount = participantRepository.countByRoomId(room.getId());
        long completedCount = participantRepository.countByRoomIdAndResponseCompletedTrue(room.getId());
        boolean selfCompleted = access.participantId() != null && participantRepository
            .findByIdAndRoomId(access.participantId(), room.getId())
            .map(participant -> participant.isResponseCompleted())
            .orElse(false);
        return new RoomStateResponse(
            room.getPublicId(), access.role() == SessionRole.HOST ? RoomCodeGenerator.display(room.getCode()) : null,
            room.getTitle(), room.getStatus(), access.role(), room.getVersion(),
            Math.toIntExact(participantCount), Math.toIntExact(completedCount), access.participantId() != null, selfCompleted,
            room.getCurrentRound(), Math.toIntExact(sharingRoundRepository.countByRoomId(room.getId())), room.getExpiresAt()
        );
    }

    @Transactional
    public RoomStateResponse lock(RoomAccess access, long expectedVersion) {
        if (access.role() != SessionRole.HOST) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HOST_REQUIRED", "진행자만 모임을 잠글 수 있어요.");
        }
        Room room = roomRepository.findByIdForUpdate(access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ROOM_SESSION_REQUIRED", "이 모임에 다시 참여해주세요."));
        try {
            room.lock(expectedVersion);
        } catch (StateTransitionException exception) {
            if (exception.reason() == Reason.ROOM_VERSION_MISMATCH) {
                throw new ApiException(HttpStatus.CONFLICT, "STATE_CHANGED", "모임 상태가 변경되었습니다. 다시 확인해주세요.");
            }
            throw new ApiException(HttpStatus.CONFLICT, "ROOM_NOT_LOCKABLE", "지금은 모임 입장을 마감할 수 없어요.");
        }
        roomRepository.flush();
        eventPublisher.publishAfterCommit(room.getPublicId(), RoomEventType.ROOM_ACCESS_CHANGED, room.getVersion());
        return state(access);
    }

    @Transactional
    public RoomStateResponse unlock(RoomAccess access, long expectedVersion) {
        if (access.role() != SessionRole.HOST) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HOST_REQUIRED", "진행자만 참여자 입장을 다시 열 수 있어요.");
        }
        Room room = roomRepository.findByIdForUpdate(access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ROOM_SESSION_REQUIRED", "이 모임에 다시 참여해주세요."));
        try {
            room.unlock(expectedVersion);
        } catch (StateTransitionException exception) {
            if (exception.reason() == Reason.ROOM_VERSION_MISMATCH) {
                throw new ApiException(HttpStatus.CONFLICT, "STATE_CHANGED", "모임 상태가 변경되었습니다. 다시 확인해주세요.");
            }
            throw new ApiException(HttpStatus.CONFLICT, "ROOM_NOT_UNLOCKABLE", "지금은 참여자 입장을 다시 열 수 없어요.");
        }
        roomRepository.flush();
        eventPublisher.publishAfterCommit(room.getPublicId(), RoomEventType.ROOM_ACCESS_CHANGED, room.getVersion());
        return state(access);
    }

    @Transactional
    public CancelRoomResponse cancel(RoomAccess access, long expectedVersion) {
        if (access.role() != SessionRole.HOST) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HOST_REQUIRED", "진행자만 방을 없앨 수 있어요.");
        }
        Room room = roomRepository.findByIdForUpdate(access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ROOM_SESSION_REQUIRED", "이 모임에 다시 참여해주세요."));
        try {
            room.requireCancellable(expectedVersion);
        } catch (StateTransitionException exception) {
            if (exception.reason() == Reason.ROOM_VERSION_MISMATCH) {
                throw new ApiException(HttpStatus.CONFLICT, "STATE_CHANGED", "모임 상태가 변경되었습니다. 다시 확인해주세요.");
            }
            throw new ApiException(HttpStatus.CONFLICT, "ROOM_NOT_CANCELLABLE", "나눔이 시작된 뒤에는 방을 없앨 수 없어요.");
        }
        UUID publicRoomId = room.getPublicId();
        long version = room.getVersion();
        roomRepository.delete(room);
        roomRepository.flush();
        eventPublisher.publishAfterCommit(publicRoomId, RoomEventType.ROOM_CANCELLED, version);
        return new CancelRoomResponse(true);
    }

    private String uniqueCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            String code = codeGenerator.generate();
            if (!roomRepository.existsByCode(code)) {
                return code;
            }
        }
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ROOM_CODE_UNAVAILABLE", "모임 코드를 만들지 못했어요. 다시 시도해주세요.");
    }

    public record CreatedRoom(CreateRoomResponse response, String rawToken) {}
}
