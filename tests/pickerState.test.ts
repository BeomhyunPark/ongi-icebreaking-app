import { describe, expect, it } from 'vitest';
import { prepareDraw } from '../src/features/group-picker/domain/prepareDraw';
import type { PickerMode, PickerSetup } from '../src/features/group-picker/domain/types';
import { createPickerState, pickerReducer } from '../src/features/group-picker/state/pickerReducer';
import { parseDrawResult, parsePickerSession } from '../src/features/group-picker/services/sessionStorage';

const setup: PickerSetup = { names: ['민수', '지현', '은혜'], nameDraft: '', outcomes: [], outcomeDraft: '', winnerCount: 1, groupCount: 2 };
const modes: PickerMode[] = ['prayer', 'sharing', 'lottery', 'ladder', 'groups', 'pairs', 'supporter'];

describe('뽑기 상태와 저장 호환성', () => {
  it.each(modes)('%s 모드의 v2.3.0 결과와 새 결과를 복원한다', mode => {
    const prepared = prepareDraw(mode, setup, () => 0.25);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error('Expected valid draw');
    const legacy = { winnerCount: 1, ladder: null, outcomes: [], groups: [], supportAssignments: [], ...prepared.result };
    expect(parseDrawResult(legacy, mode)).toEqual(prepared.result);
    expect(parsePickerSession({ ...setup, result: legacy, revealed: [] }, mode)?.result).toEqual(prepared.result);
    expect(parseDrawResult(JSON.parse(JSON.stringify(prepared.result)), mode)).toEqual(prepared.result);
  });

  it('초기화 시 결과와 사다리 공개 상태를 함께 제거하고 늦은 타이머는 무시한다', () => {
    const initial = createPickerState('ladder', setup);
    let state = pickerReducer(initial, { type: 'PREPARE_DRAW', prepared: prepareDraw('ladder', setup, () => 0.25) });
    state = pickerReducer(state, { type: 'DRAW_FINISHED' });
    state = pickerReducer(state, { type: 'REVEAL_START', index: 0 });
    state = pickerReducer(state, { type: 'RESET_TO_SETUP' });
    expect(state.phase).toBe('setup');
    expect(state.result).toBeNull();
    expect(state.activeLadderStart).toBeNull();
    expect(state.revealedLadderStarts.size).toBe(0);
    expect(pickerReducer(state, { type: 'TRACE_FINISHED' })).toBe(state);
    expect(pickerReducer(state, { type: 'DRAW_FINISHED' })).toBe(state);
  });

  it('인원 초과 시 입력과 기존 참가자를 보존한다', () => {
    const overflow = { ...setup, names: Array.from({ length: 32 }, (_, index) => `${index}`), nameDraft: '추가' };
    expect(prepareDraw('prayer', overflow)).toMatchObject({ ok: false, setup: overflow });
  });

  it.each([null, [], 1, 'bad', {}, { mode: 'ladder', orderedNames: setup.names, ladder: {} }])('손상된 결과를 거부한다: %j', value => {
    expect(parseDrawResult(value, 'ladder')).toBeNull();
  });
});
