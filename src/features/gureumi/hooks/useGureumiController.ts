import { useGureumiAnswers } from './useGureumiAnswers';
import { errorMessage } from '../services/errorMessage';
import { useEffect, useMemo, useState } from 'react';

import { gureumiApi, GureumiApiError } from '../api/gureumiApi';
import {
  GUREUMI_PAGE_SIZE,
  type GureumiAttemptReference,
  type GureumiAttemptState,
  type GureumiFollowUpFeedback,
  type GureumiQuestion,
  type GureumiQuickFeedback,
  type GureumiResult,
} from '../domain/types';
import {
  clearGureumiAttempt,
  loadGureumiAttempt,
  saveGureumiAttempt,
} from '../services/attemptStorage';

type Phase = 'booting' | 'intro' | 'questions' | 'result' | 'feedback';

export function useGureumiController() {
  const [phase, setPhase] = useState<Phase>('booting');
  const [reference, setReference] = useState<GureumiAttemptReference | null>(loadGureumiAttempt);
  const [resumeState, setResumeState] = useState<GureumiAttemptState | null>(null);
  const [questions, setQuestions] = useState<GureumiQuestion[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [result, setResult] = useState<GureumiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = loadGureumiAttempt();
    let active = true;

    if (!saved) {
      setPhase('intro');
      return () => {
        active = false;
      };
    }

    void gureumiApi
      .getCurrent(saved.resumeToken)
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

    return () => {
      active = false;
    };
  }, []);

  const currentQuestions = useMemo(
    () => questions.slice(pageIndex * GUREUMI_PAGE_SIZE, (pageIndex + 1) * GUREUMI_PAGE_SIZE),
    [pageIndex, questions],
  );

  const { answers, pendingQuestionIds, saveErrors, handleAnswer, resetAnswers, reportSaveError } =
    useGureumiAnswers(reference, currentQuestions);

  useEffect(() => {
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
    resetAnswers(state.answers);
    setPageIndex(Math.max(0, Math.floor((state.nextOrder - 1) / GUREUMI_PAGE_SIZE)));
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
      const completedResult = await gureumiApi.getResult(
        reference.attemptId,
        reference.resumeToken,
      );
      setResult(completedResult);
      setResumeState(null);
      setPhase('result');
    } catch (completeError) {
      reportSaveError(
        currentQuestions.at(-1)?.questionId ?? 'completion',
        errorMessage(completeError),
      );
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

  return {
    phase,
    result,
    questions,
    currentQuestions,
    answers,
    pageIndex,
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
    previousPage: () => setPageIndex((current) => Math.max(0, current - 1)),
    backToResult: () => setPhase('result'),
  };
}
