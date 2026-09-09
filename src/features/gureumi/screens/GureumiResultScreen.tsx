import { useEffect, useState, type CSSProperties } from 'react';

import { assetUrl } from '../../../utils/assetUrl';
import { GUREUMI_RESULTS } from '../data/results';
import type { GureumiResult } from '../domain/types';
import {
  getGureumiResultImageSrc,
  preloadGureumiResultImage,
  saveGureumiResultImage,
} from '../services/resultImage';
import { bindGureumiKakaoShareButton, shareGureumiResult } from '../services/kakaoShare';

type GureumiResultScreenProps = {
  result: GureumiResult;
  feedbackOpening?: boolean;
  retestStarting?: boolean;
  actionError?: string;
  onOpenFeedback?: () => void;
  onRetest?: () => void;
  onBackHome?: () => void;
};

type ResultVariables = CSSProperties & {
  '--gureumi-result-hero-start': string;
  '--gureumi-result-hero-middle': string;
  '--gureumi-result-hero-end': string;
  '--gureumi-result-hero-ink': string;
  '--gureumi-result-hero-label': string;
  '--gureumi-result-label-accent': string;
  '--gureumi-result-balance-label': string;
  '--gureumi-result-accent': string;
  '--gureumi-result-accent-middle': string;
  '--gureumi-result-accent-end': string;
  '--gureumi-result-accent-soft': string;
  '--gureumi-result-accent-ink': string;
  '--gureumi-result-balance-start': string;
  '--gureumi-result-balance-middle': string;
  '--gureumi-result-balance-end': string;
  '--gureumi-result-closing-start': string;
  '--gureumi-result-closing-middle': string;
  '--gureumi-result-closing-end': string;
  '--gureumi-result-sparkle': string;
  '--gureumi-result-action-start': string;
  '--gureumi-result-action-middle': string;
  '--gureumi-result-action-end': string;
};

const AXIS_COPY = {
  NOVELTY: { short: '새로움', formal: '자극추구' },
  WORRY: { short: '걱정', formal: '위험회피' },
  RELATION: { short: '관계', formal: '사회적 민감성' },
} as const;

export function GureumiResultScreen({
  result,
  feedbackOpening = false,
  retestStarting = false,
  actionError = '',
  onOpenFeedback,
  onRetest,
  onBackHome,
}: GureumiResultScreenProps) {
  const definition = GUREUMI_RESULTS[result.resultType];
  const [saveMessage, setSaveMessage] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [sharingResult, setSharingResult] = useState(false);
  const [kakaoButtonMode, setKakaoButtonMode] = useState<'loading' | 'sdk' | 'fallback'>('loading');
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const resultImageSrc = getGureumiResultImageSrc(definition.characterKey);
  const style: ResultVariables = {
    '--gureumi-result-hero-start': definition.theme.heroStart,
    '--gureumi-result-hero-middle': definition.theme.heroMiddle,
    '--gureumi-result-hero-end': definition.theme.heroEnd,
    '--gureumi-result-hero-ink': definition.theme.heroInk,
    '--gureumi-result-hero-label': definition.theme.heroLabel,
    '--gureumi-result-label-accent': definition.theme.labelAccent,
    '--gureumi-result-balance-label': definition.theme.balanceLabel,
    '--gureumi-result-accent': definition.theme.accent,
    '--gureumi-result-accent-middle': definition.theme.accentMiddle,
    '--gureumi-result-accent-end': definition.theme.accentEnd,
    '--gureumi-result-accent-soft': definition.theme.accentSoft,
    '--gureumi-result-accent-ink': definition.theme.accentInk,
    '--gureumi-result-balance-start': definition.theme.balanceStart,
    '--gureumi-result-balance-middle': definition.theme.balanceMiddle,
    '--gureumi-result-balance-end': definition.theme.balanceEnd,
    '--gureumi-result-closing-start': definition.theme.closingStart,
    '--gureumi-result-closing-middle': definition.theme.closingMiddle,
    '--gureumi-result-closing-end': definition.theme.closingEnd,
    '--gureumi-result-sparkle': definition.theme.sparkle,
    '--gureumi-result-action-start': definition.theme.actionStart,
    '--gureumi-result-action-middle': definition.theme.actionMiddle,
    '--gureumi-result-action-end': definition.theme.actionEnd,
  };

  useEffect(() => {
    let active = true;
    void preloadGureumiResultImage(definition.characterKey).catch(() => {
      // The button retries the request and reports an actionable error.
    });
    void bindGureumiKakaoShareButton('#gureumi-kakao-share-button', {
      name: definition.name,
      descriptor: definition.descriptor,
      characterKey: definition.characterKey,
    }).then((bound) => {
      if (active) setKakaoButtonMode(bound ? 'sdk' : 'fallback');
    });
    return () => {
      active = false;
    };
  }, [definition.characterKey]);

  const handleSaveImage = async () => {
    if (savingImage) return;
    setSavingImage(true);
    setSaveMessage('');
    try {
      const action = await saveGureumiResultImage(definition.characterKey);
      if (action === 'shared') setSaveMessage('공유 메뉴에서 이미지 저장을 선택해주세요.');
      if (action === 'downloaded') setSaveMessage('결과 이미지 다운로드를 시작했어요.');
      if (action === 'ios-help') setShowIosHelp(true);
    } catch {
      setSaveMessage('이미지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSavingImage(false);
    }
  };

  const handleKakaoShare = async () => {
    if (sharingResult) return;
    setSharingResult(true);

    try {
      await shareGureumiResult({
        name: definition.name,
        descriptor: definition.descriptor,
        characterKey: definition.characterKey,
      });

    } finally {
      setSharingResult(false);
    }
  };

  return (
    <main className="gureumi-result" style={style}>
      {actionError ? <p className="gureumi-error" role="alert">{actionError}</p> : null}
      <article className="gureumi-result__card" aria-label={`${definition.name} 결과`}>
        {onBackHome ? (
          <nav className="gureumi-toolbar" aria-label="구르미 결과 탐색">
            <button type="button" onClick={onBackHome}>← 홈</button>
          </nav>
        ) : null}
        <header className="gureumi-result__hero">
          <p>{definition.englishType} · GUREUMI TYPE</p>
          <span>당신의 구르미는</span>
          <h1>{definition.name}</h1>
          <h2>{definition.descriptor}</h2>
          <img
            src={assetUrl(`images/teasers/gureumi-test/${definition.characterKey}.png`)}
            alt={`${definition.name} 캐릭터`}
          />
          <blockquote>{definition.quote}</blockquote>
        </header>

        <section className="gureumi-result__section gureumi-result__map" aria-labelledby="gureumi-map-title">
          <p className="gureumi-result__eyebrow">기질 한눈에 보기</p>
          <h2 id="gureumi-map-title">{definition.name}의 기질 지도</h2>
          <p>{definition.mapSummary}</p>
          <div className="gureumi-result__axes">
            {result.axes.map((axis) => {
              const copy = AXIS_COPY[axis.key];
              return (
                <div key={axis.key}>
                  <span>{copy.short}</span>
                  <strong>{axis.level === 'HIGH' ? '높음' : '낮음'}</strong>
                  <i aria-hidden="true"><b style={{ width: axis.level === 'HIGH' ? '88%' : '34%' }} /></i>
                  <small>{copy.formal} {axis.level === 'HIGH' ? '↑' : '↓'}</small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="gureumi-result__section">
          <p className="gureumi-result__eyebrow">{definition.name}는요</p>
          <h2>{definition.storyLead}</h2>
          <div className="gureumi-result__story">
            {definition.storyBody.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <blockquote className="gureumi-result__desire">
            <small>✦ &nbsp;{definition.name}의 마음</small>
            “{definition.coreDesire}”
          </blockquote>
        </section>

        <section className="gureumi-result__section">
          <p className="gureumi-result__eyebrow">{definition.name}의 빛</p>
          <h2>{definition.strengthLead}</h2>
          <p>{definition.strengthBody}</p>
          <ul className="gureumi-result__strengths" aria-label="대표 강점">
            {definition.strengths.map((strength) => <li key={strength}>{strength}</li>)}
          </ul>
        </section>

        <section className="gureumi-result__balance">
          <p className="gureumi-result__eyebrow">빛이 너무 강해질 때</p>
          <h2>{definition.balanceTitle}</h2>
          <p>{definition.caution}</p>
          <hr />
          <strong>{definition.balanceTipLabel}</strong>
          <p>{definition.balanceTip}</p>
        </section>

        <section className="gureumi-result__section">
          <p className="gureumi-result__eyebrow">다른 구르미와 만날 때</p>
          <h2>비슷해 보여도 달라요</h2>
          <p>{definition.comparisonIntro}</p>
          <ul className="gureumi-result__differences">
            {definition.differences.map((difference) => (
              <li key={difference.name}><strong>{difference.name}</strong><p>{difference.body}</p></li>
            ))}
          </ul>
          <div className="gureumi-result__synergy">
            <p className="gureumi-result__eyebrow">함께할 때 빛나는 조합</p>
            <h2>서로의 강점을 살리는 친구들</h2>
            <p>누가 더 좋은 유형이라기보다,<br />서로의 강점을 살리기 쉬운 조합이에요.</p>
            {definition.synergies.map((synergy) => (
              <article key={synergy.pair}>
                <small>{synergy.label}</small>
                <strong>{synergy.pair}</strong>
                <p>{synergy.body}</p>
              </article>
            ))}
          </div>
        </section>

        {showAllTypes ? (
          <section className="gureumi-result__all-types" aria-labelledby="all-gureumi-title">
            <h2 id="all-gureumi-title">8가지 구르미</h2>
            <div>
              {Object.values(GUREUMI_RESULTS).map((item) => (
                <article key={item.id}>
                  <img src={assetUrl(`images/teasers/gureumi-test/${item.characterKey}.png`)} alt="" />
                  <strong>{item.name}</strong>
                  <p>{item.descriptor}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="gureumi-result__closing">
          <span aria-hidden="true">✦</span>
          <h2>{definition.closing}</h2>
          <button type="button" disabled={savingImage} onClick={() => void handleSaveImage()}>
            {savingImage ? '이미지를 준비하고 있어요…' : '결과 이미지 저장하기'}
          </button>
          <button
            id="gureumi-kakao-share-button"
            className="gureumi-result__kakao-button"
            type="button"
            disabled={sharingResult || kakaoButtonMode === 'loading'}
            onClick={kakaoButtonMode === 'fallback' ? () => void handleKakaoShare() : undefined}
          >
            {kakaoButtonMode === 'loading' || sharingResult ? '공유 화면 준비 중…' : '카카오톡으로 결과 공유하기'}
          </button>
          {saveMessage ? <p aria-live="polite">{saveMessage}</p> : null}
          <button className="gureumi-result__all-button" type="button" onClick={() => setShowAllTypes((value) => !value)}>
            {showAllTypes ? '8가지 구르미 접기' : '8가지 구르미 모두 보기 →'}
          </button>
          <p className="gureumi-result__legal">이 결과는 놀이형 자기이해 콘텐츠이며,<br />전문적인 심리검사나 진단을 대신하지 않습니다.</p>
        </footer>

        {onOpenFeedback && onRetest ? (
          <section className="gureumi-result__feedback-handoff" aria-labelledby="gureumi-feedback-title">
            <small>BETA 1 · 결과를 확인했다면</small>
            <h2 id="gureumi-feedback-title">이 결과가 나와 얼마나 닮았는지 알려주세요</h2>
            <p>헷갈린 문항과 더 가까운 구르미도<br />내용을 다시 보며 선택할 수 있어요.</p>
            <button type="button" disabled={feedbackOpening} onClick={onOpenFeedback}>
              {feedbackOpening ? '피드백을 준비하고 있어요…' : '피드백 남기기'}
            </button>
            <button type="button" disabled={retestStarting} onClick={onRetest}>
              {retestStarting ? '새 테스트를 준비하고 있어요…' : '다시 테스트하기'}
            </button>
          </section>
        ) : null}
      </article>

      {showIosHelp ? (
        <div className="gureumi-save-help" role="presentation" onMouseDown={() => setShowIosHelp(false)}>
          <section
            className="gureumi-save-help__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gureumi-save-help-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" aria-label="저장 안내 닫기" onClick={() => setShowIosHelp(false)}>×</button>
            <h2 id="gureumi-save-help-title">iPhone에 이미지 저장하기</h2>
            <p>이미지를 길게 누른 뒤<br />‘사진에 저장’을 선택해주세요.</p>
            <img src={resultImageSrc} alt={`${definition.name} 저장용 결과 이미지`} />
          </section>
        </div>
      ) : null}
    </main>
  );
}
