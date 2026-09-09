import { useEffect, useMemo, useState } from 'react';

import { assetUrl } from '../../../utils/assetUrl';
import { GUREUMI_RESULTS } from '../data/results';
import type {
  GureumiFollowUpFeedback,
  GureumiQuestion,
  GureumiQuickFeedback,
  GureumiResult,
  GureumiResultType,
} from '../domain/types';
import { prepareGureumiKakaoShare, shareGureumiResult } from '../services/kakaoShare';

type FeedbackScreen = 'quick' | 'questions' | 'characters' | 'quick-complete' | 'follow-up' | 'complete';

type GureumiFeedbackFlowProps = {
  result: GureumiResult;
  questions: GureumiQuestion[];
  onSaveQuick: (feedback: GureumiQuickFeedback) => Promise<void>;
  onSaveFollowUp: (feedback: GureumiFollowUpFeedback) => Promise<void>;
  onBackResult: () => void;
  onRetest: () => void;
  retestStarting?: boolean;
  actionError?: string;
};

const RESULT_AXES: Record<GureumiResultType, ['HIGH' | 'LOW', 'HIGH' | 'LOW', 'HIGH' | 'LOW']> = {
  ARONG: ['HIGH', 'LOW', 'HIGH'],
  DALMONG: ['LOW', 'LOW', 'LOW'],
  HOOWOO: ['LOW', 'HIGH', 'LOW'],
  SUNNY: ['HIGH', 'LOW', 'LOW'],
  CHOKCHOK: ['HIGH', 'HIGH', 'HIGH'],
  MONGSIL: ['LOW', 'LOW', 'HIGH'],
  ELECTRIC: ['HIGH', 'HIGH', 'LOW'],
  POGEUN: ['LOW', 'HIGH', 'HIGH'],
};

const GUIDE_KEYWORDS: Record<GureumiResultType, string[]> = {
  ARONG: ['친화력', '열정', '낙관성'],
  DALMONG: ['침착함', '독립성', '관찰력'],
  HOOWOO: ['신중함', '분석력', '대비력'],
  SUNNY: ['도전성', '추진력', '독립성'],
  CHOKCHOK: ['감수성', '공감력', '호기심'],
  MONGSIL: ['다정함', '친화력', '안정감'],
  ELECTRIC: ['민첩함', '감지력', '위기대응'],
  POGEUN: ['배려심', '책임감', '안정감'],
};

const HELPFUL_SECTIONS = ['기질 한눈에 보기', '성향 설명', '강점', '균형을 위한 조언', '다른 구르미와 비교'];
const RESULT_ISSUES = ['설명이 너무 길었다', '비슷한 내용이 반복됐다', '표현이 부정적으로 느껴졌다', '이해하기 어려웠다', '특별히 없었다'];
const SHARE_OPTIONS = ['전혀 없다', '아마 안 할 것 같다', '아마 할 것 같다', '꼭 해보고 싶다'];
const ERROR_AREAS = ['없었음', '답변 저장', '이전·다음', '화면 깨짐', '결과·공유', '기타'];
const ENVIRONMENTS = ['iPhone Safari', 'Android Chrome', 'Samsung Internet', '카카오톡 인앱', 'PC 브라우저', '기타'];

function scrollTop() {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function toggleValue(values: string[], value: string, exclusive?: string): string[] {
  if (value === exclusive) return values.includes(value) ? [] : [value];
  const withoutExclusive = exclusive ? values.filter((item) => item !== exclusive) : values;
  return withoutExclusive.includes(value)
    ? withoutExclusive.filter((item) => item !== value)
    : [...withoutExclusive, value];
}

function FeedbackHeader({ brand, complete = false }: { brand: string; complete?: boolean }) {
  return (
    <header className="gureumi-feedback__header">
      <span>{brand}</span>
      <b>{complete ? '완료' : 'BETA 1'}</b>
    </header>
  );
}

function RatingScale({ value, onChange }: { value?: number; onChange: (value: number) => void }) {
  const labels = ['전혀', '조금', '조금', '매우'];
  return (
    <div className="gureumi-feedback-rating" role="radiogroup" aria-label="결과 공감도">
      <div className="gureumi-feedback-rating__endpoints"><span>비슷하지 않다</span><span>비슷하다</span></div>
      <div className="gureumi-feedback-rating__plot">
        {labels.map((label, index) => {
          const rating = index + 1;
          return (
            <label className={value === rating ? 'is-selected' : ''} key={rating}>
              <input type="radio" name="similarity" checked={value === rating} onChange={() => onChange(rating)} />
              <i aria-hidden="true" />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CharacterCard({ type, selected, onSelect }: {
  type: GureumiResultType;
  selected: boolean;
  onSelect: () => void;
}) {
  const definition = GUREUMI_RESULTS[type];
  const axes = RESULT_AXES[type];
  return (
    <button
      className={`gureumi-character-card gureumi-character-card--${definition.characterKey}${selected ? ' is-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <img src={assetUrl(`images/teasers/gureumi-test/${definition.characterKey}.png`)} alt="" />
      <span className="gureumi-character-card__copy">
        <span className="gureumi-character-card__name">{definition.name}{selected ? <em>선택됨</em> : null}</span>
        <span className="gureumi-character-card__descriptor">{definition.descriptor.replaceAll('\n', ' ')}</span>
        <span className="gureumi-character-card__axes">
          {['새로움', '걱정', '관계'].map((axis, index) => (
            <span key={axis}><small>{axis}</small><b>{axes[index] === 'HIGH' ? '높음 ↑' : '낮음 ↓'}</b></span>
          ))}
        </span>
        <span className="gureumi-character-card__keywords">{GUIDE_KEYWORDS[type].join('  ·  ')}</span>
      </span>
      <i className="gureumi-character-card__radio" aria-hidden="true">{selected ? '✓' : ''}</i>
    </button>
  );
}

function SurveyRating({ label, question, value, left, right, onChange }: {
  label: string;
  question: string;
  value?: number;
  left: string;
  right: string;
  onChange: (value: number) => void;
}) {
  return (
    <section className="gureumi-survey-card">
      <small>{label}</small>
      <h2>{question}</h2>
      <div className="gureumi-survey-scale" role="radiogroup" aria-label={question}>
        {[1, 2, 3, 4, 5].map((item) => (
          <label className={value === item ? 'is-selected' : ''} key={item}>
            <input type="radio" checked={value === item} onChange={() => onChange(item)} name={label} />
            {item}
          </label>
        ))}
      </div>
      <div className="gureumi-survey-scale__ends"><span>{left}</span><span>{right}</span></div>
    </section>
  );
}

function SurveyOptions({ label, question, guide, options, selected, single = false, exclusive, onChange }: {
  label: string;
  question: string;
  guide?: string;
  options: string[];
  selected: string[];
  single?: boolean;
  exclusive?: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <section className="gureumi-survey-card">
      <small>{label}</small>
      <h2>{question}</h2>
      {guide ? <p>{guide}</p> : null}
      <div className="gureumi-survey-options">
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label className={checked ? 'is-selected' : ''} key={option}>
              <input
                type={single ? 'radio' : 'checkbox'}
                name={single ? label : undefined}
                checked={checked}
                onChange={() => onChange(single ? (checked ? [] : [option]) : toggleValue(selected, option, exclusive))}
              />
              {checked ? '✓  ' : ''}{option}
            </label>
          );
        })}
      </div>
    </section>
  );
}

export function GureumiFeedbackFlow({
  result,
  questions,
  onSaveQuick,
  onSaveFollowUp,
  onBackResult,
  onRetest,
  retestStarting = false,
  actionError = '',
}: GureumiFeedbackFlowProps) {
  const [screen, setScreen] = useState<FeedbackScreen>('quick');
  const [rating, setRating] = useState<number>();
  const [questionRange, setQuestionRange] = useState(0);
  const [confusingOrders, setConfusingOrders] = useState<number[]>([]);
  const [selectedType, setSelectedType] = useState<GureumiResultType>(result.resultType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flowRating, setFlowRating] = useState<number>();
  const [questionUiRating, setQuestionUiRating] = useState<number>();
  const [resultHelpfulnessRating, setResultHelpfulnessRating] = useState<number>();
  const [helpfulSections, setHelpfulSections] = useState<string[]>([]);
  const [resultIssues, setResultIssues] = useState<string[]>([]);
  const [shareIntent, setShareIntent] = useState<string[]>([]);
  const [errorAreas, setErrorAreas] = useState<string[]>([]);
  const [environment, setEnvironment] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const definition = GUREUMI_RESULTS[selectedType];
  const visibleQuestions = useMemo(() => questions.slice(questionRange * 9, questionRange * 9 + 9), [questionRange, questions]);

  useEffect(() => {
    void prepareGureumiKakaoShare();
  }, []);

  const go = (next: FeedbackScreen) => {
    setScreen(next);
    setError('');
    scrollTop();
  };

  const submitQuick = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onSaveQuick({ rating, confusingQuestionOrders: confusingOrders, selfSelectedResultType: selectedType });
      go('quick-complete');
    } catch {
      setError('피드백을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const submitFollowUp = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onSaveFollowUp({
        flowRating,
        questionUiRating,
        resultHelpfulnessRating,
        helpfulSections,
        resultIssues,
        shareIntent: shareIntent[0],
        errorAreas,
        environment: environment[0],
        comment: comment.trim() || undefined,
      });
      go('complete');
    } catch {
      setError('후속 설문을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const shareResult = async () => {
    await shareGureumiResult({
      name: GUREUMI_RESULTS[result.resultType].name,
      descriptor: GUREUMI_RESULTS[result.resultType].descriptor,
      characterKey: GUREUMI_RESULTS[result.resultType].characterKey,
    });


  };

  if (screen === 'questions') {
    return (
      <main className="gureumi-feedback gureumi-question-picker">
        <div className="gureumi-feedback__surface">
          <FeedbackHeader brand="문항 다시 보기" />
          <div className="gureumi-feedback__intro compact">
            <h1>헷갈렸던 문항을 골라주세요</h1>
            <p>상황 문구를 다시 확인하고 여러 개 선택할 수 있어요.</p>
          </div>
          <nav className="gureumi-question-picker__tabs" aria-label="문항 범위">
            {['1–9', '10–18', '19–27'].map((label, index) => (
              <button className={questionRange === index ? 'is-selected' : ''} type="button" onClick={() => setQuestionRange(index)} key={label}>{label}</button>
            ))}
          </nav>
          <div className="gureumi-question-picker__list">
            {visibleQuestions.map((question) => {
              const checked = confusingOrders.includes(question.order);
              return (
                <label className={checked ? 'is-selected' : ''} key={question.questionId}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setConfusingOrders((values) => checked
                      ? values.filter((order) => order !== question.order)
                      : [...values, question.order].sort((a, b) => a - b))}
                  />
                  <i aria-hidden="true" />
                  <small>{String(question.order).padStart(2, '0')}</small>
                  <span>{question.prompt}</span>
                </label>
              );
            })}
          </div>
          <button className="gureumi-feedback__primary" type="button" onClick={() => go('quick')}>선택 완료 · {confusingOrders.length}개</button>
        </div>
      </main>
    );
  }

  if (screen === 'characters') {
    return (
      <main className="gureumi-feedback gureumi-character-guide">
        <div className="gureumi-feedback__surface">
          <FeedbackHeader brand="CHARACTER GUIDE" />
          <div className="gureumi-character-guide__intro">
            <h1>8개 구르미를 비교해보세요</h1>
            <p>세 축과 핵심 성향을 읽고 나와 가장 가까운 하나를 골라요.</p>
          </div>
          <div className="gureumi-character-guide__list">
            {(Object.keys(GUREUMI_RESULTS) as GureumiResultType[]).map((type) => (
              <CharacterCard type={type} selected={selectedType === type} onSelect={() => setSelectedType(type)} key={type} />
            ))}
          </div>
          <button className="gureumi-character-guide__done" type="button" onClick={() => go('quick')}>이 구르미 선택하고 돌아가기 · {definition.name}</button>
        </div>
      </main>
    );
  }

  if (screen === 'quick-complete' || screen === 'complete') {
    const followUpComplete = screen === 'complete';
    return (
      <main className="gureumi-feedback gureumi-feedback-complete">
        <div className="gureumi-feedback__surface">
          <FeedbackHeader brand={followUpComplete ? 'BETA FOLLOW-UP' : 'BETA FEEDBACK'} complete />
          <div className="gureumi-feedback__intro">
            <h1>{followUpComplete ? '자세한 이야기 고마워요!' : '피드백 고마워요!'}</h1>
            <p>{followUpComplete ? <>남겨준 의견은 문항과 결과 화면을<br />더 편하고 다정하게 다듬는 데 도움이 돼요.</> : <>당신의 응답은 문항과 결과 설명을<br />더 다정하고 정확하게 다듬는 데 도움이 돼요.</>}</p>
          </div>
          <img className="gureumi-feedback-complete__character" src={assetUrl(`images/teasers/gureumi-test/${followUpComplete ? 'sunny' : 'dalmong'}.png`)} alt="" />
          <section className="gureumi-feedback-complete__note">
            <h2>{followUpComplete ? 'Beta v0.1 검수 완료' : '조금 더 들려주고 싶다면'}</h2>
            <p>{followUpComplete ? '빠른 피드백과 후속 설문이 익명으로 저장됐어요. 정식 공개 전 개선 자료로만 활용할게요.' : '2~3분 정도의 후속 설문에서 진행 방식과 결과 설명에 대한 의견을 자세히 남길 수 있어요.'}</p>
          </section>
          {followUpComplete ? (
            <button className="gureumi-feedback__primary" type="button" onClick={onBackResult}>결과로 돌아가기</button>
          ) : (
            <button className="gureumi-feedback__primary" type="button" onClick={() => go('follow-up')}>자세한 설문 참여하기</button>
          )}
          <div className="gureumi-feedback-complete__actions">
            <button type="button" disabled={retestStarting} onClick={followUpComplete ? onRetest : onBackResult}>{followUpComplete ? '다시 테스트하기' : '결과로 돌아가기'}</button>
            {actionError ? <p className="gureumi-feedback__error" role="alert">{actionError}</p> : null}
            <button type="button" onClick={() => void shareResult()}>결과 공유하기</button>
          </div>
        </div>
      </main>
    );
  }

  if (screen === 'follow-up') {
    return (
      <main className="gureumi-feedback gureumi-follow-up">
        <div className="gureumi-feedback__surface">
          <FeedbackHeader brand="BETA FOLLOW-UP" />
          <div className="gureumi-feedback__intro">
            <h1>조금 더 자세히 들려주세요</h1>
            <p>빠른 피드백에서 다 못한 사용 경험을 알려주세요.<br />모든 항목은 선택 사항이에요.</p>
          </div>
          <p className="gureumi-follow-up__privacy">응답은 Beta 개선 목적으로만 익명 저장해요.<br />이름·연락처 같은 개인정보는 받지 않아요.</p>
          <SurveyRating label="1 · 진행 흐름" question="테스트 진행이 이해하기 쉬웠나요?" value={flowRating} left="매우 어려웠다" right="매우 쉬웠다" onChange={setFlowRating} />
          <SurveyRating label="2 · 문항 화면" question="5문항 묶음과 가로 선택 방식은 편했나요?" value={questionUiRating} left="매우 불편했다" right="매우 편했다" onChange={setQuestionUiRating} />
          <SurveyRating label="3 · 결과 설명" question="결과 설명은 이해하기 쉽고 도움이 됐나요?" value={resultHelpfulnessRating} left="전혀 아니었다" right="매우 그랬다" onChange={setResultHelpfulnessRating} />
          <SurveyOptions label="4 · 도움이 된 부분" question="결과에서 어떤 부분이 특히 도움이 됐나요?" guide="여러 개 선택할 수 있어요." options={HELPFUL_SECTIONS} selected={helpfulSections} onChange={setHelpfulSections} />
          <SurveyOptions label="5 · 불편했던 부분" question="결과에서 맞지 않거나 불편했던 점이 있었나요?" guide="여러 개 선택할 수 있어요." options={RESULT_ISSUES} selected={resultIssues} exclusive="특별히 없었다" onChange={setResultIssues} />
          <SurveyOptions label="6 · 공유 의향" question="친구나 소그룹에 이 테스트를 공유하고 싶나요?" options={SHARE_OPTIONS} selected={shareIntent} single onChange={setShareIntent} />
          <SurveyOptions label="7 · 오류 경험" question="진행 중 오류나 이상한 동작이 있었나요?" guide="문제가 있었던 항목을 모두 골라주세요." options={ERROR_AREAS} selected={errorAreas} exclusive="없었음" onChange={setErrorAreas} />
          <SurveyOptions label="8 · 사용 환경" question="어떤 기기와 브라우저에서 참여했나요?" guide="가장 가까운 항목 하나를 골라주세요." options={ENVIRONMENTS} selected={environment} single onChange={setEnvironment} />
          <section className="gureumi-survey-card">
            <small>9 · 자유 의견</small>
            <h2>더 남기고 싶은 말이 있나요?</h2>
            <p>이름·연락처 등 개인정보는 적지 말아주세요.</p>
            <textarea maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={'잘 맞았던 부분, 불편했던 표현,\n바라는 점 등을 자유롭게 적어주세요.'} />
          </section>
          {error ? <p className="gureumi-feedback__error" role="alert">{error}</p> : null}
          <button className="gureumi-feedback__primary" type="button" disabled={busy} onClick={() => void submitFollowUp()}>{busy ? '제출하고 있어요…' : '후속 설문 제출하기'}</button>
          <button className="gureumi-feedback__secondary" type="button" onClick={onBackResult}>제출하지 않고 결과로 돌아가기</button>
        </div>
      </main>
    );
  }

  const selectedQuestions = questions.filter((question) => confusingOrders.includes(question.order));
  return (
    <main className="gureumi-feedback">
      <div className="gureumi-feedback__surface">
        <FeedbackHeader brand="BETA FEEDBACK" />
        <div className="gureumi-feedback__intro">
          <h1>조금만 더 알려주세요</h1>
          <p>모든 항목은 선택 사항이에요. 답하기 어려운 내용은 건너뛰어도 괜찮아요.</p>
        </div>
        <section className="gureumi-feedback-card">
          <small>1 · 결과 공감도</small>
          <h2>결과가 나와 얼마나 비슷하다고 느꼈나요?</h2>
          <RatingScale value={rating} onChange={setRating} />
        </section>
        <section className="gureumi-feedback-card">
          <small>2 · 헷갈린 문항</small>
          <h2>답하기 어렵거나 애매했던 문항이 있었나요?</h2>
          <p>번호를 외울 필요 없이 문항 내용을 다시 보며 선택할 수 있어요.</p>
          {selectedQuestions.length ? (
            <div className="gureumi-feedback-card__selected-questions">
              {selectedQuestions.map((question) => <span key={question.questionId}><b>{String(question.order).padStart(2, '0')}</b>{question.prompt}</span>)}
            </div>
          ) : null}
          <button className="gureumi-feedback__secondary" type="button" onClick={() => go('questions')}>문항 내용 보며 선택하기</button>
        </section>
        <section className="gureumi-feedback-card">
          <small>3 · 내가 더 닮았다고 느끼는 구르미</small>
          <h2>직접 고른다면 누구와 가장 가까운가요?</h2>
          <p>8개 결과의 성향과 세 축을 비교한 뒤 골라도 괜찮아요.</p>
          <CharacterCard type={selectedType} selected onSelect={() => undefined} />
          <button className="gureumi-feedback__compare" type="button" onClick={() => go('characters')}>8개 결과 특징 비교하고 선택하기</button>
        </section>
        {error ? <p className="gureumi-feedback__error" role="alert">{error}</p> : null}
        <button className="gureumi-feedback__primary" type="button" disabled={busy} onClick={() => void submitQuick()}>{busy ? '보내고 있어요…' : '피드백 보내기'}</button>
        <button className="gureumi-feedback__secondary" type="button" onClick={onBackResult}>건너뛰기</button>
      </div>
    </main>
  );
}
