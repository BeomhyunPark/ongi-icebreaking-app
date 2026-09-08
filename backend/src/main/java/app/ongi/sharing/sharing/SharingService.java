package app.ongi.sharing.sharing;

import app.ongi.sharing.common.StateTransitionException;
import app.ongi.sharing.common.StateTransitionException.Reason;

import static app.ongi.sharing.sharing.SharingDtos.CurrentSharingResponse;
import static app.ongi.sharing.sharing.SharingDtos.PublicSharingState;
import static app.ongi.sharing.sharing.SharingDtos.SharedAnswer;
import static app.ongi.sharing.sharing.SharingDtos.CompletedRoomResponse;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import app.ongi.sharing.common.ApiException;
import app.ongi.sharing.config.OngiProperties;
import app.ongi.sharing.participant.Participant;
import app.ongi.sharing.participant.ParticipantRepository;
import app.ongi.sharing.response.ParticipantResponseRepository;
import app.ongi.sharing.realtime.RoomEventPublisher;
import app.ongi.sharing.realtime.RoomEventType;
import app.ongi.sharing.room.Room;
import app.ongi.sharing.room.RoomRepository;
import app.ongi.sharing.room.RoomStatus;
import app.ongi.sharing.session.RoomAccess;
import app.ongi.sharing.session.SessionRole;
import app.ongi.sharing.session.RoomSessionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SharingService {

    private final RoomRepository roomRepository;
    private final ParticipantRepository participantRepository;
    private final ParticipantResponseRepository responseRepository;
    private final SharingRoundRepository roundRepository;
    private final OngiProperties properties;
    private final Clock clock;
    private final RoomEventPublisher eventPublisher;
    private final RoomSessionRepository sessionRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public SharingService(RoomRepository roomRepository, ParticipantRepository participantRepository, ParticipantResponseRepository responseRepository, SharingRoundRepository roundRepository, OngiProperties properties, Clock clock, RoomEventPublisher eventPublisher, RoomSessionRepository sessionRepository) {
        this.roomRepository = roomRepository;
        this.participantRepository = participantRepository;
        this.responseRepository = responseRepository;
        this.roundRepository = roundRepository;
        this.properties = properties;
        this.clock = clock;
        this.eventPublisher = eventPublisher;
        this.sessionRepository = sessionRepository;
    }

    @Transactional
    public CurrentSharingResponse start(RoomAccess access, long expectedVersion) {
        requireHost(access);
        Room room = lockRoom(access.roomId());
        List<Participant> participants = new ArrayList<>(participantRepository.findAllByRoomIdOrderByJoinedAt(room.getId()));
        if (participants.size() < properties.room().minimumParticipants()
            || participants.stream().anyMatch(participant -> !participant.isResponseCompleted())) {
            throw new ApiException(HttpStatus.CONFLICT, "PARTICIPANTS_NOT_READY", "모든 참여자가 작성을 완료해야 나눔을 시작할 수 있어요.");
        }
        if (roundRepository.countByRoomId(room.getId()) != 0) {
            throw conflict("SHARING_ALREADY_STARTED", "나눔 순서가 이미 만들어졌어요.");
        }
        try {
            room.startSharing(expectedVersion);
        } catch (StateTransitionException exception) {
            throw stateConflict(exception);
        }
        Collections.shuffle(participants, secureRandom);
        Instant now = clock.instant();
        for (int sequence = 0; sequence < participants.size(); sequence++) {
            roundRepository.save(new SharingRound(UUID.randomUUID(), room, participants.get(sequence), sequence, now));
        }
        roundRepository.flush();
        roomRepository.flush();
        eventPublisher.publishAfterCommit(room.getPublicId(), RoomEventType.SHARING_STARTED, room.getVersion());
        return currentFor(room, access);
    }

    @Transactional(readOnly = true)
    public CurrentSharingResponse current(RoomAccess access) {
        Room room = roomRepository.findById(access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ROOM_SESSION_REQUIRED", "이 모임에 다시 참여해주세요."));
        if (room.getStatus() != RoomStatus.SHARING) {
            throw conflict("SHARING_NOT_ACTIVE", "아직 나눔이 시작되지 않았어요.");
        }
        return currentFor(room, access);
    }

    @Transactional
    public CurrentSharingResponse reveal(RoomAccess access) {
        if (access.role() != SessionRole.PARTICIPANT || access.participantId() == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PARTICIPANT_REQUIRED", "현재 이야기의 작성자만 자신을 공개할 수 있어요.");
        }
        Room room = lockRoom(access.roomId());
        if (room.getStatus() != RoomStatus.SHARING) {
            throw conflict("SHARING_NOT_ACTIVE", "아직 나눔이 시작되지 않았어요.");
        }
        int changed = roundRepository.revealIfAnonymous(room.getId(), room.getCurrentRound(), access.participantId(), clock.instant());
        if (changed != 1) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_CURRENT_AUTHOR", "현재 이야기의 작성자만 자신을 공개할 수 있어요.");
        }
        eventPublisher.publishAfterCommit(room.getPublicId(), RoomEventType.PROFILE_REVEALED, room.getVersion());
        return currentFor(room, access);
    }

    @Transactional
    public CurrentSharingResponse next(RoomAccess access, long expectedVersion, int expectedRound) {
        requireHost(access);
        Room room = lockRoom(access.roomId());
        long total = roundRepository.countByRoomId(room.getId());
        SharingRound round = roundRepository.findByRoomIdAndSequence(room.getId(), room.getCurrentRound())
            .orElseThrow(() -> conflict("ROUND_NOT_FOUND", "현재 이야기를 찾을 수 없어요."));
        try {
            if (room.getCurrentRound() != expectedRound) {
                throw new StateTransitionException(Reason.ROUND_CHANGED);
            }
            round.complete(clock.instant());
            room.advanceRound(expectedVersion, expectedRound, Math.toIntExact(total));
        } catch (StateTransitionException exception) {
            throw stateConflict(exception);
        }
        roomRepository.flush();
        eventPublisher.publishAfterCommit(room.getPublicId(), RoomEventType.ROUND_CHANGED, room.getVersion());
        return currentFor(room, access);
    }

    @Transactional
    public CompletedRoomResponse complete(RoomAccess access, long expectedVersion) {
        requireHost(access);
        Room room = lockRoom(access.roomId());
        int total = Math.toIntExact(roundRepository.countByRoomId(room.getId()));
        Instant now = clock.instant();
        try {
            room.complete(now, expectedVersion, total);
        } catch (StateTransitionException exception) {
            throw stateConflict(exception);
        }
        roomRepository.flush();
        sessionRepository.detachParticipantsAndExpireAt(
            room.getId(), now.plus(properties.session().tombstoneRetention())
        );
        participantRepository.deleteAllByRoomId(room.getId());
        eventPublisher.publishAfterCommit(room.getPublicId(), RoomEventType.ROOM_COMPLETED, room.getVersion());
        return new CompletedRoomResponse(room.getStatus(), room.getCompletedAt(), room.getVersion());
    }

    private CurrentSharingResponse currentFor(Room room, RoomAccess access) {
        int total = Math.toIntExact(roundRepository.countByRoomId(room.getId()));
        if (room.getCurrentRound() >= total) {
            return new CurrentSharingResponse(PublicSharingState.FINISHED, null, total, List.of(), null, false, room.getVersion());
        }
        SharingRound round = roundRepository.findByRoomIdAndSequence(room.getId(), room.getCurrentRound())
            .orElseThrow(() -> conflict("ROUND_NOT_FOUND", "현재 이야기를 찾을 수 없어요."));
        List<SharedAnswer> answers = responseRepository
            .findAllByRoomIdAndParticipantIdOrderByQuestionPosition(room.getId(), round.getParticipant().getId())
            .stream()
            .map(response -> new SharedAnswer(response.getQuestion().getPrompt(), response.getAnswer()))
            .toList();
        boolean revealed = round.getStatus() == SharingStatus.REVEALED;
        boolean canReveal = !revealed && access.participantId() != null
            && access.participantId().equals(round.getParticipant().getId());
        return new CurrentSharingResponse(
            revealed ? PublicSharingState.REVEALED : PublicSharingState.ANONYMOUS,
            round.getSequence(), total, answers,
            revealed ? round.getParticipant().getName() : null,
            canReveal,
            room.getVersion()
        );
    }

    private Room lockRoom(UUID roomId) {
        return roomRepository.findByIdForUpdate(roomId)
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ROOM_SESSION_REQUIRED", "이 모임에 다시 참여해주세요."));
    }

    private void requireHost(RoomAccess access) {
        if (access.role() != SessionRole.HOST) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HOST_REQUIRED", "진행자만 나눔을 진행할 수 있어요.");
        }
    }

    private ApiException stateConflict(StateTransitionException exception) {
        return switch (exception.reason()) {
            case ROOM_VERSION_MISMATCH, ROUND_CHANGED -> conflict("STATE_CHANGED", "모임 상태가 변경되었습니다. 다시 확인해주세요.");
            case ROUND_NOT_REVEALED -> conflict("ROUND_NOT_REVEALED", "작성자가 자신을 공개한 뒤 다음 이야기로 넘어갈 수 있어요.");
            case SHARING_NOT_FINISHED -> conflict("SHARING_NOT_FINISHED", "모든 이야기를 마친 뒤 모임을 종료할 수 있어요.");
            default -> conflict("INVALID_STATE_TRANSITION", "지금은 요청한 동작을 실행할 수 없어요.");
        };
    }

    private ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }
}
