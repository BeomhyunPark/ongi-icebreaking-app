import { describe, expect, it } from 'vitest';
import { BALANCE_GAME_QUESTIONS } from '../src/features/balance-game/data/questions';
import {
  balanceReducer,
  createBalanceState,
} from '../src/features/balance-game/state/balanceReducer';
import {
  parseBalanceSession,
  restoreBalanceState,
} from '../src/features/balance-game/services/sessionStorage';

const question = BALANCE_GAME_QUESTIONS[0];

describe('밸런스 상태 전이', () => {
  it('빈 질문으로 시작하거나 답변 없이 다음 질문으로 이동할 수 없다', () => {
    const initial = createBalanceState('light');
    expect(balanceReducer(initial, { type: 'START', questions: [] })).toBe(initial);
    const playing = balanceReducer(initial, { type: 'START', questions: [question] });
    expect(balanceReducer(playing, { type: 'NEXT' })).toBe(playing);
    expect(balanceReducer(playing, { type: 'PREVIOUS' }).currentQuestionIndex).toBe(0);
  });

  it('완료, 다시 보기, 온도 변경 시 관련 상태를 함께 전환한다', () => {
    let state = balanceReducer(createBalanceState('light'), {
      type: 'START',
      questions: [question],
    });
    state = balanceReducer(state, { type: 'CHOOSE', side: 'left' });
    state = balanceReducer(state, { type: 'NEXT' });
    expect(state.phase).toBe('complete');
    expect(state.playedQuestionIds).toEqual([question.id]);
    state = balanceReducer(state, { type: 'REVIEW' });
    expect(state.phase).toBe('play');
    expect(state.choices[question.id]).toBe('left');
    expect(balanceReducer(state, { type: 'SELECT_WEIGHT', weight: 'deep' })).toEqual(
      createBalanceState('deep'),
    );
  });

  it('v2.3.0 저장 데이터를 같은 질문과 답변으로 복원한다', () => {
    const saved = {
      phase: 'play',
      selectedQuestionIds: [],
      playedQuestionIds: [],
      questionIds: [question.id],
      index: 0,
      choices: { [question.id]: 'right' },
    };
    const parsed = parseBalanceSession(saved, 'light');
    expect(parsed).toEqual(saved);
    expect(restoreBalanceState('light', parsed)).toMatchObject({
      phase: 'play',
      playQuestions: [question],
      choices: saved.choices,
    });
  });

  it.each([
    null,
    [],
    {},
    {
      phase: 'play',
      questionIds: [],
      selectedQuestionIds: [],
      playedQuestionIds: [],
      index: 0,
      choices: {},
    },
  ])('손상되거나 빈 진행 상태를 거부한다: %j', (saved) => {
    expect(parseBalanceSession(saved, 'light')).toBeNull();
  });
});
