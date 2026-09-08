import { PrimaryButton } from '../../../components/PrimaryButton';
import type { AnonymousSharingController } from '../hooks/useAnonymousSharingController';
import type { RoomState, Question } from '../domain/types';

export function SharingWritingScreen({
  roomState,
  questions,
  answers,
  questionIndex,
  busy,
  moveQuestion,
  finishAnswers,
  returnToHostLobby,
  editAnswer,
  currentQuestion,
  hasWrittenAnswer,
}: Pick<
  AnonymousSharingController,
  | 'questions'
  | 'answers'
  | 'questionIndex'
  | 'busy'
  | 'moveQuestion'
  | 'finishAnswers'
  | 'returnToHostLobby'
  | 'editAnswer'
  | 'hasWrittenAnswer'
> & { roomState: RoomState; currentQuestion: Question }) {
  return (
    <section className="anonymous-sharing-writing">
      {roomState.role === 'HOST' ? (
        <button
          className="anonymous-sharing-host-back"
          type="button"
          disabled={busy}
          onClick={returnToHostLobby}
        >
          ← 진행자 화면으로
        </button>
      ) : null}
      <div className="anonymous-sharing-step">
        <span>
          {questionIndex + 1} / {questions.length}
        </span>
        <i style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
      </div>
      <p className="eyebrow">나를 소개하는 질문</p>
      <h1>{currentQuestion.prompt}</h1>
      <p className="anonymous-sharing-help">
        하나 이상 답한 뒤 마지막 질문에서 작성 완료를 눌러주세요.
      </p>
      <textarea
        aria-label={currentQuestion.prompt}
        disabled={busy}
        value={answers[currentQuestion.id] ?? ''}
        maxLength={2000}
        rows={4}
        onChange={(event) => editAnswer(currentQuestion.id, event.target.value)}
      />
      <p className="anonymous-sharing-help">
        {currentQuestion.helperText ?? '답하기 어려운 질문은 건너뛰어도 괜찮아요.'}
      </p>
      <div className="anonymous-sharing-writing-actions">
        <button
          type="button"
          disabled={busy || questionIndex === 0}
          onClick={() => void moveQuestion(-1)}
        >
          이전
        </button>
        {questionIndex < questions.length - 1 ? (
          <PrimaryButton disabled={busy} onClick={() => void moveQuestion(1)}>
            다음
          </PrimaryButton>
        ) : (
          <PrimaryButton disabled={busy || !hasWrittenAnswer} onClick={finishAnswers}>
            작성 완료
          </PrimaryButton>
        )}
      </div>
      {questionIndex === questions.length - 1 && !hasWrittenAnswer ? (
        <p className="anonymous-sharing-help" role="status">
          답변을 하나 이상 작성해야 완료할 수 있어요.
        </p>
      ) : null}
    </section>
  );
}
