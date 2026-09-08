import type { DrawResult, PickerMode, PickerSetup } from '../domain/types';
import type { Ladder, LadderRung } from '../domain/draw';
import { readStoredValue, writeStoredValue } from '../../../utils/storage';
import { isIntegerBetween, isRecord } from '../../../utils/validation';

export type PickerSession = PickerSetup & { result: DrawResult | null; revealed: number[] };
const key = (mode: PickerMode) => `ongi.group-picker.session.v1.${mode}`;

function isLabels(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 32
    && value.every(item => typeof item === 'string' && item.trim().length > 0);
}

function samePeople(people: string[], expected: string[]): boolean {
  return people.length === expected.length && new Set(people).size === people.length
    && people.every(name => expected.includes(name));
}

function parseLadder(value: unknown, columnCount: number): Ladder | null {
  if (!isRecord(value) || value.columnCount !== columnCount
    || !isIntegerBetween(value.rowCount, 1, 32) || !Array.isArray(value.rungs)) return null;
  const rowCount = value.rowCount;
  const rungs: LadderRung[] = [];
  for (const rung of value.rungs) {
    if (!isRecord(rung) || !isIntegerBetween(rung.row, 0, rowCount - 1)
      || !isIntegerBetween(rung.leftColumn, 0, columnCount - 2)) return null;
    const { row, leftColumn } = rung;
    if (rungs.some(existing => existing.row === row && Math.abs(existing.leftColumn - leftColumn) <= 1)) return null;
    rungs.push({ row, leftColumn });
  }
  return { columnCount, rowCount, rungs };
}

// v1 records contain fields for every mode. Ignore irrelevant legacy fields
// so existing v2.3.0 results survive this internal type change.
export function parseDrawResult(value: unknown, mode: PickerMode): DrawResult | null {
  if (!isRecord(value) || value.mode !== mode || !isLabels(value.orderedNames)
    || value.orderedNames.length < 2 || new Set(value.orderedNames).size !== value.orderedNames.length) return null;
  const orderedNames = value.orderedNames;
  switch (mode) {
    case 'ladder': {
      const ladder = parseLadder(value.ladder, orderedNames.length);
      return ladder && isLabels(value.outcomes) && value.outcomes.length === orderedNames.length
        ? { mode, orderedNames, ladder, outcomes: value.outcomes } : null;
    }
    case 'lottery':
      return isIntegerBetween(value.winnerCount, 1, orderedNames.length - 1)
        ? { mode, orderedNames, winnerCount: value.winnerCount } : null;
    case 'groups':
    case 'pairs':
      return Array.isArray(value.groups) && value.groups.every(isLabels) && samePeople(value.groups.flat(), orderedNames)
        ? { mode, orderedNames, groups: value.groups } : null;
    case 'supporter': {
      if (!Array.isArray(value.supportAssignments)) return null;
      const supportAssignments: { supporter: string; recipient: string }[] = [];
      for (const assignment of value.supportAssignments) {
        if (!isRecord(assignment) || typeof assignment.supporter !== 'string'
          || typeof assignment.recipient !== 'string' || assignment.supporter === assignment.recipient) return null;
        supportAssignments.push({ supporter: assignment.supporter, recipient: assignment.recipient });
      }
      return samePeople(supportAssignments.map(item => item.supporter), orderedNames)
        && samePeople(supportAssignments.map(item => item.recipient), orderedNames)
        ? { mode, orderedNames, supportAssignments } : null;
    }
    default:
      return { mode, orderedNames };
  }
}

export function parsePickerSession(value: unknown, mode: PickerMode): PickerSession | null {
  if (!isRecord(value) || !isLabels(value.names) || new Set(value.names).size !== value.names.length
    || !isLabels(value.outcomes) || typeof value.nameDraft !== 'string' || typeof value.outcomeDraft !== 'string'
    || !isIntegerBetween(value.winnerCount, 1, 32) || !isIntegerBetween(value.groupCount, 2, 32)) return null;
  const result = value.result === null ? null : parseDrawResult(value.result, mode);
  if (value.result !== null && !result) return null;
  if (!Array.isArray(value.revealed)
    || !value.revealed.every(index => isIntegerBetween(index, 0, (result?.orderedNames.length ?? 0) - 1))) return null;
  return { names: value.names, nameDraft: value.nameDraft, outcomes: value.outcomes, outcomeDraft: value.outcomeDraft,
    winnerCount: value.winnerCount, groupCount: value.groupCount, result, revealed: value.revealed };
}

export function loadPickerSession(mode: PickerMode): PickerSession | null {
  return parsePickerSession(readStoredValue(key(mode)), mode);
}

export function savePickerSession(mode: PickerMode, session: PickerSession): void {
  writeStoredValue(key(mode), session);
}
