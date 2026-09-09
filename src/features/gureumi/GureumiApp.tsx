import { useGureumiController } from './hooks/useGureumiController';
import { GureumiIntroScreen } from './screens/GureumiIntroScreen';
import { GureumiFeedbackFlow } from './screens/GureumiFeedbackFlow';
import { GureumiQuestionScreen } from './screens/GureumiQuestionScreen';
import { GureumiResultScreen } from './screens/GureumiResultScreen';
import { assetUrl } from '../../utils/assetUrl';
import './styles/gureumi.css';

export function GureumiApp({ onBackHome }: { onBackHome: () => void }) {
  const {
    phase,
    result,
    questions,
    currentQuestions,
    answers,
    pendingQuestionIds,
    saveErrors,
    completing,
    busy,
    error,
    resumeState,
    reference,
    handleAnswer,
    handleNext,
    handleOpenFeedback,
    handleRetest,
    handleSaveQuickFeedback,
    handleSaveFollowUpFeedback,
    handleResume,
    handleStartFresh,
    createAndOpen,
    previousPage,
    backToResult,
  } = useGureumiController();

  if (phase === 'booting') {
    return (
      <main className="gureumi-screen gureumi-loading" aria-live="polite">
        <img src={assetUrl('images/teasers/gureumi-test/dalmong.png')} alt="" />
        <h1>이어 하던 구르미를 찾고 있어요</h1>
        <p>저장된 답변을 안전하게 불러오는 중이에요.</p>
      </main>
    );
  }

  if (phase === 'questions') {
    return (
      <GureumiQuestionScreen
        questions={currentQuestions}
        answers={answers}
        pageStart={currentQuestions[0]?.order ?? 1}
        pendingQuestionIds={pendingQuestionIds}
        saveErrors={saveErrors}
        completing={completing}
        onAnswer={(question, choice) => void handleAnswer(question, choice)}
        onPrevious={previousPage}
        onNext={() => void handleNext()}
        onBackHome={onBackHome}
      />
    );
  }

  if (phase === 'result' && result) {
    return (
      <GureumiResultScreen
        result={result}
        feedbackOpening={busy}
        retestStarting={busy}
        actionError={error}
        onOpenFeedback={() => void handleOpenFeedback()}
        onRetest={handleRetest}
        onBackHome={onBackHome}
      />
    );
  }

  if (phase === 'feedback' && result) {
    return (
      <GureumiFeedbackFlow
        retestStarting={busy}
        actionError={error}
        result={result}
        questions={questions}
        onSaveQuick={handleSaveQuickFeedback}
        onSaveFollowUp={handleSaveFollowUpFeedback}
        onBackResult={backToResult}
        onRetest={handleRetest}
      />
    );
  }

  return (
    <GureumiIntroScreen
      answeredCount={resumeState?.answeredCount ?? 0}
      hasSavedAttempt={Boolean(reference && resumeState && resumeState.answeredCount > 0)}
      busy={busy}
      error={error}
      onStart={() => {
        if (reference && resumeState) {
          void handleResume();
        } else {
          void createAndOpen();
        }
      }}
      onResume={() => void handleResume()}
      onStartFresh={handleStartFresh}
      onBackHome={onBackHome}
    />
  );
}
