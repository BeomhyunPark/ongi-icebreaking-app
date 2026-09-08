import { PrimaryButton } from '../../../components/PrimaryButton';
import { ScreenLayout } from '../../../components/ScreenLayout';
import type { BalanceController } from '../hooks/useBalanceGame';
import { ProgressBar } from '../../../components/ProgressBar';
import { CATEGORY_LABELS } from '../data/labels';

export function BalancePlayScreen({
  playQuestions,
  currentQuestionIndex,
  selectedSide,
  setSelectedSide,
  showPicker,
  previousQuestion,
  nextQuestion,
}: Pick<
  BalanceController,
  | 'playQuestions'
  | 'currentQuestionIndex'
  | 'selectedSide'
  | 'setSelectedSide'
  | 'showPicker'
  | 'previousQuestion'
  | 'nextQuestion'
>) {
  const question = playQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === playQuestions.length - 1;

  return (
    <ScreenLayout
      className={`balance-game-screen balance-game-screen--${question.weight} balance-play balance-play--${question.weight}`}
    >
      <button className="test-home-button" type="button" onClick={showPicker}>
        <span aria-hidden="true">←</span> 질문 선택
      </button>

      <header className="balance-play__progress">
        <span>
          {currentQuestionIndex + 1} / {playQuestions.length}
        </span>
        <ProgressBar
          current={currentQuestionIndex + 1}
          total={playQuestions.length}
          label="밸런스 게임 진행률"
        />
      </header>

      <section className="balance-play__question" aria-labelledby="balance-question-title">
        <small>{question.topic ?? CATEGORY_LABELS[question.category]}</small>
        <h1 id="balance-question-title">{question.prompt}</h1>
        {question.context ? <p className="balance-play__context">{question.context}</p> : null}
      </section>

      <div className="balance-choice-list" role="radiogroup" aria-label={question.prompt}>
        <button
          className={selectedSide === 'left' ? 'is-selected' : undefined}
          type="button"
          role="radio"
          aria-label={question.left}
          aria-checked={selectedSide === 'left'}
          onClick={() => setSelectedSide('left')}
        >
          <small>A</small>
          <strong>{question.left}</strong>
        </button>
        <span aria-hidden="true">VS</span>
        <button
          className={selectedSide === 'right' ? 'is-selected' : undefined}
          type="button"
          role="radio"
          aria-label={question.right}
          aria-checked={selectedSide === 'right'}
          onClick={() => setSelectedSide('right')}
        >
          <small>B</small>
          <strong>{question.right}</strong>
        </button>
      </div>

      <footer className="balance-play__footer">
        <button
          className="balance-play__previous"
          type="button"
          disabled={currentQuestionIndex === 0}
          onClick={previousQuestion}
        >
          이전 질문
        </button>
        <PrimaryButton
          className="balance-play__next"
          disabled={selectedSide === null}
          onClick={nextQuestion}
        >
          {isLastQuestion ? '마무리하기' : '다음 질문'}
        </PrimaryButton>
      </footer>
    </ScreenLayout>
  );
}
