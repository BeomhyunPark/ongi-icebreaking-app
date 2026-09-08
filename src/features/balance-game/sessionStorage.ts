import { BALANCE_GAME_QUESTIONS } from './data/questions';
import type { BalanceGameWeight } from './domain/types';
import { readStoredValue, writeStoredValue } from '../../utils/storage';

export type BalanceSession = {
  phase: 'setup' | 'picker' | 'play' | 'complete';
  selectedQuestionIds: readonly string[];
  playedQuestionIds: readonly string[];
  questionIds: readonly string[];
  index: number;
  choices: Record<string, 'left' | 'right'>;
};
const key = (weight: BalanceGameWeight) => `ongi.balance-game.session.v1.${weight}`;

export function loadBalanceSession(weight: BalanceGameWeight): BalanceSession | null {
  const value = readStoredValue(key(weight)) as BalanceSession | null;
  const ids = new Set(BALANCE_GAME_QUESTIONS.filter(q => q.weight === weight).map(q => q.id));
  const validIds = (list: unknown): list is string[] => Array.isArray(list)
    && new Set(list).size === list.length && list.every(id => ids.has(id));
  if (!value || !['setup', 'picker', 'play', 'complete'].includes(value.phase)
    || !validIds(value.questionIds) || !validIds(value.selectedQuestionIds) || !validIds(value.playedQuestionIds)
    || !Number.isInteger(value.index) || value.index < 0
    || !value.choices || typeof value.choices !== 'object' || Array.isArray(value.choices)
    || !Object.entries(value.choices).every(([id, side]) => value.questionIds.includes(id) && ['left', 'right'].includes(side))
    || (['play', 'complete'].includes(value.phase) && value.index >= value.questionIds.length)) return null;
  return value;
}

export function saveBalanceSession(weight: BalanceGameWeight, value: BalanceSession): void {
  writeStoredValue(key(weight), value);
}
