import { memo, type CSSProperties } from 'react';

import type { ActivityTarget } from '../app/activityNavigation';
import { getShareTarget } from '../app/shareTargets';
import {
  buildActivityShareUrl,
  shareAppLink,
} from '../features/home/services/shareAppLink';
import { getEngagementContentCode } from '../engagement/contentCodes';
import { recordShareClick } from '../engagement/tracker';

type ActivityShareButtonProps = {
  target: ActivityTarget;
};

export const ActivityShareButton = memo(function ActivityShareButton({
  target,
}: ActivityShareButtonProps) {
  const shareTarget = getShareTarget(target);
  const contentCode = getEngagementContentCode(target);

  if (!shareTarget && !contentCode) {
    return null;
  }

  const handleShare = async () => {
    if (!shareTarget) return;

    const result = await shareAppLink({
      title: shareTarget.title,
      url: buildActivityShareUrl(shareTarget.slug),
    });
    if (contentCode && (result === 'shared' || result === 'copied')) {
      void recordShareClick(contentCode, result === 'shared' ? 'native' : 'copy_link');
    }
  };

  const accent = shareTarget?.accent ?? '#ffc98f';
  const secondary = shareTarget?.secondary ?? '#f48faa';

  return (
    <div
      className="activity-link-share"
      style={{
        '--activity-share-accent': accent,
        '--activity-share-secondary': secondary,
      } as CSSProperties}
    >
      {shareTarget ? (
        <button
          type="button"
          aria-label={`${shareTarget.label} 링크 공유하기`}
          onClick={handleShare}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
          </svg>
        </button>
      ) : null}
    </div>
  );
});
