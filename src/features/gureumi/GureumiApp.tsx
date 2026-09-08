import { useEffect, useMemo, useRef, useState } from 'react';

import { gureumiApi, GureumiApiError } from './api/gureumiApi';
import {
  GUREUMI_PAGE_SIZE,
  type GureumiAnswer,
  type GureumiAttemptReference,
  type GureumiAttemptState,
  type GureumiChoice,
  type GureumiFollowUpFeedback,
  type GureumiQuestion,
  type GureumiQuickFeedback,
  type GureumiResult,
} from './domain/types';
import { GureumiIntroScreen } from './screens/GureumiIntroScreen';
import { GureumiFeedbackFlow } from './screens/GureumiFeedbackFlow';
import { GureumiQuestionScreen } from './screens/GureumiQuestionScreen';
import { GureumiResultScreen } from './screens/GureumiResultScreen';
import {
  clearGureumiAttempt,
  loadGureumiAttempt,
  saveGureumiAttempt,
} from './services/attemptStorage';
import { assetUrl } from '../../utils/assetUrl';
import './styles/gureumi.css';

type GureumiAppProps = {
  onBackHome: () => void;
};

type Phase = 'booting' | 'intro' | 'questions' | 'result' | 'feedback';

function answersByQuestion(answers: GureumiAnswer[]): Partial<Record<string, GureumiChoice>> {
  return Object.fromEntries(answers.map(({ questionId, choice }) => [questionId, choice]));
}

function errorMessage(error: unknown): string {
  return error instanceof GureumiApiError
    ? error.message
    : '구르미 테스트를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
}

export function GureumiApp({ onBackHome }: GureumiAppProps) {
  const [phase, setPhase] = useState<Phase>('booting');
  const [reference, setReference] = useState<GureumiAttemptReference | null>(loadGureumiAttempt);
  const [resumeState, setResumeState] = useState<GureumiAttemptState | null>(null);
  const [questions, setQuestions] = useState<GureumiQuestion[]>([]);
  const [answers, setAnswers] = useState<Partial<Record<string, GureumiChoice>>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [pendingQuestionIds, setPendingQuestionIds] = useState<Set<string>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Partial<Record<string, string>>>({});
  const [result, setResult] = useState<GureumiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const pageEnteredAt = useRef<Record<string, number>>({});

  useEffect(() => {
    const saved = loadGureumiAttempt();
    let active = true;

    if (!saved) {
      setPhase('intro');
      return () => { active = false; };
    }

    void gureumiApi.getCurrent(saved.resumeToken)
      .then(async (state) => {
        if (!active) return;
        setReference(saved);
        if (state.completed) {
          const completedResult = await gureumiApi.getResult(saved.attemptId, saved.resumeToken);
          if (!active) return;
          setResult(completedResult);
          setResumeState(null);
          setPhase('result');
        } else {
          setResumeState(state);
          setPhase('intro');
        }
      })
      .catch((loadError) => {
        if (!active) return;
        if (loadError instanceof GureumiApiError && loadError.status === 401) {
          clearGureumiAttempt();
          setReference(null);
        } else {
          setError(errorMessage(loadError));
        }
        setPhase('intro');
      });

    return () => { active = false; };
  }, []);

  const currentQuestions = useMemo(() => (
    questions.slice(pageIndex * GUREUMI_PAGE_SIZE, (pageIndex + 1) * GUREUMI_PAGE_SIZE)
  ), [pageIndex, questions]);

  useEffect(() => {
    const now = Date.now();
    pageEnteredAt.current = Object.fromEntries(
      currentQuestions.map(({ questionId }) => [questionId, now]),
    );
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [currentQuestions]);

  const openAttempt = async (
    nextReference: GureumiAttemptReference,
    knownState?: GureumiAttemptState,
  ) => {
    const [state, questionResponse] = await Promise.all([
      knownState ?? gureumiApi.getCurrent(nextReference.resumeToken),
      gureumiApi.getQuestions(nextReference.attemptId, nextReference.resumeToken),
    ]);
    setReference(nextReference);
    saveGureumiAttempt(nextReference);
    setResumeState(state);
    setQuestions(questionResponse.questions);
    setAnswers(answersByQuestion(state.answers));
    setPageIndex(Math.max(0, Math.floor((state.nextOrder - 1) / GUREUMI_PAGE_SIZE)));
    setPendingQuestionIds(new Set());
    setSaveErrors({});
    setError('');
    setPhase('questions');
  };

  const createAndOpen = async (previousToken?: string) => {
    setBusy(true);
    setError('');
    try {
      const created = await gureumiApi.createAttempt(previousToken);
      await openAttempt({ attemptId: created.attemptId, resumeToken: created.resumeToken });
    } catch (startError) {
      setError(errorMessage(startError));
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    if (!reference || !resumeState) return;
    setBusy(true);
    setError('');
    try {
      await openAttempt(reference, resumeState);
    } catch (resumeError) {
      setError(errorMessage(resumeError));
    } finally {
      setBusy(false);
    }
  };

  const handleStartFresh = () => {
    clearGureumiAttempt();
    setReference(null);
    setResumeState(null);
    void createAndOpen();
  };

  const handleAnswer = async (question: GureumiQuestion, choice: GureumiChoice) => {
    if (!reference || pendingQuestionIds.has(question.questionId)) return;
    const previousChoice = answers[question.questionId];
    const responseMs = Math.min(
      3_600_000,
      Math.max(0, Date.now() - (pageEnteredAt.current[question.questionId] ?? Date.now())),
    );

    setAnswers((current) => ({ ...current, [question.questionId]: choice }));
    setSaveErrors((current) => ({ ...current, [question.questionId]: undefined }));
    setPendingQuestionIds((current) => new Set(current).add(question.questionId));
    try {
      await gureumiApi.saveAnswer(reference.attemptId, reference.resumeToken, {
        questionId: question.questionId,
        choice,
        responseMs,
      });
    } catch (saveError) {
      setAnswers((current) => {
        const next = { ...current };
        if (previousChoice) next[question.questionId] = previousChoice;
        else delete next[question.questionId];
        return next;
      });
      setSaveErrors((current) => ({
        ...current,
        [question.questionId]: errorMessage(saveError),
      }));
    } finally {
      setPendingQuestionIds((current) => {
        const next = new Set(current);
        next.delete(question.questionId);
        return next;
      });
    }
  };

  const handleNext = async () => {
    if (!reference) return;
    const lastOrder = currentQuestions.at(-1)?.order ?? 0;
    if (lastOrder < 27) {
      setPageIndex((current) => current + 1);
      return;
    }

    setCompleting(true);
    setError('');
    try {
      await gureumiApi.complete(reference.attemptId, reference.resumeToken);
      const completedResult = await gureumiApi.getResult(reference.attemptId, reference.resumeToken);
      setResult(completedResult);
      setResumeState(null);
      setPhase('result');
    } catch (completeError) {
      setSaveErrors((current) => ({
        ...current,
        [currentQuestions.at(-1)?.questionId ?? 'completion']: errorMessage(completeError),
      }));
    } finally {
      setCompleting(false);
    }
  };

  const handleOpenFeedback = async () => {
    if (!reference || !result || busy) return;
    setBusy(true);
    setError('');
    try {
      if (questions.length !== 27) {
        const response = await gureumiApi.getQuestions(reference.attemptId, reference.resumeToken);
        setQuestions(response.questions);
      }
      setPhase('feedback');
    } catch (feedbackError) {
      setError(errorMessage(feedbackError));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveQuickFeedback = async (feedback: GureumiQuickFeedback) => {
    if (!reference) throw new Error('GUREUMI_ATTEMPT_NOT_FOUND');
    await gureumiApi.saveFeedback(reference.attemptId, reference.resumeToken, feedback);
  };

  const handleSaveFollowUpFeedback = async (feedback: GureumiFollowUpFeedback) => {
    if (!reference) throw new Error('GUREUMI_ATTEMPT_NOT_FOUND');
    await gureumiApi.saveFollowUpFeedback(reference.attemptId, reference.resumeToken, feedback);
  };

  const handleRetest = () => {
    if (busy) return;
    const previousToken = reference?.resumeToken;
    void createAndOpen(previousToken);
  };

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
        onPrevious={() => setPageIndex((current) => Math.max(0, current - 1))}
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
        onOpenFeedback={() => void handleOpenFeedback()}
        onRetest={handleRetest}
        onBackHome={onBackHome}
      />
    );
  }

  if (phase === 'feedback' && result) {
    return (
      <GureumiFeedbackFlow
        result={result}
        questions={questions}
        onSaveQuick={handleSaveQuickFeedback}
        onSaveFollowUp={handleSaveFollowUpFeedback}
        onBackResult={() => setPhase('result')}
        onRetest={handleRetest}
      />
    );
  }

  return (
    <GureumiIntroScreen
      answeredCount={resumeState?.answeredCount ?? 0}
      hasSavedAttempt={Boolean(
        reference && resumeState && resumeState.answeredCount > 0
      )}
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
