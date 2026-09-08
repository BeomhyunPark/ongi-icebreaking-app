import type { Ladder, PrayerSupportAssignment } from './draw';

export type DrawResult = {
  mode: PickerMode;
  orderedNames: string[];
  winnerCount: number;
  ladder: Ladder | null;
  outcomes: string[];
  groups: string[][];
  supportAssignments: PrayerSupportAssignment<string>[];
};

export type PickerMode =
  | 'prayer'
  | 'sharing'
  | 'lottery'
  | 'ladder'
  | 'groups'
  | 'pairs'
  | 'supporter';
