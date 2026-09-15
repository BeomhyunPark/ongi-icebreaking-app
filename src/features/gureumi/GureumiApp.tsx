import { useGureumiController } from './hooks/useGureumiController';
import { GureumiIntroScreen } from './screens/GureumiIntroScreen';
import { GureumiQuestionScreen } from './screens/GureumiQuestionScreen';
import { GureumiResultScreen } from './screens/GureumiResultScreen';
import { assetUrl } from '../../utils/assetUrl';
import './styles/gureumi.css';

export function GureumiApp({ onBackHome }: { onBackHome: () => void }) {
  const {
    phase,
    result,
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
    handleRetest,
    handleResume,
    handleStartFresh,
    createAndOpen,
    previousPage,
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
        retestStarting={busy}
        actionError={error}
        onRetest={handleRetest}
        onBackHome={onBackHome}
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
