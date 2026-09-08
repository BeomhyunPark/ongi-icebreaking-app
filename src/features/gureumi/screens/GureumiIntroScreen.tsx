import { useState } from 'react';
import { ShareNotice, useShareNotice } from '../../../components/ShareNotice';

import { getShareTarget } from '../../../app/shareTargets';
import { assetUrl } from '../../../utils/assetUrl';
import {
  buildActivityShareUrl,
  shareAppLink,
} from '../../home/services/shareAppLink';

type GureumiIntroScreenProps = {
  answeredCount: number;
  hasSavedAttempt: boolean;
  busy: boolean;
  error: string;
  onStart: () => void;
  onResume: () => void;
  onStartFresh: () => void;
  onBackHome: () => void;
};

export function GureumiIntroScreen({
  answeredCount,
  hasSavedAttempt,
  busy,
  error,
  onStart,
  onResume,
  onStartFresh,
  onBackHome,
}: GureumiIntroScreenProps) {
  const [sharing, setSharing] = useState(false);
  const { message, clearNotice, reportShare } = useShareNotice();

  const handleShare = async () => {
    if (sharing) return;

    const shareTarget = getShareTarget({ id: 'gureumi' });
    if (!shareTarget) return;

    setSharing(true);
    clearNotice();

    try {
      reportShare(await shareAppLink({
        title: shareTarget.title,
        url: buildActivityShareUrl(shareTarget.slug),
      }));

    } catch { reportShare('failed');
    } finally {
      setSharing(false);
    }
  };

  return (
    <main className="gureumi-screen gureumi-intro">
      <nav className="gureumi-toolbar" aria-label="구르미 테스트 탐색">
        <button type="button" onClick={onBackHome}><span aria-hidden="true">←</span> 홈</button>
        <span>BETA v0.1</span>
      </nav>

      <article className="gureumi-intro__panel" aria-labelledby="gureumi-intro-title">
        <div className="gureumi-intro__badge">BETA 1</div>
        <p className="gureumi-kicker">ONGI · GUREUMI TEST</p>
        <h1 id="gureumi-intro-title">구르미 테스트에<br />오신 걸 환영해요</h1>
        <p className="gureumi-intro__lead">27개의 선택을 따라가며<br />나와 닮은 구르미를 만나보세요.</p>
        <img
          className="gureumi-intro__character"
          src={assetUrl('images/teasers/gureumi-test/sunny.png')}
          alt="환하게 웃는 구르미 쨍이"
        />

        <section className="gureumi-intro__guide" aria-label="Beta 테스트 안내">
          <strong>27문항 · 약 4~5분</strong>
          <p>답변은 익명으로 저장되고,<br />문항과 결과 품질을 개선하는 데 활용돼요.</p>
        </section>

        {hasSavedAttempt ? (
          <section className="gureumi-intro__resume" aria-label="저장된 테스트">
            <strong>이어 하던 테스트가 있어요</strong>
            <p>{answeredCount} / 27개 답변이 안전하게 저장되어 있어요.</p>
            <button type="button" disabled={busy} onClick={onResume}>
              {Math.min(27, answeredCount + 1)}번부터 이어하기
            </button>
            <button className="gureumi-text-button" type="button" disabled={busy} onClick={onStartFresh}>
              새 테스트로 시작하기
            </button>
          </section>
        ) : (
          <button className="gureumi-primary-button" type="button" disabled={busy} onClick={onStart}>
            {busy ? '준비하고 있어요…' : 'Beta 테스트 시작하기'}
          </button>
        )}
        <button
          className="gureumi-intro__share-button"
          type="button"
          disabled={sharing}
          aria-label="구르미 테스트 공유하기"
          onClick={() => void handleShare()}
        >
          <span className="gureumi-intro__share-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="18" cy="5" r="2.25" />
              <circle cx="6" cy="12" r="2.25" />
              <circle cx="18" cy="19" r="2.25" />
              <path d="m8.1 10.8 7.7-4.5M8.1 13.2l7.7 4.5" />
            </svg>
          </span>
          <span>
            <strong>{sharing ? '공유 준비 중…' : '친구에게 공유하기'}</strong>
            <small>구르미 테스트 링크 보내기</small>
          </span>
          <span className="gureumi-intro__share-arrow" aria-hidden="true">↗</span>
        </button>
        <ShareNotice message={message} />
        <p className="gureumi-credit">유형, 문항 디자인 · 권봉준 · hyunee</p>
        <p className="gureumi-credit">기획, UIUX, 개발 · hyunee</p>

        {error ? <p className="gureumi-error" role="alert">{error}</p> : null}
        <p className="gureumi-intro__disclaimer">
          이 테스트는 Cloninger의 기질 이론에서 논의된 일부 개념을 참고해 독자적으로 제작한 놀이형 자기이해 콘텐츠입니다. 정식 TCI 검사 또는 심리학적 진단·평가 도구가 아닙니다.
        </p>
      </article>
    </main>
  );
}
