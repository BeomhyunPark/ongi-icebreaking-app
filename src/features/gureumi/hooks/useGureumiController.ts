import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useGureumiAnswers } from './useGureumiAnswers';
import { errorMessage } from '../services/errorMessage';
import { gureumiApi, GureumiApiError } from '../api/gureumiApi';
import {
  GUREUMI_PAGE_SIZE,
  type GureumiAttemptReference,
  type GureumiAttemptState,
  type GureumiFollowUpFeedback,
  type GureumiQuickFeedback,
} from '../domain/types';
import {
  clearGureumiAttempt,
  loadGureumiAttempt,
  saveGureumiAttempt,
} from '../services/attemptStorage';
import { gureumiReducer, initialGureumiState, type GureumiAction } from '../state/gureumiReducer';

export function useGureumiController() {
  const [state, dispatch] = useReducer(gureumiReducer, initialGureumiState);
  const { reference, resumeState, questions, pageIndex } = state;
  const lifecycle = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    const generation = ++lifecycle.current;
    const active = () => lifecycle.current === generation;
    const saved = loadGureumiAttempt();
    if (!saved) dispatch({ type: 'RESTORE_INTRO', reference: null, resumeState: null });
    else
      void (async () => {
        try {
          const attempt = await gureumiApi.getCurrent(saved.resumeToken);
          if (!active()) return;
          if (attempt.completed) {
            const result = await gureumiApi.getResult(saved.attemptId, saved.resumeToken);
            if (active()) dispatch({ type: 'RESULT', reference: saved, result });
          } else dispatch({ type: 'RESTORE_INTRO', reference: saved, resumeState: attempt });
        } catch (error) {
          if (!active()) return;
          const expired = error instanceof GureumiApiError && error.status === 401;
          if (expired) clearGureumiAttempt();
          dispatch({
            type: 'RESTORE_INTRO',
            reference: expired ? null : saved,
            resumeState: null,
            error: expired ? '' : errorMessage(error),
          });
        }
      })();
    return () => {
      lifecycle.current++;
      pending.current = false;
    };
  }, []);

  const currentQuestions = useMemo(
    () => questions.slice(pageIndex * GUREUMI_PAGE_SIZE, (pageIndex + 1) * GUREUMI_PAGE_SIZE),
    [pageIndex, questions],
  );
  const answerState = useGureumiAnswers(reference, currentQuestions);
  const { answers, pendingQuestionIds, resetAnswers, reportSaveError } = answerState;

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [currentQuestions]);

  // The synchronous lock catches duplicate commands before React renders.
  // The generation guard prevents departed screens from writing storage/state.
  const run = async (
    operation: Extract<GureumiAction, { type: 'BEGIN' }>['operation'],
    work: (active: () => boolean) => Promise<void>,
  ) => {
    if (pending.current || gureumiReducer(state, { type: 'BEGIN', operation }) === state) return;
    pending.current = true;
    const generation = lifecycle.current;
    const active = () => generation === lifecycle.current;
    dispatch({ type: 'BEGIN', operation });
    try {
      await work(active);
    } catch (error) {
      if (active()) {
        dispatch({ type: 'FAILED', error: errorMessage(error) });
        if (operation === 'complete')
          reportSaveError(currentQuestions.at(-1)?.questionId ?? 'completion', errorMessage(error));
      }
    } finally {
      if (active()) pending.current = false;
    }
  };

  const openAttempt = async (
    nextReference: GureumiAttemptReference,
    active: () => boolean,
    knownState?: GureumiAttemptState,
  ) => {
    const [attempt, response] = await Promise.all([
      knownState ?? gureumiApi.getCurrent(nextReference.resumeToken),
      gureumiApi.getQuestions(nextReference.attemptId, nextReference.resumeToken),
    ]);
    if (!active()) return;
    if (attempt.completed || response.questions.length === 0)
      throw new Error('질문을 불러오지 못했어요. 다시 시도해주세요.');
    saveGureumiAttempt(nextReference);
    resetAnswers(attempt.answers);
    dispatch({ type: 'OPEN', reference: nextReference, attempt, questions: response.questions });
  };
  const createAndOpen = (previousToken?: string) =>
    run('start', async (active) => {
      const created = await gureumiApi.createAttempt(previousToken);
      if (active())
        await openAttempt(
          { attemptId: created.attemptId, resumeToken: created.resumeToken },
          active,
        );
    });
  const handleResume = () =>
    run('resume', async (active) => {
      if (!reference || !resumeState) throw new Error('이어 할 검사를 찾지 못했어요.');
      await openAttempt(reference, active, resumeState);
    });
  const handleNext = async () => {
    if (
      state.phase !== 'questions' ||
      pending.current ||
      pendingQuestionIds.size > 0 ||
      !currentQuestions.length ||
      currentQuestions.some(({ questionId }) => !answers[questionId])
    )
      return;
    if ((pageIndex + 1) * GUREUMI_PAGE_SIZE < questions.length) {
      dispatch({ type: 'PAGE', direction: 1 });
      return;
    }
    await run('complete', async (active) => {
      await gureumiApi.complete(state.reference.attemptId, state.reference.resumeToken);
      if (!active()) return;
      const result = await gureumiApi.getResult(
        state.reference.attemptId,
        state.reference.resumeToken,
      );
      if (active()) dispatch({ type: 'RESULT', reference: state.reference, result });
    });
  };
  const handleOpenFeedback = () =>
    run('feedback', async (active) => {
      if (!reference) return;
      const response = questions.length
        ? { questions }
        : await gureumiApi.getQuestions(reference.attemptId, reference.resumeToken);
      if (active()) dispatch({ type: 'FEEDBACK', questions: response.questions });
    });
  const handleSaveQuickFeedback = async (feedback: GureumiQuickFeedback) => {
    if (!reference) throw new Error('GUREUMI_ATTEMPT_NOT_FOUND');
    await gureumiApi.saveFeedback(reference.attemptId, reference.resumeToken, feedback);
  };
  const handleSaveFollowUpFeedback = async (feedback: GureumiFollowUpFeedback) => {
    if (!reference) throw new Error('GUREUMI_ATTEMPT_NOT_FOUND');
    await gureumiApi.saveFollowUpFeedback(reference.attemptId, reference.resumeToken, feedback);
  };
  return {
    ...state,
    ...answerState,
    currentQuestions,
    busy: state.operation !== 'idle',
    completing: state.operation === 'complete',
    handleNext,
    handleResume,
    handleOpenFeedback,
    handleSaveQuickFeedback,
    handleSaveFollowUpFeedback,
    createAndOpen,
    handleStartFresh: () => {
      void createAndOpen();
    },
    handleRetest: () => {
      void createAndOpen(reference?.resumeToken);
    },
    previousPage: () => {
      if (!pending.current) dispatch({ type: 'PAGE', direction: -1 });
    },
    backToResult: () => dispatch({ type: 'BACK_TO_RESULT' }),
  };
}
