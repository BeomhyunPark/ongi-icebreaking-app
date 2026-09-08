import { createLadder, createPrayerSupportAssignments, shuffle, splitIntoGroups, splitIntoPairs, type RandomSource } from './draw';
import { MAX_PARTICIPANTS, mergeItems, parseItems } from './items';
import type { DrawResult, PickerMode, PickerSetup } from './types';

export type PreparedDraw =
  | { ok: false; setup: PickerSetup; error: string }
  | { ok: true; setup: PickerSetup; result: DrawResult };

export function prepareDraw(mode: PickerMode, setup: PickerSetup, random?: RandomSource): PreparedDraw {
  if (setup.names.length + parseItems(setup.nameDraft).length > MAX_PARTICIPANTS) {
    return { ok: false, setup, error: '최대 32명까지 참여할 수 있어요. 입력한 명단을 확인해 주세요.' };
  }
  const names = mergeItems(setup.names, setup.nameDraft, MAX_PARTICIPANTS);
  const outcomes = mergeItems(setup.outcomes, setup.outcomeDraft, MAX_PARTICIPANTS, true);
  const nextSetup = { ...setup, names, outcomes, nameDraft: '', outcomeDraft: '' };
  if (names.length < 2) {
    return { ok: false, setup: nextSetup, error: '함께할 사람을 두 명 이상 추가해 주세요.' };
  }
  if (mode === 'ladder' && outcomes.length > 0 && outcomes.length !== names.length) {
    return { ok: false, setup: nextSetup, error: `결과를 ${names.length}개 모두 추가해 주세요.` };
  }

  const orderedNames = mode === 'ladder' ? names : shuffle(names, random);
  let result: DrawResult;
  switch (mode) {
    case 'ladder':
      result = { mode, orderedNames, ladder: createLadder(names.length, random),
        outcomes: outcomes.length ? outcomes : names.map((_, index) => `${index + 1}번`) };
      break;
    case 'groups':
      result = { mode, orderedNames, groups: splitIntoGroups(names, Math.min(setup.groupCount, names.length), random) };
      break;
    case 'pairs':
      result = { mode, orderedNames, groups: splitIntoPairs(names, random) };
      break;
    case 'supporter':
      result = { mode, orderedNames, supportAssignments: createPrayerSupportAssignments(names, random) };
      break;
    case 'lottery':
      result = { mode, orderedNames, winnerCount: Math.min(setup.winnerCount, names.length - 1) };
      break;
    default:
      result = { mode, orderedNames };
  }
  return { ok: true, setup: nextSetup, result };
}
