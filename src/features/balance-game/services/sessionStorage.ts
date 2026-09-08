import { BALANCE_GAME_QUESTIONS } from '../data/questions';
import type { BalanceGameQuestion, BalanceGameWeight } from '../domain/types';
import { createBalanceState, type BalanceState, type Choices } from '../state/balanceReducer';
import { readStoredValue, writeStoredValue } from '../../../utils/storage';
import { isIntegerBetween, isRecord } from '../../../utils/validation';

export type BalanceSession = {
  phase: BalanceState['phase'];
  selectedQuestionIds: readonly string[];
  playedQuestionIds: readonly string[];
  questionIds: readonly string[];
  index: number;
  choices: Choices;
};
const key = (weight: BalanceGameWeight) => `ongi.balance-game.session.v1.${weight}`;

export function parseBalanceSession(
  value: unknown,
  weight: BalanceGameWeight,
): BalanceSession | null {
  if (!isRecord(value)) return null;
  const { phase, questionIds, selectedQuestionIds, playedQuestionIds, index } = value;
  if (phase !== 'setup' && phase !== 'picker' && phase !== 'play' && phase !== 'complete')
    return null;
  const validQuestionIds = new Set(
    BALANCE_GAME_QUESTIONS.filter((question) => question.weight === weight).map(
      (question) => question.id,
    ),
  );
  const validIds = (list: unknown): list is string[] =>
    Array.isArray(list) &&
    new Set(list).size === list.length &&
    list.every((id) => validQuestionIds.has(id));
  if (
    !validIds(questionIds) ||
    !validIds(selectedQuestionIds) ||
    !validIds(playedQuestionIds) ||
    !isIntegerBetween(index, 0, Math.max(0, questionIds.length - 1)) ||
    !isRecord(value.choices)
  )
    return null;
  if ((phase === 'play' || phase === 'complete') && !questionIds.length) return null;
  const choices: Choices = {};
  for (const [id, side] of Object.entries(value.choices)) {
    if (!questionIds.includes(id) || (side !== 'left' && side !== 'right')) return null;
    choices[id] = side;
  }
  return { phase, questionIds, selectedQuestionIds, playedQuestionIds, index, choices };
}

export function restoreBalanceState(
  weight: BalanceGameWeight,
  saved: BalanceSession | null,
): BalanceState {
  if (!saved) return createBalanceState(weight);
  const byId = new Map<string, BalanceGameQuestion>(
    BALANCE_GAME_QUESTIONS.map((question) => [question.id, question]),
  );
  const questions = saved.questionIds.flatMap((id) => {
    const question = byId.get(id);
    return question ? [question] : [];
  });
  const base = {
    weight,
    filter: 'all' as const,
    selectedQuestionIds: saved.selectedQuestionIds,
    playedQuestionIds: saved.playedQuestionIds,
    currentQuestionIndex: saved.index,
    choices: saved.choices,
  };
  if (saved.phase === 'play' || saved.phase === 'complete') {
    const [first, ...rest] = questions;
    return first
      ? { ...base, phase: saved.phase, playQuestions: [first, ...rest] }
      : createBalanceState(weight);
  }
  return { ...base, phase: saved.phase, playQuestions: questions };
}

export function loadBalanceSession(weight: BalanceGameWeight): BalanceSession | null {
  return parseBalanceSession(readStoredValue(key(weight)), weight);
}

export function saveBalanceSession(weight: BalanceGameWeight, session: BalanceSession): void {
  writeStoredValue(key(weight), session);
}
