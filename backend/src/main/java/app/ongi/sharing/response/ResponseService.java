package app.ongi.sharing.response;

import static app.ongi.sharing.response.ResponseDtos.MyResponsesResponse;
import static app.ongi.sharing.response.ResponseDtos.QuestionItem;
import static app.ongi.sharing.response.ResponseDtos.QuestionListResponse;
import static app.ongi.sharing.response.ResponseDtos.SavedAnswer;

import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import app.ongi.sharing.common.ApiException;
import app.ongi.sharing.participant.Participant;
import app.ongi.sharing.participant.ParticipantRepository;
import app.ongi.sharing.question.Question;
import app.ongi.sharing.question.QuestionRepository;
import app.ongi.sharing.room.Room;
import app.ongi.sharing.room.RoomRepository;
import app.ongi.sharing.room.RoomStatus;
import app.ongi.sharing.realtime.RoomEventPublisher;
import app.ongi.sharing.realtime.RoomEventType;
import app.ongi.sharing.session.RoomAccess;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ResponseService {

    private final RoomRepository roomRepository;
    private final ParticipantRepository participantRepository;
    private final QuestionRepository questionRepository;
    private final ParticipantResponseRepository responseRepository;
    private final Clock clock;
    private final RoomEventPublisher eventPublisher;

    public ResponseService(RoomRepository roomRepository, ParticipantRepository participantRepository, QuestionRepository questionRepository, ParticipantResponseRepository responseRepository, Clock clock, RoomEventPublisher eventPublisher) {
        this.roomRepository = roomRepository;
        this.participantRepository = participantRepository;
        this.questionRepository = questionRepository;
        this.responseRepository = responseRepository;
        this.clock = clock;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public QuestionListResponse questions(RoomAccess access) {
        Room room = requireRoom(access);
        List<QuestionItem> questions = questionRepository.findAllByQuestionSetIdOrderByPosition(room.getQuestionSet().getId())
            .stream()
            .map(question -> new QuestionItem(question.getId(), question.getPosition(), question.getPrompt(), question.getHelperText()))
            .toList();
        return new QuestionListResponse(questions);
    }

    @Transactional(readOnly = true)
    public MyResponsesResponse mine(RoomAccess access) {
        Participant participant = requireParticipant(access);
        return toResponse(participant, responseRepository.findAllByRoomIdAndParticipantIdOrderByQuestionPosition(access.roomId(), participant.getId()));
    }

    @Transactional
    public MyResponsesResponse save(RoomAccess access, List<ResponseDtos.AnswerInput> inputs) {
        Room room = requireRoom(access);
        Participant participant = requireParticipant(access);
        requireWritable(room, participant);
        if (inputs.size() != new HashSet<>(inputs.stream().map(ResponseDtos.AnswerInput::questionId).toList()).size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_QUESTION", "같은 질문의 답변이 중복되어 있어요.");
        }
        Map<UUID, Question> questions = questionRepository.findAllByQuestionSetIdOrderByPosition(room.getQuestionSet().getId())
            .stream()
            .collect(Collectors.toMap(Question::getId, Function.identity()));
        Instant now = clock.instant();

        for (ResponseDtos.AnswerInput input : inputs) {
            Question question = questions.get(input.questionId());
            if (question == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "QUESTION_NOT_IN_ROOM", "이 모임에서 사용할 수 없는 질문이에요.");
            }
            String answer = input.answer() == null ? "" : input.answer().strip();
            ParticipantResponse existing = responseRepository
                .findByRoomIdAndParticipantIdAndQuestionId(room.getId(), participant.getId(), question.getId())
                .orElse(null);
            if (answer.isBlank()) {
                if (existing != null) {
                    responseRepository.delete(existing);
                }
            } else if (existing == null) {
                responseRepository.save(new ParticipantResponse(UUID.randomUUID(), room, participant, question, answer, now));
            } else {
                existing.updateAnswer(answer, now);
            }
        }
        responseRepository.flush();
        return toResponse(participant, responseRepository.findAllByRoomIdAndParticipantIdOrderByQuestionPosition(room.getId(), participant.getId()));
    }

    @Transactional
    public MyResponsesResponse complete(RoomAccess access) {
        Room room = requireRoom(access);
        Participant participant = requireParticipant(access);
        if (participant.isResponseCompleted()) {
            return mine(access);
        }
        requireWritable(room, participant);
        if (responseRepository.countByRoomIdAndParticipantId(room.getId(), participant.getId()) == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "ANSWER_REQUIRED", "공유할 답변을 하나 이상 작성해주세요.");
        }
        participant.completeResponses();
        eventPublisher.publishAfterCommit(room.getPublicId(), RoomEventType.PARTICIPANT_PROGRESS_CHANGED, room.getVersion());
        return mine(access);
    }

    @Transactional
    public MyResponsesResponse reopen(RoomAccess access) {
        Room room = roomRepository.findByIdForUpdate(access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ROOM_SESSION_REQUIRED", "이 모임에 다시 참여해주세요."));
        if (room.getStatus() != RoomStatus.WRITING && room.getStatus() != RoomStatus.LOCKED) {
            throw new ApiException(HttpStatus.CONFLICT, "RESPONSES_NOT_WRITABLE", "나눔이 시작되어 답변을 수정할 수 없어요.");
        }
        Participant participant = requireParticipant(access);
        participant.reopenResponses();
        eventPublisher.publishAfterCommit(room.getPublicId(), RoomEventType.PARTICIPANT_PROGRESS_CHANGED, room.getVersion());
        return mine(access);
    }

    private Room requireRoom(RoomAccess access) {
        return roomRepository.findById(access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ROOM_SESSION_REQUIRED", "이 모임에 다시 참여해주세요."));
    }

    private Participant requireParticipant(RoomAccess access) {
        if (access.participantId() == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PARTICIPANT_REQUIRED", "참여자만 답변을 작성할 수 있어요.");
        }
        return participantRepository.findByIdAndRoomId(access.participantId(), access.roomId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "PARTICIPANT_SESSION_REQUIRED", "참여자 정보가 없어요."));
    }

    private void requireWritable(Room room, Participant participant) {
        if (participant.isResponseCompleted()) {
            throw new ApiException(HttpStatus.CONFLICT, "RESPONSES_ALREADY_COMPLETED", "작성 완료 후에는 답변을 수정할 수 없어요.");
        }
        if (room.getStatus() != RoomStatus.WRITING && room.getStatus() != RoomStatus.LOCKED) {
            throw new ApiException(HttpStatus.CONFLICT, "RESPONSES_NOT_WRITABLE", "지금은 답변을 수정할 수 없어요.");
        }
    }

    private MyResponsesResponse toResponse(Participant participant, List<ParticipantResponse> responses) {
        return new MyResponsesResponse(
            responses.stream().map(response -> new SavedAnswer(response.getQuestion().getId(), response.getAnswer())).toList(),
            participant.isResponseCompleted()
        );
    }
}
