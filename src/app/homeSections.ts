import type { Activity, ActivityIntent } from './activityCatalog';

export type HomeIntent = 'all' | ActivityIntent;
export const HOME_INTENTS = [
  ['all', '전체'],
  ['test', '혼자 테스트'],
  ['play', '함께 놀기'],
  ['tools', '모임 도구'],
] as const satisfies ReadonlyArray<readonly [HomeIntent, string]>;

export function selectHomeSections(
  activities: readonly Activity[],
  featured: Activity | null,
  intent: HomeIntent,
) {
  const matches = (activity: Activity) => intent === 'all' || activity.intent === intent;
  const showFeatured = Boolean(
    featured?.available && featured.group === 'play' && featured.intent === 'play' && matches(featured),
  );
  return {
    showFeatured,
    tools: activities.filter(
      (activity) => activity.available && activity.group === 'community-tool' && matches(activity),
    ),
    others: activities.filter(
      (activity) =>
        activity.group === 'play' &&
        activity.intent !== 'test' &&
        matches(activity) &&
        !(showFeatured && activity.id === featured?.id),
    ),
    tests: activities.filter(
      (activity) => activity.group === 'play' && activity.intent === 'test' && matches(activity),
    ),
  };
}
