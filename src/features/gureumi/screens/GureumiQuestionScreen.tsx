import type { GureumiChoice, GureumiQuestion } from '../domain/types';
import { GUREUMI_QUESTION_COUNT } from '../domain/types';

const CHOICES: ReadonlyArray<{
  id: GureumiChoice;
  shortSide: 'A' | 'B';
  strength: '매우' | '조금';
  label: string;
}> = [
  { id: 'A_VERY', shortSide: 'A', strength: '매우', label: 'A에 매우 가까움' },
  { id: 'A_LITTLE', shortSide: 'A', strength: '조금', label: 'A에 조금 가까움' },
  { id: 'B_LITTLE', shortSide: 'B', strength: '조금', label: 'B에 조금 가까움' },
  { id: 'B_VERY', shortSide: 'B', strength: '매우', label: 'B에 매우 가까움' },
];

type GureumiQuestionScreenProps = {
  questions: GureumiQuestion[];
  answers: Partial<Record<string, GureumiChoice>>;
  pageStart: number;
  pendingQuestionIds: ReadonlySet<string>;
  saveErrors: Partial<Record<string, string>>;
  completing: boolean;
  onAnswer: (question: GureumiQuestion, choice: GureumiChoice) => void;
  onPrevious: () => void;
  onNext: () => void;
  onBackHome: () => void;
};

export function GureumiQuestionScreen({
  questions,
  answers,
  pageStart,
  pendingQuestionIds,
  saveErrors,
  completing,
  onAnswer,
  onPrevious,
  onNext,
  onBackHome,
}: GureumiQuestionScreenProps) {
  const pageEnd = questions.at(-1)?.order ?? pageStart;
  const allAnswered = questions.every(({ questionId }) => Boolean(answers[questionId]));
  const saving = questions.some(({ questionId }) => pendingQuestionIds.has(questionId));
  const hasError = questions.some(({ questionId }) => Boolean(saveErrors[questionId]));
  const isLastPage = pageEnd === GUREUMI_QUESTION_COUNT;

  return (
    <main className="gureumi-screen gureumi-questions">
      <header className="gureumi-question-header">
        <button type="button" onClick={onBackHome} aria-label="홈으로 돌아가기">←</button>
        <span className="gureumi-question-header__brand">☁ <b>구르미 테스트</b></span>
        <strong>{pageStart}–{pageEnd} / {GUREUMI_QUESTION_COUNT}</strong>
      </header>
      <div
        className="gureumi-progress"
        role="progressbar"
        aria-label="구르미 테스트 진행률"
        aria-valuemin={0}
        aria-valuemax={GUREUMI_QUESTION_COUNT}
        aria-valuenow={pageEnd}
      >
        <span style={{ width: `${(pageEnd / GUREUMI_QUESTION_COUNT) * 100}%` }} />
      </div>

      <div className="gureumi-question-list">
        {questions.map((question) => (
          <fieldset className="gureumi-question" key={question.questionId}>
            <legend>
              <span>{String(question.order).padStart(2, '0')}</span>
              {question.prompt}
            </legend>
            <div className="gureumi-question__options">
              <div><b>A</b><p>{question.optionA}</p></div>
              <div><b>B</b><p>{question.optionB}</p></div>
            </div>
            <div className="gureumi-choice-scale" role="radiogroup" aria-label={`${question.order}번 응답`}>
              {CHOICES.map((choice) => {
                const selected = answers[question.questionId] === choice.id;
                return (
                  <label className={`gureumi-choice gureumi-choice--${choice.shortSide.toLowerCase()}${selected ? ' is-selected' : ''}`} key={choice.id}>
                    <input
                      type="radio"
                      name={`gureumi-${question.questionId}`}
                      value={choice.id}
                      checked={selected}
                      disabled={pendingQuestionIds.has(question.questionId) || completing}
                      onChange={() => onAnswer(question, choice.id)}
                    />
                    <span aria-hidden="true" />
                    <small>{choice.shortSide}<br />{choice.strength}</small>
                    <i className="sr-only">{choice.label}</i>
                  </label>
                );
              })}
            </div>
            {saveErrors[question.questionId] ? (
              <p className="gureumi-question__error" role="alert">{saveErrors[question.questionId]} 답을 다시 선택해주세요.</p>
            ) : null}
          </fieldset>
        ))}
      </div>

      <nav className="gureumi-question-actions" aria-label="문항 이동">
        <button type="button" disabled={pageStart === 1 || completing} onClick={onPrevious}>이전</button>
        <button
          className="gureumi-primary-button"
          type="button"
          disabled={!allAnswered || saving || hasError || completing}
          onClick={onNext}
        >
          {completing ? '결과를 만들고 있어요…' : isLastPage ? '결과 확인하기' : '다음'}
        </button>
      </nav>
      {!allAnswered ? <p className="gureumi-page-guide">모두 답하면 다음으로 갈 수 있어요.</p> : null}
    </main>
  );
}
