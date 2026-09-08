import { resolveLadder } from '../domain/draw';
import { getSpecialOutcomeValues } from '../domain/outcomes';
import type { DrawResult } from '../domain/types';
import type { GroupPickerResultEntry } from './resultImage';

export function presentPickerResult(result: DrawResult) {
  const destinations = result.mode === 'ladder' ? resolveLadder(result.ladder) : [];
  const specialOutcomeValues = getSpecialOutcomeValues(result.mode === 'ladder' ? result.outcomes : []);
      const entries: GroupPickerResultEntry[] = result.mode === 'ladder'
        ? result.orderedNames.map((name, index) => {
            const value = result.outcomes[destinations[index]];
            return { name, value, special: specialOutcomeValues.has(value) };
          })
        : result.mode === 'groups' || result.mode === 'pairs'
          ? result.groups.flatMap((group, groupIndex) => group.map((name) => ({ name, value: `${groupIndex + 1}${result.mode === 'groups' ? '조' : '팀'}` })))
          : result.mode === 'lottery'
          ? result.orderedNames.slice(0, result.winnerCount).map((name) => ({ name, value: '당첨', special: true }))
          : result.mode === 'supporter'
            ? result.supportAssignments.map(({ supporter, recipient }) => ({ name: supporter, value: recipient }))
          : result.mode === 'prayer'
            ? [{ name: result.orderedNames[0], value: '기도', special: true }]
            : result.orderedNames.map((name, index) => ({ name, value: `${index + 1}번째`, special: index === 0 }));
      const resultTitle = result.mode === 'ladder'
        ? '사다리 결과'
        : result.mode === 'groups'
          ? '오늘의 나눔 조'
        : result.mode === 'pairs'
          ? '오늘의 원투원 짝'
        : result.mode === 'sharing'
          ? '오늘의 나눔 순서'
          : result.mode === 'lottery'
            ? '오늘의 당첨 결과'
            : result.mode === 'supporter'
              ? '이번 주 내 기도 후원자'
              : '오늘 기도할 사람';

  return { entries, resultTitle };
}
