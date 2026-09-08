import type { DrawResult, PickerMode } from '../domain/types';
import { readStoredValue, writeStoredValue } from '../../../utils/storage';

type PickerSession = {
  names: string[];
  nameDraft: string;
  outcomes: string[];
  outcomeDraft: string;
  winnerCount: number;
  groupCount: number;
  result: DrawResult | null;
  revealed: number[];
};

const key = (mode: PickerMode) => `ongi.group-picker.session.v1.${mode}`;
const isNames = (value: unknown): value is string[] => Array.isArray(value)
  && value.length <= 32 && value.every(item => typeof item === 'string' && item.trim().length > 0);
const isCount = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 32;

function isResult(value: unknown, mode: PickerMode): value is DrawResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as DrawResult;
  if (r.mode !== mode || !isNames(r.orderedNames) || r.orderedNames.length < 2
    || new Set(r.orderedNames).size !== r.orderedNames.length || !isCount(r.winnerCount)
    || r.winnerCount >= r.orderedNames.length || !isNames(r.outcomes)
    || !Array.isArray(r.groups) || !r.groups.every(isNames)
    || !Array.isArray(r.supportAssignments)) return false;
  if (mode === 'ladder') {
    const ladder = r.ladder;
    if (!ladder || ladder.columnCount !== r.orderedNames.length
      || !isCount(ladder.rowCount) || !Array.isArray(ladder.rungs)
      || r.outcomes.length !== r.orderedNames.length
      || !ladder.rungs.every(rung => rung && Number.isInteger(rung.row) && rung.row >= 0
        && rung.row < ladder.rowCount && Number.isInteger(rung.leftColumn)
        && rung.leftColumn >= 0 && rung.leftColumn < ladder.columnCount - 1)) return false;
  } else if (r.ladder !== null) return false;
  const samePeople = (people: string[]) => people.length === r.orderedNames.length
    && new Set(people).size === people.length && people.every(name => r.orderedNames.includes(name));
  if ((mode === 'groups' || mode === 'pairs') && !samePeople(r.groups.flat())) return false;
  if (mode === 'supporter' && (!r.supportAssignments.every(a => a && a.supporter !== a.recipient)
    || !samePeople(r.supportAssignments.map(a => a.supporter))
    || !samePeople(r.supportAssignments.map(a => a.recipient)))) return false;
  return true;
}

export function loadPickerSession(mode: PickerMode): PickerSession | null {
  const value = readStoredValue(key(mode)) as Partial<PickerSession> | null;
  if (!value || !isNames(value.names) || new Set(value.names).size !== value.names.length
    || !isNames(value.outcomes) || typeof value.nameDraft !== 'string' || typeof value.outcomeDraft !== 'string'
    || !isCount(value.winnerCount) || !isCount(value.groupCount) || value.groupCount < 2
    || (value.result !== null && !isResult(value.result, mode))
    || !Array.isArray(value.revealed) || !value.revealed.every(index => Number.isInteger(index)
      && index >= 0 && index < (value.result?.orderedNames.length ?? 0))) return null;
  return value as PickerSession;
}

export function savePickerSession(mode: PickerMode, session: PickerSession): void {
  writeStoredValue(key(mode), session);
}
