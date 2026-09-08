import { lazy } from 'react';

import type { ActivityId } from './activityCatalog';

const loadHeartTraceApp = async () => {
  const module = await import('../features/heart-trace/HeartTraceApp');

  return { default: module.HeartTraceApp };
};
const HeartTraceApp = lazy(loadHeartTraceApp);
const loadBalanceGameApp = async () => {
  const module = await import('../features/balance-game/BalanceGameApp');

  return { default: module.BalanceGameApp };
};
const BalanceGameApp = lazy(loadBalanceGameApp);
const loadIdealWorldCupApp = async () => {
  const module = await import('../features/ideal-world-cup/IdealWorldCupApp');

  return { default: module.IdealWorldCupApp };
};
const IdealWorldCupApp = lazy(loadIdealWorldCupApp);
const loadGroupPickerApp = async () => {
  const module = await import('../features/group-picker/GroupPickerApp');

  return { default: module.GroupPickerApp };
};
const GroupPickerApp = lazy(loadGroupPickerApp);
const loadAnonymousSharingApp = async () => {
  const module = await import('../features/anonymous-sharing/AnonymousSharingApp');

  return { default: module.AnonymousSharingApp };
};
const AnonymousSharingApp = lazy(loadAnonymousSharingApp);
const loadGureumiApp = async () => {
  const module = await import('../features/gureumi/GureumiApp');

  return { default: module.GureumiApp };
};
const GureumiApp = lazy(loadGureumiApp);

const ACTIVITY_REGISTRY = {
  'heart-trace': {
    id: 'heart-trace',
    Component: HeartTraceApp,
    preload: loadHeartTraceApp,
  },
  'balance-game': {
    id: 'balance-game',
    Component: BalanceGameApp,
    preload: loadBalanceGameApp,
  },
  'ideal-world-cup': {
    id: 'ideal-world-cup',
    Component: IdealWorldCupApp,
    preload: loadIdealWorldCupApp,
  },
  'group-picker': {
    id: 'group-picker',
    Component: GroupPickerApp,
    preload: loadGroupPickerApp,
  },
  'anonymous-sharing': {
    id: 'anonymous-sharing',
    Component: AnonymousSharingApp,
    preload: loadAnonymousSharingApp,
  },
  gureumi: {
    id: 'gureumi',
    Component: GureumiApp,
    preload: loadGureumiApp,
  },
} as const;

export function getActivityDefinition<Id extends ActivityId>(activityId: Id) {
  return ACTIVITY_REGISTRY[activityId];
}

export function preloadActivity(activityId: ActivityId): Promise<void> {
  const activity = getActivityDefinition(activityId);

  if (activity === null) {
    return Promise.resolve();
  }

  return activity.preload().then(() => undefined);
}
