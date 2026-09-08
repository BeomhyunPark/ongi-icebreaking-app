import { resolveLadder } from '../domain/draw';
import { getSpecialOutcomeValues } from '../domain/outcomes';
import type { PreparedDraw } from '../domain/prepareDraw';
import type { DrawResult, PickerMode, PickerSetup } from '../domain/types';

type DrawPhase =
  | { phase: 'setup'; result: null }
  | { phase: 'drawing' | 'result'; result: DrawResult };
export type PickerState = DrawPhase & {
  mode: PickerMode;
  setup: PickerSetup;
  error: string;
  activeLadderStart: number | null;
  revealedLadderStarts: ReadonlySet<number>;
  revealAllQueue: readonly number[] | null;
};

export type PickerAction =
  | { type: 'SELECT_MODE'; mode: PickerMode }
  | { type: 'EDIT_NAMES'; names: string[] }
  | { type: 'EDIT_DRAFT'; field: 'nameDraft' | 'outcomeDraft'; value: string }
  | { type: 'EDIT_OUTCOMES'; outcomes: string[] }
  | { type: 'EDIT_COUNT'; field: 'winnerCount' | 'groupCount'; value: number }
  | { type: 'CLEAR_ITEMS' }
  | { type: 'PREPARE_DRAW'; prepared: PreparedDraw }
  | { type: 'DRAW_FINISHED' }
  | { type: 'RESET_TO_SETUP' }
  | { type: 'REVEAL_START'; index: number }
  | { type: 'REVEAL_ALL' }
  | { type: 'TRACE_FINISHED' };

const emptyReveal = () => ({
  activeLadderStart: null,
  revealedLadderStarts: new Set<number>(),
  revealAllQueue: null,
});

export function createPickerState(
  mode: PickerMode,
  setup: PickerSetup,
  result: DrawResult | null = null,
  revealed: number[] = [],
): PickerState {
  return {
    mode,
    setup,
    error: '',
    ...emptyReveal(),
    revealedLadderStarts: new Set(revealed),
    ...(result ? { phase: 'result', result } : { phase: 'setup', result: null }),
  };
}

export function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case 'SELECT_MODE':
      return state.phase === 'setup' ? { ...state, mode: action.mode, error: '' } : state;
    case 'EDIT_NAMES':
      return {
        ...state,
        error: '',
        setup: {
          ...state.setup,
          names: action.names,
          outcomes: state.setup.outcomes.slice(0, action.names.length),
        },
      };
    case 'EDIT_DRAFT':
      return { ...state, error: '', setup: { ...state.setup, [action.field]: action.value } };
    case 'EDIT_OUTCOMES':
      return { ...state, error: '', setup: { ...state.setup, outcomes: action.outcomes } };
    case 'EDIT_COUNT':
      return { ...state, setup: { ...state.setup, [action.field]: action.value } };
    case 'CLEAR_ITEMS':
      return {
        ...state,
        setup: { ...state.setup, names: [], outcomes: [], nameDraft: '', outcomeDraft: '' },
      };
    case 'PREPARE_DRAW':
      return action.prepared.ok
        ? {
            ...state,
            ...emptyReveal(),
            setup: action.prepared.setup,
            result: action.prepared.result,
            phase: 'drawing',
            error: '',
          }
        : { ...state, setup: action.prepared.setup, error: action.prepared.error };
    case 'DRAW_FINISHED':
      return state.phase === 'drawing' ? { ...state, phase: 'result' } : state;
    case 'RESET_TO_SETUP':
      return { ...state, ...emptyReveal(), phase: 'setup', result: null };
    case 'REVEAL_START':
      if (
        state.phase !== 'result' ||
        state.result.mode !== 'ladder' ||
        state.activeLadderStart !== null ||
        action.index < 0 ||
        action.index >= state.result.orderedNames.length
      )
        return state;
      return { ...state, activeLadderStart: action.index };
    case 'REVEAL_ALL': {
      if (
        state.phase !== 'result' ||
        state.result.mode !== 'ladder' ||
        state.activeLadderStart !== null
      )
        return state;
      const { result } = state;
      const special = getSpecialOutcomeValues(result.outcomes);
      const queue = resolveLadder(result.ladder).flatMap((destination, start) =>
        special.has(result.outcomes[destination]) && !state.revealedLadderStarts.has(start)
          ? [start]
          : [],
      );
      return queue.length
        ? { ...state, revealAllQueue: queue, activeLadderStart: queue[0] }
        : { ...state, revealedLadderStarts: new Set(result.orderedNames.map((_, index) => index)) };
    }
    case 'TRACE_FINISHED': {
      if (
        state.phase !== 'result' ||
        state.result.mode !== 'ladder' ||
        state.activeLadderStart === null
      )
        return state;
      const revealed = new Set(state.revealedLadderStarts).add(state.activeLadderStart);
      if (state.revealAllQueue?.[0] !== state.activeLadderStart) {
        return { ...state, revealedLadderStarts: revealed, activeLadderStart: null };
      }
      const remaining = state.revealAllQueue.slice(1);
      return {
        ...state,
        activeLadderStart: remaining[0] ?? null,
        revealAllQueue: remaining.length ? remaining : null,
        revealedLadderStarts: remaining.length
          ? revealed
          : new Set(state.result.orderedNames.map((_, index) => index)),
      };
    }
  }
}
