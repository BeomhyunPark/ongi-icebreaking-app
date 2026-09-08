import { useEffect, useMemo, useReducer } from 'react';
import {
  completeContentParticipation,
  startContentParticipation,
} from '../../../engagement/tracker';
import { BALANCE_GAME_QUESTIONS } from '../data/questions';
import type { BalanceGameQuestion, BalanceGameWeight } from '../domain/types';
import { pickRandomQuestions } from '../domain/pickQuestions';
import {
  loadBalanceSession,
  restoreBalanceState,
  saveBalanceSession,
} from '../services/sessionStorage';
import { balanceReducer, type QuestionFilter } from '../state/balanceReducer';

export function useBalanceGame(
  initialWeight: BalanceGameWeight,
  onWeightChange?: (weight: BalanceGameWeight) => void,
) {
  const [state, dispatch] = useReducer(balanceReducer, initialWeight, (weight) =>
    restoreBalanceState(weight, loadBalanceSession(weight)),
  );
  const {
    phase,
    weight,
    filter,
    playQuestions,
    currentQuestionIndex,
    selectedQuestionIds,
    playedQuestionIds,
    choices,
  } = state;
  const selectedSide = choices[playQuestions[currentQuestionIndex]?.id] ?? null;
  useEffect(() => {
    saveBalanceSession(weight, {
      phase,
      selectedQuestionIds,
      playedQuestionIds,
      questionIds: playQuestions.map((question) => question.id),
      index: currentQuestionIndex,
      choices,
    });
  }, [
    weight,
    phase,
    selectedQuestionIds,
    playedQuestionIds,
    playQuestions,
    currentQuestionIndex,
    choices,
  ]);
  useEffect(() => {
    if (phase === 'setup' && weight !== initialWeight)
      dispatch({ type: 'SELECT_WEIGHT', weight: initialWeight });
  }, [initialWeight, phase]);
  useEffect(() => {
    onWeightChange?.(weight);
  }, [onWeightChange, weight]);

  const visibleQuestions = useMemo<readonly BalanceGameQuestion[]>(
    () =>
      BALANCE_GAME_QUESTIONS.filter(
        (question) =>
          question.weight === weight && (filter === 'all' || question.category === filter),
      ),
    [weight, filter],
  );
  const startGame = (questions: readonly BalanceGameQuestion[]) => {
    if (!questions.length) return;
    void startContentParticipation('balance-game');
    dispatch({ type: 'START', questions });
  };
  return {
    ...state,
    selectedSide,
    visibleQuestions,
    selectWeight: (next: BalanceGameWeight) => dispatch({ type: 'SELECT_WEIGHT', weight: next }),
    setFilter: (next: QuestionFilter) => dispatch({ type: 'FILTER', filter: next }),
    toggleQuestion: (id: string) => dispatch({ type: 'TOGGLE_QUESTION', id }),
    showPicker: () => dispatch({ type: 'SHOW_PICKER' }),
    showSetup: () => dispatch({ type: 'SHOW_SETUP' }),
    reviewChoices: () => dispatch({ type: 'REVIEW' }),
    startRandomGame: () => startGame(pickRandomQuestions(weight)),
    startCustomGame: () =>
      startGame(
        BALANCE_GAME_QUESTIONS.filter(
          (question) =>
            question.weight === weight &&
            selectedQuestionIds.includes(question.id) &&
            !playedQuestionIds.includes(question.id),
        ),
      ),
    setSelectedSide: (side: 'left' | 'right') => dispatch({ type: 'CHOOSE', side }),
    previousQuestion: () => dispatch({ type: 'PREVIOUS' }),
    nextQuestion: () => {
      if (phase === 'play' && selectedSide && currentQuestionIndex === playQuestions.length - 1) {
        void completeContentParticipation('balance-game');
      }
      dispatch({ type: 'NEXT' });
    },
  };
}

export type BalanceController = ReturnType<typeof useBalanceGame>;
