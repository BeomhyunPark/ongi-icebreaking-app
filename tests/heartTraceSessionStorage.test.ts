import { describe, expect, it } from 'vitest';

import { parseHeartTraceSession } from '../src/features/heart-trace/services/sessionStorage';
import { QUESTIONS } from '../src/features/heart-trace/data/questions';

describe('마음의 흔적 진행 상태 저장', () => {
  it('유효한 질문 진행 상태만 복원한다', () => {
    const restored = parseHeartTraceSession(JSON.stringify({
      version: 1,
      state: {
        phase: 'question',
        currentQuestionIndex: 1,
        answers: {
          1: { kind: 'selected', optionId: 'A' },
        },
        result: null,
        tiedTypes: [],
      },
    }));

    expect(restored?.phase).toBe('question');
    expect(restored?.currentQuestionIndex).toBe(1);
    expect(restored?.answers[1]).toEqual({ kind: 'selected', optionId: 'A' });
  });

  it('손상되거나 응답 없이 완료된 저장 상태는 무시한다', () => {
    expect(parseHeartTraceSession('{broken')).toBeNull();
    expect(parseHeartTraceSession(JSON.stringify({
      version: 1,
      state: {
        phase: 'result',
        currentQuestionIndex: 19,
        answers: {},
        result: 'bear',
        tiedTypes: [],
      },
    }))).toBeNull();
  });

  it('모든 응답을 완료한 결과를 복원한다', () => {
    const state = {
      phase: 'result', currentQuestionIndex: 19,
      answers: Object.fromEntries(QUESTIONS.map(q => [q.id, { kind: 'selected', optionId: 'A' }])),
      result: 'bear', tiedTypes: [],
    };
    expect(parseHeartTraceSession(JSON.stringify({ version: 1, state }))).toEqual(state);
  });
});
