import {
  GUREUMI_PAGE_SIZE,
  type GureumiAttemptReference,
  type GureumiAttemptState,
  type GureumiQuestion,
  type GureumiResult,
} from '../domain/types';

type Fields = {
  questions: GureumiQuestion[];
  pageIndex: number;
  operation: 'idle' | 'start' | 'resume' | 'complete' | 'feedback';
  error: string;
};
export type GureumiState = Fields &
  (
    | {
        phase: 'booting' | 'intro';
        reference: GureumiAttemptReference | null;
        resumeState: GureumiAttemptState | null;
        result: null;
      }
    | {
        phase: 'questions';
        reference: GureumiAttemptReference;
        resumeState: GureumiAttemptState;
        result: null;
      }
    | {
        phase: 'result' | 'feedback';
        reference: GureumiAttemptReference;
        resumeState: null;
        result: GureumiResult;
      }
  );
export const initialGureumiState: GureumiState = {
  phase: 'booting',
  reference: null,
  resumeState: null,
  result: null,
  questions: [],
  pageIndex: 0,
  operation: 'idle',
  error: '',
};
export type GureumiAction =
  | {
      type: 'RESTORE_INTRO';
      reference: GureumiAttemptReference | null;
      resumeState: GureumiAttemptState | null;
      error?: string;
    }
  | { type: 'BEGIN'; operation: Exclude<Fields['operation'], 'idle'> }
  | {
      type: 'OPEN';
      reference: GureumiAttemptReference;
      attempt: GureumiAttemptState;
      questions: GureumiQuestion[];
    }
  | { type: 'RESULT'; reference: GureumiAttemptReference; result: GureumiResult }
  | { type: 'FEEDBACK'; questions: GureumiQuestion[] }
  | { type: 'BACK_TO_RESULT' }
  | { type: 'PAGE'; direction: -1 | 1 }
  | { type: 'FAILED'; error: string };

const OPERATION_PHASES: Record<
  Exclude<Fields['operation'], 'idle'>,
  readonly GureumiState['phase'][]
> = {
  start: ['intro', 'result', 'feedback'],
  resume: ['intro'],
  complete: ['questions'],
  feedback: ['result'],
};

export function gureumiReducer(state: GureumiState, action: GureumiAction): GureumiState {
  switch (action.type) {
    case 'RESTORE_INTRO':
      if (state.phase !== 'booting') return state;
      return {
        ...initialGureumiState,
        phase: 'intro',
        result: null,
        reference: action.reference,
        resumeState: action.resumeState,
        error: action.error ?? '',
      };
    case 'BEGIN': {
      if (state.operation !== 'idle') return state;
      return OPERATION_PHASES[action.operation].includes(state.phase)
        ? { ...state, operation: action.operation, error: '' }
        : state;
    }
    case 'OPEN':
      if (
        !['start', 'resume'].includes(state.operation) ||
        action.questions.length === 0 ||
        action.attempt.completed
      )
        return state;
      return {
        ...state,
        phase: 'questions',
        reference: action.reference,
        resumeState: action.attempt,
        result: null,
        questions: action.questions,
        pageIndex: Math.min(
          Math.ceil(action.questions.length / GUREUMI_PAGE_SIZE) - 1,
          Math.max(0, Math.floor((action.attempt.nextOrder - 1) / GUREUMI_PAGE_SIZE)),
        ),
        operation: 'idle',
        error: '',
      };
    case 'RESULT':
      if (state.phase !== 'booting' && state.operation !== 'complete') return state;
      return {
        ...state,
        phase: 'result',
        reference: action.reference,
        result: action.result,
        resumeState: null,
        operation: 'idle',
        error: '',
      };
    case 'FEEDBACK':
      if (state.phase !== 'result' || state.operation !== 'feedback') return state;
      return { ...state, phase: 'feedback', questions: action.questions, operation: 'idle' };
    case 'BACK_TO_RESULT':
      return state.phase === 'feedback' && state.operation === 'idle'
        ? { ...state, phase: 'result' }
        : state;
    case 'PAGE':
      if (state.phase !== 'questions' || state.operation !== 'idle') return state;
      return {
        ...state,
        pageIndex: Math.max(
          0,
          Math.min(
            Math.ceil(state.questions.length / GUREUMI_PAGE_SIZE) - 1,
            state.pageIndex + action.direction,
          ),
        ),
      };
    case 'FAILED':
      return { ...state, operation: 'idle', error: action.error };
  }
}
