import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../src/app/activityCatalog';
import { selectHomeSections, HOME_INTENTS } from '../src/app/homeSections';

describe('home category metadata', () => {
  it.each(HOME_INTENTS)(
    '%s includes each matching activity exactly once regardless of the featured card',
    (intent) => {
      for (const featured of ACTIVITIES.filter((activity) => activity.group === 'play')) {
        const sections = selectHomeSections(ACTIVITIES, featured, intent);
        const visible = [
          ...sections.tools,
          ...sections.others,
          ...sections.previews,
          ...(sections.showFeatured ? [featured] : []),
        ];
        expect(visible.map(({ id }) => id).sort()).toEqual(
          ACTIVITIES.filter((activity) => intent === 'all' || activity.intent === intent)
            .map(({ id }) => id)
            .sort(),
        );
      }
    },
  );
  it('uses metadata instead of recognizing an activity ID', () => {
    const activities = ACTIVITIES.map((activity) => ({ ...activity, intent: 'test' as const }));
    const sections = selectHomeSections(activities, null, 'test');
    expect([...sections.tools, ...sections.others, ...sections.previews]).toHaveLength(
      activities.length,
    );
    expect(selectHomeSections(activities, null, 'play').others).toEqual([]);
  });
});
