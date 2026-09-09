import { describe, expect, it } from 'vitest';
import {
  gureumiReducer as reduce,
  initialGureumiState,
  type GureumiState,
} from '../src/features/gureumi/state/gureumiReducer';
import type { GureumiAttemptState, GureumiResult } from '../src/features/gureumi/domain/types';

const reference = { attemptId: 'attempt', resumeToken: 'token' };
const attempt: GureumiAttemptState = {
  attemptId: 'attempt',
  version: 'v01',
  attemptNo: 1,
  completed: false,
  answeredCount: 0,
  nextOrder: 1,
  answers: [],
  startedAt: '',
};
const questions = Array.from({ length: 27 }, (_, index) => ({
  questionId: `q${index}`,
  order: index + 1,
  prompt: '',
  optionA: '',
  optionB: '',
}));
const result: GureumiResult = {
  attemptId: 'attempt',
  version: 'v01',
  resultType: 'ARONG',
  characterKey: 'arong',
  displayName: '아롱',
  axes: [],
};
const intro = () =>
  reduce(initialGureumiState, { type: 'RESTORE_INTRO', reference: null, resumeState: null });
const opened = () =>
  reduce(reduce(intro(), { type: 'BEGIN', operation: 'start' }), {
    type: 'OPEN',
    reference,
    attempt,
    questions,
  });

describe('Gureumi phase transitions', () => {
  it('rejects feedback/result without a completed attempt and rejects duplicate starts', () => {
    const state = intro();
    expect(reduce(state, { type: 'BACK_TO_RESULT' })).toBe(state);
    expect(reduce(state, { type: 'FEEDBACK', questions })).toBe(state);
    expect(reduce(state, { type: 'RESULT', reference, result })).toBe(state);
    const starting = reduce(state, { type: 'BEGIN', operation: 'start' });
    expect(reduce(starting, { type: 'BEGIN', operation: 'start' })).toBe(starting);
  });
  it('bounds pages and blocks navigation during completion', () => {
    let state = opened();
    expect(reduce(state, { type: 'PAGE', direction: -1 }).pageIndex).toBe(0);
    for (let i = 0; i < 50; i++) state = reduce(state, { type: 'PAGE', direction: 1 });
    expect(state.pageIndex).toBe(5);
    const completing = reduce(state, { type: 'BEGIN', operation: 'complete' });
    expect(reduce(completing, { type: 'PAGE', direction: -1 })).toBe(completing);
  });
  it('opens result and feedback atomically and preserves result when retest fails', () => {
    let state = reduce(reduce(opened(), { type: 'BEGIN', operation: 'complete' }), {
      type: 'RESULT',
      reference,
      result,
    });
    expect(state.phase).toBe('result');
    expect(state.resumeState).toBeNull();
    state = reduce(reduce(state, { type: 'BEGIN', operation: 'feedback' }), {
      type: 'FEEDBACK',
      questions,
    });
    expect(state.phase).toBe('feedback');
    state = reduce(state, { type: 'BACK_TO_RESULT' });
    state = reduce(reduce(state, { type: 'BEGIN', operation: 'start' }), {
      type: 'FAILED',
      error: 'offline',
    });
    expect(state).toMatchObject({
      phase: 'result',
      result,
      reference,
      operation: 'idle',
      error: 'offline',
    });
  });
  it('clamps resumed pages and rejects empty or completed question sets', () => {
    const state = reduce(intro(), { type: 'BEGIN', operation: 'resume' });
    expect(reduce(state, { type: 'OPEN', reference, attempt, questions: [] })).toBe(state);
    expect(
      reduce(state, {
        type: 'OPEN',
        reference,
        attempt: { ...attempt, completed: true },
        questions,
      }),
    ).toBe(state);
    expect(
      reduce(state, { type: 'OPEN', reference, attempt: { ...attempt, nextOrder: 100 }, questions })
        .pageIndex,
    ).toBe(5);
  });
  it('retest clears old result, questions and page when the new attempt opens', () => {
    const completed: GureumiState = {
      ...opened(),
      phase: 'result',
      reference,
      resumeState: null,
      result,
    };
    const state = reduce(reduce(completed, { type: 'BEGIN', operation: 'start' }), {
      type: 'OPEN',
      reference: { ...reference, attemptId: 'new' },
      attempt,
      questions: questions.slice(0, 5),
    });
    expect(state).toMatchObject({
      phase: 'questions',
      result: null,
      pageIndex: 0,
      reference: { attemptId: 'new' },
    });
    expect(state.questions).toHaveLength(5);
  });
});
