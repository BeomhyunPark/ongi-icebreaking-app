import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';

import type { ActivityTarget } from '../app/activityNavigation';
import { getShareTarget } from '../app/shareTargets';
import {
  buildActivityShareUrl,
  shareAppLink,
} from '../features/home/services/shareAppLink';
import { getEngagementContentCode } from '../engagement/contentCodes';
import {
  getCachedContentLike,
  getContentLike,
  recordShareClick,
  setContentLike,
} from '../engagement/tracker';
import { getEngagementLikeVariant } from '../engagement/likeVariants';
import type { EngagementContentCode, LikeResponse } from '../engagement/types';

type ActivityShareButtonProps = {
  target: ActivityTarget;
};

type ActivityLikeButtonProps = {
  contentCode: EngagementContentCode;
  variantCode: string;
};

const ActivityLikeButton = memo(function ActivityLikeButton({
  contentCode,
  variantCode,
}: ActivityLikeButtonProps) {
  const [likeState, setLikeState] = useState<LikeResponse | null>(() => (
    getCachedContentLike(contentCode, variantCode)
  ));
  const [likeBusy, setLikeBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const mutation = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    const revision = mutation.current;
    setReady(false);
    setLoadFailed(false);

    void getContentLike(contentCode, variantCode)
      .then((state) => {
        if (active && revision === mutation.current) {
          setLikeState(state);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });

    return () => { active = false; };
  }, [contentCode, variantCode, reload]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && !pending.current) {
        setReload((value) => value + 1);
      }
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const handleLike = async () => {
    if (!likeState || !ready || pending.current) return;
    pending.current = true;
    mutation.current += 1;

    const previous = likeState;
    const nextLiked = !previous.liked;
    setLikeState({
      variantCode,
      liked: nextLiked,
      likeCount: Math.max(0, previous.likeCount + (nextLiked ? 1 : -1)),
    });
    setLikeBusy(true);
    setLoadFailed(false);
    try {
      setLikeState(await setContentLike(contentCode, variantCode, nextLiked));
    } catch {
      setLikeState(previous);
    } finally {
      pending.current = false;
      setLikeBusy(false);
    }
  };

  return (
    <>
      <button
        className={`activity-link-share__like${likeState?.liked ? ' is-liked' : ''}`}
        type="button"
        disabled={likeBusy || (!ready && !loadFailed)}
        aria-busy={likeBusy}
        aria-label={!ready
          ? (loadFailed ? '좋아요 다시 불러오기' : '좋아요 정보 불러오는 중')
          : `좋아요 ${likeState?.liked ? '취소' : '추가'} · 현재 ${likeState?.likeCount ?? 0}개`}
        aria-pressed={likeState?.liked ?? false}
        onClick={ready ? handleLike : () => setReload((value) => value + 1)}
      >
        <span aria-hidden="true">{likeState?.liked ? '♥' : '♡'}</span>
        {likeState ? (
          <small aria-hidden="true">{likeState.likeCount}</small>
        ) : null}
      </button>
    </>
  );
});

export const ActivityShareButton = memo(function ActivityShareButton({
  target,
}: ActivityShareButtonProps) {
  const shareTarget = getShareTarget(target);
  const contentCode = getEngagementContentCode(target);
  const variantCode = getEngagementLikeVariant(target);

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
      {contentCode ? (
        <ActivityLikeButton
          contentCode={contentCode}
          variantCode={variantCode}
          key={`${contentCode}:${variantCode}`}
        />
      ) : null}
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
