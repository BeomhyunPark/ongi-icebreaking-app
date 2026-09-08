import { resolveLadder } from '../domain/draw';
import { getSpecialOutcomeValues } from '../domain/outcomes';
import type { DrawResult, PickerMode } from '../domain/types';
import type { GroupPickerResultEntry } from './resultImage';

const RESULT_TITLES: Record<PickerMode, string> = {
  ladder: '사다리 결과',
  groups: '오늘의 나눔 조',
  pairs: '오늘의 원투원 짝',
  sharing: '오늘의 나눔 순서',
  lottery: '오늘의 당첨 결과',
  supporter: '이번 주 내 기도 후원자',
  prayer: '오늘 기도할 사람',
};

function resultEntries(result: DrawResult): GroupPickerResultEntry[] {
  switch (result.mode) {
    case 'ladder': {
      const destinations = resolveLadder(result.ladder);
      const special = getSpecialOutcomeValues(result.outcomes);
      return result.orderedNames.map((name, index) => {
        const value = result.outcomes[destinations[index]];
        return { name, value, special: special.has(value) };
      });
    }
    case 'groups':
    case 'pairs':
      return result.groups.flatMap((group, index) =>
        group.map((name) => ({
          name,
          value: `${index + 1}${result.mode === 'groups' ? '조' : '팀'}`,
        })),
      );
    case 'lottery':
      return result.orderedNames
        .slice(0, result.winnerCount)
        .map((name) => ({ name, value: '당첨', special: true }));
    case 'supporter':
      return result.supportAssignments.map(({ supporter, recipient }) => ({
        name: supporter,
        value: recipient,
      }));
    case 'prayer':
      return [{ name: result.orderedNames[0], value: '기도', special: true }];
    case 'sharing':
      return result.orderedNames.map((name, index) => ({
        name,
        value: `${index + 1}번째`,
        special: index === 0,
      }));
  }
}

export function presentPickerResult(result: DrawResult) {
  return { entries: resultEntries(result), resultTitle: RESULT_TITLES[result.mode] };
}
