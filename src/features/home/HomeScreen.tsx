import { useEffect, useState } from 'react';

import { ACTIVITIES, type Activity, type ActivityId } from '../../app/activityCatalog';
import { BrandMark } from '../../components/BrandMark';
import { ScreenLayout } from '../../components/ScreenLayout';
import { PICKER_SHORTCUTS } from '../group-picker/domain/modeCatalog';
import type { PickerMode } from '../group-picker/domain/types';
import { assetUrl } from '../../utils/assetUrl';
import { InstallAppPrompt } from './components/InstallAppPrompt';
import { ShareApp } from './components/ShareApp';
import { getCachedVisitorCount, getVisitorCount } from '../../engagement/tracker';

type HomeScreenProps = {
  featuredActivityId: ActivityId | null;
  onOpenUpdates: () => void;
  onSelectActivity: (activityId: ActivityId, initialGroupPickerMode?: PickerMode) => void;
};

const ACTIVITY_MARKS: Record<ActivityId, string> = {
  'heart-trace': '✦',
  'gureumi': '☁',
  'balance-game': 'VS',
  'ideal-world-cup': '★',
  'group-picker': '?',
  'anonymous-sharing': '♡',
};

export function pickFeaturedActivity(
  activities: readonly Activity[],
  previousActivityId: ActivityId | null,
  random = Math.random,
): Activity | null {
  const playActivities = activities.filter((activity) => (
    activity.available && activity.group === 'play'
  ));
  const newActivities = playActivities.filter((activity) => activity.badge === 'NEW');
  const candidates = newActivities.length > 1
    ? newActivities.filter((activity) => activity.id !== previousActivityId)
    : newActivities;
  const pool = candidates.length > 0 ? candidates : playActivities;

  if (pool.length === 0) {
    return null;
  }

  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export function HomeScreen({
  featuredActivityId,
  onOpenUpdates,
  onSelectActivity,
}: HomeScreenProps) {
  const [visitorCount, setVisitorCount] = useState<number | null>(getCachedVisitorCount);
  const [intent, setIntent] = useState<'all' | 'test' | 'play' | 'tools'>('all');
  const featuredActivity = ACTIVITIES.find(({ id }) => id === featuredActivityId) ?? null;
  const communityTools = ACTIVITIES.filter((activity) => (
    activity.available && activity.group === 'community-tool'
  ));
  const otherPlayActivities = ACTIVITIES.filter((activity) => (
    activity.group === 'play' && activity.id !== featuredActivity?.id
    && (intent !== 'test' || activity.id === 'heart-trace')
    && (intent !== 'play' || activity.id !== 'heart-trace')
  ));

  useEffect(() => {
    let active = true;

    void getVisitorCount()
      .then((count) => {
        if (active) setVisitorCount(count);
      })
      .catch(() => {
        // 방문자 수 조회 실패는 홈 이용을 방해하지 않는다.
      });

    return () => { active = false; };
  }, []);

  if (!featuredActivity) {
    return null;
  }

  return (
    <ScreenLayout className={`home-screen${intent === 'all' ? '' : ' home-screen--filtered'}`}>
      <header className="home-hero">
        <div className="home-brand" aria-label="온기">
          <BrandMark />
          <span className="home-brand__copy">
            <strong>온기</strong>
          </span>
          <span
            className="home-brand__visitors"
            aria-label={visitorCount === null ? '누적 방문자 집계 중' : `누적 방문자 ${visitorCount}명`}
            aria-live="polite"
          >
            <small>누적 방문자</small>
            <b>{visitorCount === null ? '—' : visitorCount.toLocaleString('ko-KR')}</b>
          </span>
        </div>
        <div className="home-hero__message">
          <p className="home-hero__kicker">ICE BREAKING</p>
          <h1>우리 사이에 온기를</h1>
          <p className="home-hero__description">
            어색함은 덜고,<br/>
            하나님 안에서 서로를 더 알아가는 시간을 가져보세요.
          </p>
        </div>
      </header>

      <nav className="home-intents" aria-label="콘텐츠 고르기">
        {([['all', '전체'], ['test', '혼자 테스트'], ['play', '함께 놀기'], ['tools', '모임 도구']] as const).map(([id, label]) => (
          <button type="button" key={id} aria-pressed={intent === id} onClick={() => setIntent(id)}>{label}</button>
        ))}
      </nav>

      {intent === 'all' || intent === 'tools' ? (
      <section className="home-section home-section--community-tools" aria-labelledby="community-tools-title">
        <div className="home-section__meta">
          <p>모임마다 다시 찾게 되는</p>
          <span aria-hidden="true">01</span>
        </div>
        <h2 id="community-tools-title">공동체를 위한 도구</h2>

        <div className="community-tool-list">
          {communityTools.map((activity) => (
            <article
              className={`community-tool-card community-tool-card--${activity.id}`}
              key={activity.id}
            >
              <button
                className="community-tool-card__open"
                type="button"
                aria-labelledby={`community-tool-title-${activity.id}`}
                aria-describedby={activity.id === 'group-picker'
                  ? `community-tool-description-${activity.id} community-tool-features-${activity.id}`
                  : `community-tool-description-${activity.id}`}
                onClick={() => onSelectActivity(activity.id)}
              />
              <span className="community-tool-card__topline">
                <span>{activity.kind}</span>
                <b>모임 필수 도구</b>
              </span>
              <span className="community-tool-card__main">
                <span className="community-tool-card__visual" aria-hidden="true">
                  {ACTIVITY_MARKS[activity.id]}
                </span>
                <span className="community-tool-card__copy">
                  <strong id={`community-tool-title-${activity.id}`}>{activity.title}</strong>
                  <span id={`community-tool-description-${activity.id}`}>{activity.description}</span>
                </span>
              </span>
              {activity.id === 'group-picker' ? (
                <span
                  className="community-tool-card__features"
                  id={`community-tool-features-${activity.id}`}
                >
                  {PICKER_SHORTCUTS.map(({ id: mode, shortcutLabel }) => (
                    <button
                      className="community-tool-shortcut"
                      type="button"
                      onClick={() => onSelectActivity(activity.id, mode)}
                      key={mode}
                    >
                      {shortcutLabel}
                    </button>
                  ))}
                </span>
              ) : null}
              <span className="community-tool-card__action">
                {activity.id === 'group-picker' ? '전체 도구 보기' : '모임 시작하기'}
              </span>
            </article>
          ))}
        </div>
      </section>

      ) : null}

      {intent === 'all' || intent === 'play' ? (
      <section className="home-section" aria-labelledby="featured-title">
        <div className="home-section__meta">
          <p>지금 바로 해봐요</p>
          <span aria-hidden="true">02</span>
        </div>
        <h2 id="featured-title">추천 놀거리</h2>

        <button
          className={`featured-activity featured-activity--${featuredActivity.id}`}
          type="button"
          aria-label={featuredActivity.title}
          disabled={!featuredActivity.available}
          onClick={() => onSelectActivity(featuredActivity.id)}
        >
          <span className="activity-card activity-card--featured">
            <span className="activity-card__kind">
              {featuredActivity.kind}
              {featuredActivity.badge ? ` · ${featuredActivity.badge}` : null}
            </span>
            <strong>{featuredActivity.title}</strong>
            <span className="activity-card__description">
              {featuredActivity.description}
            </span>
            <small>{featuredActivity.meta}</small>
            <b className="activity-card__start">시작하기</b>
          </span>
        </button>
      </section>

      ) : null}

      {intent !== 'tools' ? (
      <section className="home-section home-section--upcoming" aria-labelledby="more-title">
        <div className="home-section__meta">
          <p>취향대로 골라봐요</p>
          <span aria-hidden="true">03</span>
        </div>
        <h2 id="more-title">{intent === 'test' ? '성격 테스트' : '다른 놀거리'}</h2>

        <div className="activity-grid">
          {otherPlayActivities.map((activity) => {
            const content = (
              <>
                <span className="activity-card__mini-visual" aria-hidden="true">
                  {ACTIVITY_MARKS[activity.id]}
                </span>
                <span className="activity-card__compact-copy">
                  <span className="activity-card__topline">
                    {activity.kind}
                    {activity.badge ? ` · ${activity.badge}` : null}
                  </span>
                  <h3>{activity.title}</h3>
                  <p>{activity.description}</p>
                </span>
                <span className="activity-card__action" aria-hidden="true">
                  {activity.available ? '시작하기' : '준비 중'}
                </span>
              </>
            );

            if (activity.available) {
              return (
                <button
                  className={`activity-card activity-card--${activity.id} activity-card--available`}
                  type="button"
                  aria-label={activity.title}
                  onClick={() => onSelectActivity(activity.id)}
                  key={activity.id}
                >
                  {content}
                </button>
              );
            }

            return (
              <article className={`activity-card activity-card--${activity.id}`} key={activity.id}>
                {content}
              </article>
            );
          })}
        </div>
      </section>

      ) : null}

      {intent === 'all' || intent === 'test' ? (
      <section className="home-section home-section--preview" aria-labelledby="preview-title">
        <div className="home-section__meta">
          <p>먼저 경험해 주세요</p>
          <span aria-hidden="true">04</span>
        </div>
        <h2 id="preview-title">Beta 테스트</h2>

        <button
          className="gureumi-home-teaser"
          type="button"
          aria-label="구르미 Beta 테스트 시작하기"
          onClick={() => onSelectActivity('gureumi')}
        >
          <span className="gureumi-home-teaser__copy">
            <small>GUREUMI · BETA v0.1</small>
            <strong>구르미 테스트</strong>
            <span>27개의 선택을 따라가며<br />나와 닮은 구르미를 만나보세요.</span>
            <b>Beta 참여하기</b>
          </span>
          <span className="gureumi-home-teaser__preview" aria-hidden="true">
            <img
              src={assetUrl('images/teasers/gureumi-test/teaser.png')}
              alt=""
            />
          </span>
        </button>
      </section>

      ) : null}

      <InstallAppPrompt />

      <footer className="home-footer">
        <span aria-hidden="true">✦</span>
        <p>
          아이스브레이킹앱, by hyunee{' '}
          <button className="home-footer__updates" type="button" onClick={onOpenUpdates}>
            v{__APP_VERSION__} · 업데이트 내역
          </button>
        </p>
        <div className="home-footer__actions">
          <details className="creator-contact">
            <summary>
              <span>창작자에게 연락하기</span>
              <i aria-hidden="true">▾</i>
            </summary>
            <div className="creator-contact__links">
              <a
                href="https://www.youtube.com/@bumi_daily_worship"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span
                  className="creator-contact__icon creator-contact__icon--youtube"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
                  </svg>
                </span>
                <span>
                  <strong>YouTube</strong>
                  <small>Bumi Daily Worship</small>
                </span>
              </a>
              <a
                href="https://open.kakao.com/me/BeomhyunPark"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="creator-contact__icon creator-contact__icon--kakao" aria-hidden="true">K</span>
                <span>
                  <strong>카카오톡 오픈채팅</strong>
                  <small>메시지 보내기</small>
                </span>
              </a>
              <a
                href="https://github.com/BeomhyunPark"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="creator-contact__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.69a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
                  </svg>
                </span>
                <span>
                  <strong>GitHub</strong>
                  <small>BeomhyunPark</small>
                </span>
              </a>
              <a href="mailto:cmpsr123@naver.com">
                <span className="creator-contact__icon" aria-hidden="true">@</span>
                <span>
                  <strong>이메일</strong>
                  <small>cmpsr123@naver.com</small>
                </span>
              </a>
            </div>
          </details>
          <ShareApp />
        </div>
      </footer>
    </ScreenLayout>
  );
}
