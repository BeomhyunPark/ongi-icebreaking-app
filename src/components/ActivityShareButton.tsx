import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';

import type { ActivityTarget } from '../app/activityNavigation';
import { getShareTarget } from '../app/shareTargets';
import {
  buildActivityShareUrl,
  shareAppLink,
  type ShareAppLinkResult,
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
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [feedback, setFeedback] = useState('');
  const mutation = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    const revision = mutation.current;
    setReady(false);
    setError('');

    void getContentLike(contentCode, variantCode)
      .then((state) => {
        if (active && revision === mutation.current) {
          setLikeState(state);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setError('좋아요를 불러오지 못했어요. 다시 시도해주세요.');
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
    setError('');
    setFeedback('');
    try {
      setLikeState(await setContentLike(contentCode, variantCode, nextLiked));
      setFeedback(nextLiked ? '좋아요를 저장했어요. 다음에 방문해도 유지돼요.' : '좋아요를 취소했어요. 누적 수에서 1개가 빠져요.');
    } catch {
      setLikeState(previous);
      setError('좋아요를 반영하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      pending.current = false;
      setLikeBusy(false);
    }
  };

  return (
    <>
      <p aria-live="polite" aria-atomic="true">{error || feedback}</p>
      <button
        className={`activity-link-share__like${likeState?.liked ? ' is-liked' : ''}`}
        type="button"
        disabled={likeBusy || (!ready && !error)}
        aria-busy={likeBusy}
        title={ready ? (likeState?.liked ? '이미 좋아요를 눌렀어요. 다시 누르면 취소돼요.' : '전체 기간 누적 좋아요') : undefined}
        aria-label={!ready
          ? (error ? '좋아요 다시 불러오기' : '좋아요 정보 불러오는 중')
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
  const [message, setMessage] = useState('');
  const shareTarget = getShareTarget(target);
  const contentCode = getEngagementContentCode(target);
  const variantCode = getEngagementLikeVariant(target);

  useEffect(() => {
    setMessage('');
  }, [shareTarget?.slug]);

  if (!shareTarget && !contentCode) {
    return null;
  }

  const handleShare = async () => {
    if (!shareTarget) return;

    const result = await shareAppLink({
      title: shareTarget.title,
      url: buildActivityShareUrl(shareTarget.slug),
    });
    const messages: Partial<Record<ShareAppLinkResult, string>> = {
      shared: `${shareTarget.label} 링크를 공유했어요.`,
      copied: `${shareTarget.label} 링크를 복사했어요.`,
      failed: '링크를 복사하지 못했어요.',
    };

    if (result !== 'cancelled') {
      setMessage(messages[result] ?? '');
      if (contentCode && (result === 'shared' || result === 'copied')) {
        void recordShareClick(contentCode, result === 'shared' ? 'native' : 'copy_link');
      }
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
      <p aria-live="polite" aria-atomic="true">{message}</p>
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
