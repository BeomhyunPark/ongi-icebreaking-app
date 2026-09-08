import type { Ladder, PrayerSupportAssignment } from './draw';

export type DrawResult = { orderedNames: string[] } & (
  | { mode: 'prayer' | 'sharing' }
  | { mode: 'lottery'; winnerCount: number }
  | { mode: 'ladder'; ladder: Ladder; outcomes: string[] }
  | { mode: 'groups' | 'pairs'; groups: string[][] }
  | { mode: 'supporter'; supportAssignments: PrayerSupportAssignment<string>[] }
);

export type PickerSetup = {
  names: string[];
  nameDraft: string;
  outcomes: string[];
  outcomeDraft: string;
  winnerCount: number;
  groupCount: number;
};

export type PickerMode =
  | 'prayer'
  | 'sharing'
  | 'lottery'
  | 'ladder'
  | 'groups'
  | 'pairs'
  | 'supporter';
