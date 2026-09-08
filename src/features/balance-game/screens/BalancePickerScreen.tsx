import { PrimaryButton } from '../../../components/PrimaryButton';
import { ScreenLayout } from '../../../components/ScreenLayout';
import type { BalanceController } from '../hooks/useBalanceGame';
import { CATEGORY_LABELS, FILTER_LABELS } from '../data/labels';

export function BalancePickerScreen({
  weight,
  filter,
  selectedQuestionIds,
  playedQuestionIds,
  visibleQuestions,
  setFilter,
  toggleQuestion,
  startCustomGame,
  showSetup,
}: Pick<
  BalanceController,
  | 'weight'
  | 'filter'
  | 'selectedQuestionIds'
  | 'playedQuestionIds'
  | 'visibleQuestions'
  | 'setFilter'
  | 'toggleQuestion'
  | 'startCustomGame'
  | 'showSetup'
>) {
  return (
    <ScreenLayout
      className={`balance-game-screen balance-game-screen--${weight} balance-picker`}
      footer={
        <div className="balance-picker__footer">
          <p aria-label={`${selectedQuestionIds.length}개 선택`}>
            <strong>{selectedQuestionIds.length}</strong>개 선택
          </p>
          <PrimaryButton disabled={selectedQuestionIds.length === 0} onClick={startCustomGame}>
            선택한 질문으로 시작
          </PrimaryButton>
        </div>
      }
    >
      <button className="test-home-button" type="button" onClick={showSetup}>
        <span aria-hidden="true">←</span> 설정
      </button>
      <header className="balance-picker__header">
        <p className="eyebrow">{weight === 'light' ? '가볍게' : '조금 깊게'} · 직접 골라 담기</p>
        <h1>오늘 나눌 질문</h1>
      </header>

      <div className="balance-filters" role="group" aria-label="질문 카테고리">
        {(
          [
            ['all', '전체'],
            ['daily', FILTER_LABELS[weight].daily],
            ['faith', FILTER_LABELS[weight].faith],
          ] as const
        ).map(([id, label]) => (
          <button
            className={filter === id ? 'is-active' : undefined}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="balance-question-list">
        {visibleQuestions.map((question) => {
          const isSelected = selectedQuestionIds.includes(question.id);
          const isPlayed = playedQuestionIds.includes(question.id);

          return (
            <label
              className={`balance-question-card${isSelected ? ' is-selected' : ''}${isPlayed ? ' is-played' : ''}`}
              key={question.id}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isPlayed}
                onChange={() => toggleQuestion(question.id)}
              />
              <span className="balance-question-card__check" aria-hidden="true">
                ✓
              </span>
              <span className="balance-question-card__copy">
                <small>
                  {question.topic ?? CATEGORY_LABELS[question.category]}
                  {isPlayed ? ' · 이미 나눈 질문' : ''}
                </small>
                <strong>{question.prompt}</strong>
                <span>
                  {question.context ?? (
                    <>
                      {question.left} <b>VS</b> {question.right}
                    </>
                  )}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </ScreenLayout>
  );
}
