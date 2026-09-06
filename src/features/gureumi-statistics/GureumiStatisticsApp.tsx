import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import {
  getGureumiStatistics,
  getServiceDashboard,
  GureumiStatisticsApiError,
} from './api/statisticsApi';
import type {
  GureumiFunnelStatistics,
  GureumiStatistics,
  GureumiStatisticsFilters,
  ServiceDashboard,
} from './domain/types';
import './styles/gureumi-statistics.css';

type GureumiStatisticsAppProps = { onBackHome: () => void };
type LoadState = 'idle' | 'loading' | 'ready';

const ADMIN_KEY_STORAGE = 'ongi_admin_dashboard_key_v1';
const DEFAULT_FILTERS: GureumiStatisticsFilters = {
  completedAnswersOnly: true,
  firstAttemptOnly: true,
};
const AXIS_SHORT_LABELS: Record<string, string> = { NOVELTY: 'N', WORRY: 'W', RELATION: 'R' };

function storedAdminKey(): string {
  try {
    return window.sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatScore(value?: number): string {
  return value === undefined ? '—' : value.toFixed(2);
}

function formatResponseTime(value?: number): string {
  return value === undefined ? '—' : `${(value / 1000).toFixed(1)}초`;
}

function formatDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function funnelCards(funnel: GureumiFunnelStatistics) {
  return [
    { label: '시작', count: funnel.started, rate: 100, tone: 'neutral' },
    { label: 'Q9 도달', count: funnel.q9Reached, rate: funnel.q9Rate, tone: 'blue' },
    { label: 'Q18 도달', count: funnel.q18Reached, rate: funnel.q18Rate, tone: 'purple' },
    { label: '완료', count: funnel.completed, rate: funnel.completionRate, tone: 'warm' },
    { label: '피드백', count: funnel.feedbackSubmitted, rate: funnel.feedbackRate, tone: 'pink' },
  ];
}

export function GureumiStatisticsApp({ onBackHome }: GureumiStatisticsAppProps) {
  const [adminKey, setAdminKey] = useState(storedAdminKey);
  const [keyInput, setKeyInput] = useState('');
  const [filters, setFilters] = useState<GureumiStatisticsFilters>(DEFAULT_FILTERS);
  const [periodDays, setPeriodDays] = useState(30);
  const [statistics, setStatistics] = useState<GureumiStatistics | null>(null);
  const [dashboard, setDashboard] = useState<ServiceDashboard | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(adminKey ? 'loading' : 'idle');
  const [error, setError] = useState('');
  const [accessError, setAccessError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const requestSequence = useRef(0);

  const load = useCallback(async (key: string) => {
    const sequence = ++requestSequence.current;
    setLoadState('loading');
    setError('');
    try {
      const [nextDashboard, nextStatistics] = await Promise.all([
        getServiceDashboard(periodDays, key),
        getGureumiStatistics(filters, key),
      ]);
      if (sequence !== requestSequence.current) return;
      setDashboard(nextDashboard);
      setStatistics(nextStatistics);
      setLoadState('ready');
      setAccessError('');
      window.sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
    } catch (loadError) {
      if (sequence !== requestSequence.current) return;
      if (loadError instanceof GureumiStatisticsApiError && loadError.status === 401) {
        window.sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        setAdminKey('');
        setKeyInput('');
        setDashboard(null);
        setStatistics(null);
        setAccessError('관리자 키가 맞지 않습니다. 다시 확인해주세요.');
        setLoadState('idle');
        return;
      }
      setError(loadError instanceof Error ? loadError.message : '통계를 불러오지 못했습니다.');
      setLoadState(dashboard && statistics ? 'ready' : 'idle');
    }
  }, [dashboard, filters, periodDays, statistics]);

  useEffect(() => {
    if (adminKey) void load(adminKey);
    // load는 최신 화면 상태를 참조하며 아래 값이 실제 요청 조건이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, filters.version, filters.completedAnswersOnly, filters.firstAttemptOnly, periodDays, refreshKey]);

  const submitAccess = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = keyInput.trim();
    if (!key) {
      setAccessError('관리자 키를 입력해주세요.');
      return;
    }
    setAccessError('');
    setAdminKey(key);
  };

  const logout = () => {
    requestSequence.current += 1;
    window.sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey('');
    setKeyInput('');
    setDashboard(null);
    setStatistics(null);
    setLoadState('idle');
  };

  const updateFilters = (next: Partial<GureumiStatisticsFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
  };

  const chartMaximum = useMemo(() => Math.max(
    1,
    ...(dashboard?.daily.flatMap((day) => [day.pageViewCount, day.visitorCount]) ?? [1]),
  ), [dashboard]);

  if (!adminKey) {
    return (
      <main className="gureumi-stats-access">
        <form onSubmit={submitAccess}>
          <p>ONGI ADMIN</p>
          <h1>운영 대시보드</h1>
          <span>방문·콘텐츠·구르미 Beta 현황은 관리자만 볼 수 있습니다.</span>
          <label htmlFor="ongi-admin-key">관리자 키</label>
          <input
            id="ongi-admin-key"
            type="password"
            autoComplete="current-password"
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            autoFocus
          />
          {accessError ? <strong role="alert">{accessError}</strong> : null}
          <button type="submit">대시보드 열기</button>
          <small>키는 이 브라우저 탭을 닫을 때 삭제되며 서버에는 별도로 저장하지 않습니다.</small>
          <button className="gureumi-stats-access__home" type="button" onClick={onBackHome}>온기 홈으로</button>
        </form>
      </main>
    );
  }

  if ((!dashboard || !statistics) && loadState === 'loading') {
    return <main className="gureumi-stats-loading" aria-live="polite"><span>☁</span><h1>운영 현황을 불러오는 중입니다</h1></main>;
  }

  if (!dashboard || !statistics) {
    return (
      <main className="gureumi-stats-access">
        <section>
          <h1>통계를 불러오지 못했습니다</h1>
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>다시 시도</button>
          <button type="button" onClick={logout}>로그아웃</button>
        </section>
      </main>
    );
  }

  const summary = dashboard.summary;
  const overviewCards = [
    ['누적 방문자', summary.totalVisitorCount, '전체 기간 익명 방문자'],
    ['오늘 방문자', summary.todayVisitorCount, '한국 시간 기준'],
    [`최근 ${periodDays}일 방문자`, summary.periodVisitorCount, `${summary.visitCount.toLocaleString('ko-KR')}개 세션`],
    ['페이지 조회', summary.pageViewCount, `${summary.contentViewCount.toLocaleString('ko-KR')}회 콘텐츠 진입`],
    ['콘텐츠 시작', summary.participationCount, `${summary.completionCount.toLocaleString('ko-KR')}회 완료`],
    ['공유 클릭', summary.shareCount, `현재 좋아요 ${summary.likeCount.toLocaleString('ko-KR')}개`],
  ] as const;

  return (
    <main className="gureumi-stats-page">
      <div className="gureumi-stats-workspace">
        <header className="gureumi-stats-header">
          <div>
            <small>ONGI ADMIN</small>
            <h1>온기 운영 대시보드</h1>
            <p>전체 서비스 현황과 구르미 Beta 품질 지표 · KST 기준</p>
          </div>
          <div className="gureumi-stats-filters" aria-label="운영 대시보드 필터">
            {[7, 30, 90].map((days) => (
              <button type="button" aria-pressed={periodDays === days} onClick={() => setPeriodDays(days)} key={days}>{days}일</button>
            ))}
            <button className="gureumi-stats-filters__refresh" type="button" disabled={loadState === 'loading'} onClick={() => setRefreshKey((value) => value + 1)}>
              {loadState === 'loading' ? '갱신 중…' : '새로고침'}
            </button>
            <button className="gureumi-stats-filters__exit" type="button" onClick={onBackHome}>홈</button>
            <button className="gureumi-stats-filters__exit" type="button" onClick={logout}>로그아웃</button>
          </div>
        </header>

        {error ? <p className="gureumi-stats-error" role="alert">{error}</p> : null}

        <section className="gureumi-stats-overview" aria-label="서비스 핵심 지표">
          {overviewCards.map(([label, count, note]) => (
            <article key={label}><span>{label}</span><strong>{count.toLocaleString('ko-KR')}</strong><small>{note}</small></article>
          ))}
        </section>

        <section className="gureumi-stats-panel gureumi-stats-traffic" aria-labelledby="traffic-title">
          <header>
            <div><h2 id="traffic-title">방문 추이</h2><p>진한 막대는 페이지 조회, 밝은 막대는 익명 방문자입니다.</p></div>
            <div className="gureumi-stats-legend"><span>페이지 조회</span><span>방문자</span></div>
          </header>
          <div className="gureumi-stats-chart" style={{ gridTemplateColumns: `repeat(${dashboard.daily.length}, minmax(8px, 1fr))` }}>
            {dashboard.daily.map((day, index) => (
              <div className="gureumi-stats-chart__day" key={day.date} title={`${day.date} · 방문자 ${day.visitorCount} · 페이지뷰 ${day.pageViewCount}`}>
                <div><i style={{ height: `${(day.pageViewCount / chartMaximum) * 100}%` }} /><b style={{ height: `${(day.visitorCount / chartMaximum) * 100}%` }} /></div>
                <small>{dashboard.daily.length <= 31 || index % 7 === 0 || index === dashboard.daily.length - 1 ? formatDate(day.date) : ''}</small>
              </div>
            ))}
          </div>
          <div className="gureumi-stats-daily-table">
            <table><thead><tr><th>날짜</th><th>방문자</th><th>세션</th><th>페이지뷰</th><th>콘텐츠 조회</th><th>시작</th><th>완료</th><th>공유</th></tr></thead>
              <tbody>{[...dashboard.daily].reverse().map((day) => <tr key={day.date}><td>{day.date}</td><td>{day.visitorCount}</td><td>{day.visitCount}</td><td>{day.pageViewCount}</td><td>{day.contentViewCount}</td><td>{day.participationCount}</td><td>{day.completionCount}</td><td>{day.shareCount}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="gureumi-stats-panel gureumi-stats-content" aria-labelledby="content-performance-title">
          <header><div><h2 id="content-performance-title">콘텐츠별 성과</h2><p>조회에서 시작·완료·공유로 이어지는 흐름을 비교합니다.</p></div></header>
          <table>
            <thead><tr><th>콘텐츠</th><th>상태</th><th>조회</th><th>고유 조회자</th><th>시작</th><th>완료</th><th>완료율</th><th>공유</th><th>좋아요</th></tr></thead>
            <tbody>{dashboard.contents.map((content) => (
              <tr key={content.contentCode}>
                <td><strong>{content.name}</strong><small>{content.contentCode} · {content.type}</small></td>
                <td><span className={`is-${content.status.toLowerCase()}`}>{content.status}</span></td>
                <td>{content.viewCount.toLocaleString('ko-KR')}</td><td>{content.uniqueViewerCount.toLocaleString('ko-KR')}</td>
                <td>{content.participationCount.toLocaleString('ko-KR')}</td><td>{content.completionCount.toLocaleString('ko-KR')}</td>
                <td>{formatPercent(content.completionRate)}</td><td>{content.shareCount.toLocaleString('ko-KR')}</td><td>{content.likeCount.toLocaleString('ko-KR')}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>

        <section className="gureumi-stats-beta-heading">
          <div><small>CONTENT DETAIL</small><h2>구르미 Beta 분석</h2><p>문항 품질과 결과 분포를 상세하게 확인합니다.</p></div>
          <div className="gureumi-stats-filters">
            <label><span className="sr-only">테스트 버전</span><select value={filters.version ?? statistics.version} onChange={(event) => updateFilters({ version: event.target.value })}>{statistics.availableVersions.map((version) => <option value={version.code} key={version.code}>{version.code}{version.status === 'ACTIVE' ? ' · ACTIVE' : ''}</option>)}</select></label>
            <button type="button" aria-pressed={filters.completedAnswersOnly} onClick={() => updateFilters({ completedAnswersOnly: !filters.completedAnswersOnly })}>{filters.completedAnswersOnly ? '완료자 응답' : '전체 응답'}</button>
            <button type="button" aria-pressed={filters.firstAttemptOnly} onClick={() => updateFilters({ firstAttemptOnly: !filters.firstAttemptOnly })}>{filters.firstAttemptOnly ? '최초 검사' : '전체 검사'}</button>
          </div>
        </section>

        <section className="gureumi-stats-funnel" aria-label="구르미 진행 퍼널">
          {funnelCards(statistics.funnel).map((card) => <article className={`gureumi-stats-funnel__card is-${card.tone}`} key={card.label}><strong>{card.label}</strong><p>{card.count.toLocaleString('ko-KR')} <span>· {formatPercent(card.rate)}</span></p></article>)}
        </section>

        <div className="gureumi-stats-analysis">
          <section className="gureumi-stats-panel gureumi-stats-questions" aria-labelledby="question-statistics-title">
            <header><h2 id="question-statistics-title">문항별 응답 분석</h2><p>선택 비율 · 서버 계산 평균 score · 평균 응답 시간</p></header>
            <div className="gureumi-stats-table-wrap"><table><thead><tr><th>문항</th><th>상황</th><th>표본</th><th>A 매우</th><th>A 조금</th><th>B 조금</th><th>B 매우</th><th>평균</th><th>응답시간</th></tr></thead>
              <tbody>{statistics.questions.map((question) => <tr key={question.order}><td><b>Q{String(question.order).padStart(2, '0')}</b><small>{AXIS_SHORT_LABELS[question.axis]} · {question.code}</small></td><td>{question.prompt}</td><td>{question.responseCount.toLocaleString('ko-KR')}</td><td title={`${question.aVeryCount}건`}>{formatPercent(question.aVeryPercentage)}</td><td title={`${question.aLittleCount}건`}>{formatPercent(question.aLittlePercentage)}</td><td title={`${question.bLittleCount}건`}>{formatPercent(question.bLittlePercentage)}</td><td title={`${question.bVeryCount}건`}>{formatPercent(question.bVeryPercentage)}</td><td>{formatScore(question.averageScore)}</td><td>{formatResponseTime(question.averageResponseMs)}</td></tr>)}</tbody>
            </table></div>
            <aside><strong>분포가 몰려도 cutoff부터 바꾸지 않기</strong><p>문항 매력도, 축 혼입, 반복성, 집단 편향, 오해 가능성을 먼저 검토합니다.</p></aside>
          </section>

          <aside className="gureumi-stats-sidebar">
            <section className="gureumi-stats-panel" aria-labelledby="axis-statistics-title"><h2 id="axis-statistics-title">축 분포와 Boundary</h2><div className="gureumi-stats-axis-list">{statistics.axes.map((axis) => <article key={axis.key}><div><strong>{axis.label}</strong><span>평균 {formatScore(axis.averageScore)}</span></div><p>HIGH {formatPercent(axis.highPercentage)} / LOW {formatPercent(axis.lowPercentage)} · 경계 {formatPercent(axis.boundaryPercentage)}</p><i aria-hidden="true"><b style={{ width: `${axis.highPercentage}%` }} /></i><small>{axis.completedCount.toLocaleString('ko-KR')}건 · HIGH {axis.highCount} · LOW {axis.lowCount} · 경계 {axis.boundaryCount}</small></article>)}</div></section>
            <section className="gureumi-stats-panel" aria-labelledby="result-statistics-title"><h2 id="result-statistics-title">8개 결과 분포</h2><div className="gureumi-stats-result-list">{statistics.results.map((result) => <article key={result.resultType}><div><strong>{result.displayName}</strong><span>{result.count.toLocaleString('ko-KR')}명 · {formatPercent(result.percentage)}</span></div><p>만족도 {result.averageRating === undefined ? '—' : `${result.averageRating.toFixed(2)} / 4`} · {result.feedbackCount}건</p></article>)}</div></section>
            <section className="gureumi-stats-panel gureumi-stats-feedback" aria-labelledby="feedback-statistics-title"><h2 id="feedback-statistics-title">결과 만족도</h2><p className="gureumi-stats-feedback__summary">평균 <strong>{statistics.feedback.averageRating?.toFixed(2) ?? '—'} / 4</strong><span>응답 {statistics.feedback.submittedCount.toLocaleString('ko-KR')}건 · 완료 대비 {formatPercent(statistics.feedback.completionResponsePercentage)}</span></p><div>{statistics.feedback.ratings.map((rating) => <p key={rating.rating}><span>{['전혀 아님', '조금 아님', '조금 비슷', '매우 비슷'][rating.rating - 1]}</span><strong>{formatPercent(rating.percentage)}</strong><small>{rating.count}건</small></p>)}</div></section>
            <p className="gureumi-stats-privacy">집계 데이터만 제공하며 개별 사용자·토큰·개인정보는 표시하지 않습니다. 관리자 대시보드 방문은 통계에서 제외합니다.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
