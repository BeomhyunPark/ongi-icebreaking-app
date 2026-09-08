import { useEffect, useMemo, useState } from 'react';

import { PrimaryButton } from '../../components/PrimaryButton';
import { ProgressBar } from '../../components/ProgressBar';
import { ScreenLayout } from '../../components/ScreenLayout';
import { BALANCE_GAME_QUESTIONS } from './data/questions';
import type {
  BalanceGameCategory,
  BalanceGameQuestion,
  BalanceGameWeight,
} from './domain/types';
import './styles/balance-game.css';
import { loadBalanceSession, saveBalanceSession } from './sessionStorage';
import {
  completeContentParticipation,
  startContentParticipation,
} from '../../engagement/tracker';

type BalanceGameAppProps = {
  onBackHome: () => void;
  initialBalanceGameWeight?: BalanceGameWeight;
  onBalanceGameWeightChange?: (weight: BalanceGameWeight) => void;
};

type Phase = 'setup' | 'picker' | 'play' | 'complete';
type QuestionFilter = 'all' | BalanceGameCategory;

const CATEGORY_LABELS: Record<BalanceGameCategory, string> = {
  daily: '일상 · 성향',
  faith: '교회 · 신앙',
};

const FILTER_LABELS: Record<BalanceGameWeight, Record<BalanceGameCategory, string>> = {
  light: CATEGORY_LABELS,
  deep: {
    daily: '일상 · 관계',
    faith: '신앙 · 공동체',
  },
};

const RANDOM_QUESTION_COUNT = 5;

export function pickRandomQuestions(
  weight: BalanceGameWeight,
  random = Math.random,
): readonly BalanceGameQuestion[] {
  const questions = BALANCE_GAME_QUESTIONS.filter((question) => question.weight === weight);

  for (let index = questions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(random() * (index + 1)));
    [questions[index], questions[swapIndex]] = [questions[swapIndex], questions[index]];
  }

  return questions.slice(0, RANDOM_QUESTION_COUNT);
}

export function BalanceGameApp({
  onBackHome,
  initialBalanceGameWeight = 'light',
  onBalanceGameWeightChange,
}: BalanceGameAppProps) {
  const [savedSession] = useState(() => loadBalanceSession(initialBalanceGameWeight));
  const [phase, setPhase] = useState<Phase>(savedSession?.phase ?? 'setup');
  const [weight, setWeight] = useState<BalanceGameWeight>(initialBalanceGameWeight);
  const [filter, setFilter] = useState<QuestionFilter>('all');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<readonly string[]>(savedSession?.selectedQuestionIds ?? []);
  const [playedQuestionIds, setPlayedQuestionIds] = useState<readonly string[]>(savedSession?.playedQuestionIds ?? []);
  const [playQuestions, setPlayQuestions] = useState<readonly BalanceGameQuestion[]>(() => (
    savedSession?.questionIds.map(id => BALANCE_GAME_QUESTIONS.find(q => q.id === id)!) ?? []
  ));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(savedSession?.index ?? 0);
  const [choices, setChoices] = useState<Record<string, 'left' | 'right'>>(savedSession?.choices ?? {});
  const selectedSide = choices[playQuestions[currentQuestionIndex]?.id] ?? null;
  const setSelectedSide = (side: 'left' | 'right') => {
    setChoices(current => ({ ...current, [playQuestions[currentQuestionIndex].id]: side }));
  };

  useEffect(() => {
    saveBalanceSession(weight, {
      phase, selectedQuestionIds, playedQuestionIds,
      questionIds: playQuestions.map(q => q.id), index: currentQuestionIndex, choices,
    });
  }, [weight, phase, selectedQuestionIds, playedQuestionIds, playQuestions, currentQuestionIndex, choices]);

  const visibleQuestions = useMemo<readonly BalanceGameQuestion[]>(
    () => BALANCE_GAME_QUESTIONS.filter(
      (question) => question.weight === weight
        && (filter === 'all' || question.category === filter),
    ),
    [filter, weight],
  );

  useEffect(() => {
    if (phase === 'setup') setWeight(initialBalanceGameWeight);
  }, [initialBalanceGameWeight, phase]);

  useEffect(() => {
    onBalanceGameWeightChange?.(weight);
  }, [onBalanceGameWeightChange, weight]);

  const startGame = (questions: readonly BalanceGameQuestion[]) => {
    void startContentParticipation('balance-game');
    setPlayQuestions(questions);
    setCurrentQuestionIndex(0);
    setChoices({});
    setPhase('play');
  };

  const startCustomGame = () => {
    const questions = BALANCE_GAME_QUESTIONS.filter(
      (question) => question.weight === weight
        && selectedQuestionIds.includes(question.id)
        && !playedQuestionIds.includes(question.id),
    );

    if (questions.length > 0) {
      startGame(questions);
    }
  };

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestionIds((current) => current.includes(questionId)
      ? current.filter((id) => id !== questionId)
      : [...current, questionId]);
  };

  const showPicker = () => {
    setPhase('picker');
  };

  const selectWeight = (nextWeight: BalanceGameWeight) => {
    setWeight(nextWeight);
    setFilter('all');
    setSelectedQuestionIds([]);
    setPlayedQuestionIds([]);
    setPlayQuestions([]);
    setCurrentQuestionIndex(0);
    setChoices({});
  };

  const completeGame = () => {
    void completeContentParticipation('balance-game');
    setPlayedQuestionIds((current) => Array.from(new Set([
      ...current,
      ...playQuestions.map((question) => question.id),
    ])));
    setSelectedQuestionIds([]);
    setPhase('complete');
  };

  if (phase === 'setup') {
    return (
      <ScreenLayout className={`balance-game-screen balance-game-screen--${weight} balance-setup balance-setup--${weight}`}>
        <button className="test-home-button" type="button" onClick={onBackHome}>
          <span aria-hidden="true">←</span> 홈
        </button>

        <header className="balance-header">
          <p className="eyebrow">온기 · VS 놀이</p>
          <h1 aria-label="극과 극 밸런스 게임">극과 극<br />밸런스 게임</h1>
        </header>

        <section className="balance-section" aria-labelledby="weight-title">
          <span className="balance-step">01</span>
          <h2 id="weight-title">오늘 대화의 온도</h2>
          <div className="balance-weight-grid">
            <button
              className={`balance-weight balance-weight--light${weight === 'light' ? ' is-selected' : ''}`}
              type="button"
              aria-pressed={weight === 'light'}
              onClick={() => selectWeight('light')}
            >
              <span aria-hidden="true">☀</span>
              <strong>가볍게</strong>
              <small>처음 만나도 편한 질문</small>
            </button>
            <button
              className={`balance-weight balance-weight--deep${weight === 'deep' ? ' is-selected' : ''}`}
              type="button"
              aria-pressed={weight === 'deep'}
              onClick={() => selectWeight('deep')}
            >
              <span aria-hidden="true">☾</span>
              <strong>조금 깊게</strong>
              <small>천천히 이유를 나누는 질문</small>
            </button>
          </div>
        </section>

        <section className="balance-section" aria-labelledby="mode-title">
          <span className="balance-step">02</span>
          <h2 id="mode-title">질문을 고르는 방법</h2>
          <div className="balance-mode-list">
            <button type="button" onClick={() => startGame(pickRandomQuestions(weight))}>
              <strong>랜덤으로 시작</strong>
            </button>
            <button type="button" onClick={showPicker}>
              <strong>직접 골라 담기</strong>
            </button>
          </div>
        </section>
        <p className="balance-credit">창작자 · CK</p>
      </ScreenLayout>
    );
  }

  if (phase === 'picker') {
    return (
      <ScreenLayout
        className={`balance-game-screen balance-game-screen--${weight} balance-picker`}
        footer={(
          <div className="balance-picker__footer">
            <p aria-label={`${selectedQuestionIds.length}개 선택`}><strong>{selectedQuestionIds.length}</strong>개 선택</p>
            <PrimaryButton disabled={selectedQuestionIds.length === 0} onClick={startCustomGame}>
              선택한 질문으로 시작
            </PrimaryButton>
          </div>
        )}
      >
        <button className="test-home-button" type="button" onClick={() => setPhase('setup')}>
          <span aria-hidden="true">←</span> 설정
        </button>
        <header className="balance-picker__header">
          <p className="eyebrow">{weight === 'light' ? '가볍게' : '조금 깊게'} · 직접 골라 담기</p>
          <h1>오늘 나눌 질문</h1>
        </header>

        <div className="balance-filters" role="group" aria-label="질문 카테고리">
          {([['all', '전체'], ['daily', FILTER_LABELS[weight].daily], ['faith', FILTER_LABELS[weight].faith]] as const)
            .map(([id, label]) => (
              <button
                className={filter === id ? 'is-active' : undefined}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                key={id}
              >
                {label}
              </button>
            ))}
        </div>

        <div className="balance-question-list">
          {visibleQuestions.map((question) => {
            const isSelected = selectedQuestionIds.includes(question.id);
            const isPlayed = playedQuestionIds.includes(question.id);

            return (
              <label
                className={`balance-question-card${isSelected ? ' is-selected' : ''}${isPlayed ? ' is-played' : ''}`}
                key={question.id}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isPlayed}
                  onChange={() => toggleQuestion(question.id)}
                />
                <span className="balance-question-card__check" aria-hidden="true">✓</span>
                <span className="balance-question-card__copy">
                  <small>
                    {question.topic ?? CATEGORY_LABELS[question.category]}
                    {isPlayed ? ' · 이미 나눈 질문' : ''}
                  </small>
                  <strong>{question.prompt}</strong>
                  <span>
                    {question.context ?? <>{question.left} <b>VS</b> {question.right}</>}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </ScreenLayout>
    );
  }

  if (phase === 'complete') {
    return (
      <ScreenLayout className={`balance-game-screen balance-game-screen--${weight} balance-complete`}>
        <div className="balance-complete__mark" aria-hidden="true">✦</div>
        <p className="eyebrow">오늘의 밸런스 완료</p>
        <h1>{playQuestions.length}개의 선택,<br />서로 다른 이야기</h1>
        <p>같은 답보다 왜 골랐는지를 나눌 때<br />우리 사이가 조금 더 가까워져요.</p>
        <div className="balance-complete__actions">
          <PrimaryButton onClick={showPicker}>다른 질문 골라보기</PrimaryButton>
          <button type="button" onClick={() => { setCurrentQuestionIndex(0); setPhase('play'); }}>내 선택 다시 보기</button>
          <button type="button" onClick={onBackHome}>홈으로</button>
        </div>
      </ScreenLayout>
    );
  }

  const question = playQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === playQuestions.length - 1;

  return (
    <ScreenLayout className={`balance-game-screen balance-game-screen--${question.weight} balance-play balance-play--${question.weight}`}>
      <button className="test-home-button" type="button" onClick={showPicker}>
        <span aria-hidden="true">←</span> 질문 선택
      </button>

      <header className="balance-play__progress">
        <span>{currentQuestionIndex + 1} / {playQuestions.length}</span>
        <ProgressBar current={currentQuestionIndex + 1} total={playQuestions.length} label="밸런스 게임 진행률" />
      </header>

      <section className="balance-play__question" aria-labelledby="balance-question-title">
        <small>{question.topic ?? CATEGORY_LABELS[question.category]}</small>
        <h1 id="balance-question-title">{question.prompt}</h1>
        {question.context ? <p className="balance-play__context">{question.context}</p> : null}
      </section>

      <div className="balance-choice-list" role="radiogroup" aria-label={question.prompt}>
        <button className={selectedSide === 'left' ? 'is-selected' : undefined} type="button" role="radio" aria-label={question.left} aria-checked={selectedSide === 'left'} onClick={() => setSelectedSide('left')}>
          <small>A</small><strong>{question.left}</strong>
        </button>
        <span aria-hidden="true">VS</span>
        <button className={selectedSide === 'right' ? 'is-selected' : undefined} type="button" role="radio" aria-label={question.right} aria-checked={selectedSide === 'right'} onClick={() => setSelectedSide('right')}>
          <small>B</small><strong>{question.right}</strong>
        </button>
      </div>

      <footer className="balance-play__footer">
        <button className="balance-play__previous" type="button" disabled={currentQuestionIndex === 0}
          onClick={() => setCurrentQuestionIndex(index => index - 1)}>이전 질문</button>
        <PrimaryButton
          className="balance-play__next"
          disabled={selectedSide === null}
          onClick={() => {
            if (isLastQuestion) {
              completeGame();
              return;
            }

            setCurrentQuestionIndex((index) => index + 1);
          }}
        >
          {isLastQuestion ? '마무리하기' : '다음 질문'}
        </PrimaryButton>
      </footer>
    </ScreenLayout>
  );
}
