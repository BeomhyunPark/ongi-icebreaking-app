import type { BalanceGameCategory, BalanceGameQuestion, BalanceGameWeight } from '../domain/types';

export type QuestionFilter = 'all' | BalanceGameCategory;
export type Choices = Record<string, 'left' | 'right'>;
type BalanceProgress =
  | { phase: 'setup' | 'picker'; playQuestions: readonly BalanceGameQuestion[] }
  | {
      phase: 'play' | 'complete';
      playQuestions: readonly [BalanceGameQuestion, ...BalanceGameQuestion[]];
    };
export type BalanceState = BalanceProgress & {
  weight: BalanceGameWeight;
  filter: QuestionFilter;
  selectedQuestionIds: readonly string[];
  playedQuestionIds: readonly string[];
  currentQuestionIndex: number;
  choices: Choices;
};
export type BalanceAction =
  | { type: 'SELECT_WEIGHT'; weight: BalanceGameWeight }
  | { type: 'FILTER'; filter: QuestionFilter }
  | { type: 'TOGGLE_QUESTION'; id: string }
  | { type: 'SHOW_PICKER' }
  | { type: 'SHOW_SETUP' }
  | { type: 'START'; questions: readonly BalanceGameQuestion[] }
  | { type: 'CHOOSE'; side: 'left' | 'right' }
  | { type: 'PREVIOUS' }
  | { type: 'NEXT' }
  | { type: 'REVIEW' };

export function createBalanceState(weight: BalanceGameWeight): BalanceState {
  return {
    phase: 'setup',
    weight,
    filter: 'all',
    selectedQuestionIds: [],
    playedQuestionIds: [],
    playQuestions: [],
    currentQuestionIndex: 0,
    choices: {},
  };
}

export function balanceReducer(state: BalanceState, action: BalanceAction): BalanceState {
  switch (action.type) {
    case 'SELECT_WEIGHT':
      return createBalanceState(action.weight);
    case 'FILTER':
      return { ...state, filter: action.filter };
    case 'SHOW_SETUP':
      return { ...state, phase: 'setup' };
    case 'SHOW_PICKER':
      return { ...state, phase: 'picker' };
    case 'TOGGLE_QUESTION':
      if (state.playedQuestionIds.includes(action.id)) return state;
      return {
        ...state,
        selectedQuestionIds: state.selectedQuestionIds.includes(action.id)
          ? state.selectedQuestionIds.filter((id) => id !== action.id)
          : [...state.selectedQuestionIds, action.id],
      };
    case 'START': {
      const [first, ...rest] = action.questions;
      if (!first || action.questions.some((question) => question.weight !== state.weight))
        return state;
      return {
        ...state,
        phase: 'play',
        playQuestions: [first, ...rest],
        currentQuestionIndex: 0,
        choices: {},
      };
    }
    case 'CHOOSE': {
      if (state.phase !== 'play') return state;
      const question = state.playQuestions[state.currentQuestionIndex];
      return { ...state, choices: { ...state.choices, [question.id]: action.side } };
    }
    case 'PREVIOUS':
      return state.phase === 'play'
        ? { ...state, currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1) }
        : state;
    case 'NEXT': {
      if (
        state.phase !== 'play' ||
        !state.choices[state.playQuestions[state.currentQuestionIndex].id]
      )
        return state;
      if (state.currentQuestionIndex < state.playQuestions.length - 1)
        return { ...state, currentQuestionIndex: state.currentQuestionIndex + 1 };
      return {
        ...state,
        phase: 'complete',
        selectedQuestionIds: [],
        playedQuestionIds: [
          ...new Set([
            ...state.playedQuestionIds,
            ...state.playQuestions.map((question) => question.id),
          ]),
        ],
      };
    }
    case 'REVIEW':
      return state.phase === 'complete'
        ? { ...state, phase: 'play', currentQuestionIndex: 0 }
        : state;
  }
}
