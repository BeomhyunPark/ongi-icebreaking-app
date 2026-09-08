import { useEffect, useState } from 'react';

import { PrimaryButton } from '../../components/PrimaryButton';
import { ShareNotice, useShareNotice } from '../../components/ShareNotice';
import { ProgressBar } from '../../components/ProgressBar';
import { ScreenLayout } from '../../components/ScreenLayout';
import {
  WORLD_CUP_CATEGORIES,
  WORLD_CUP_CATEGORY_BY_ID,
} from './data/categories';
import {
  WORLD_CUP_CANDIDATE_BY_ID,
  WORLD_CUP_CANDIDATES,
} from './data/candidates';
import {
  chooseWinner,
  createTournament,
  getCurrentMatch,
  getRoundLabel,
  getTotalMatchCount,
  startNextRound,
} from './domain/tournament';
import type {
  TournamentSize,
  WorldCupCandidate,
  WorldCupCategory,
  WorldCupCategoryId,
  WorldCupSession,
} from './domain/types';
import {
  clearWorldCupSession,
  loadWorldCupSession,
  saveWorldCupSession,
} from './services/sessionStorage';
import {
  createWorldCupResultFile,
  shareWorldCupResultFile,
} from './services/resultImage';
import './styles/ideal-world-cup.css';
import {
  completeContentParticipation,
  recordShareClick,
  startContentParticipation,
} from '../../engagement/tracker';

type IdealWorldCupAppProps = {
  onBackHome: () => void;
  initialWorldCupCategory?: WorldCupCategoryId;
  onWorldCupCategoryChange?: (category: WorldCupCategoryId) => void;
};

type CandidateVisualProps = {
  candidate: WorldCupCandidate;
};

const CANDIDATE_IDS = WORLD_CUP_CANDIDATES.map((candidate) => candidate.id);
const VALID_CANDIDATE_IDS = new Set(CANDIDATE_IDS);
const VALID_CATEGORY_IDS = new Set(WORLD_CUP_CATEGORIES.map((category) => category.id));
const SIZE_OPTIONS: readonly TournamentSize[] = [64, 32, 16];

const SIZE_COPY: Record<TournamentSize, string> = {
  64: '총 63번의 선택',
  32: '총 31번의 선택',
  16: '총 15번의 선택',
};

function findCandidate(candidateId: string): WorldCupCandidate {
  const candidate = WORLD_CUP_CANDIDATE_BY_ID.get(candidateId);

  if (!candidate) {
    throw new Error(`월드컵 후보를 찾을 수 없습니다: ${candidateId}`);
  }

  return candidate;
}

function findCategory(categoryId: WorldCupCategoryId): WorldCupCategory {
  const category = WORLD_CUP_CATEGORY_BY_ID.get(categoryId);

  if (!category) {
    throw new Error(`월드컵 주제를 찾을 수 없습니다: ${categoryId}`);
  }

  return category;
}

function CandidateVisual({ candidate }: CandidateVisualProps) {
  if (candidate.image) {
    return (
      <span className="world-cup-candidate-visual world-cup-candidate-visual--image" aria-hidden="true">
        <img src={candidate.image} alt="" draggable="false" />
      </span>
    );
  }

  return (
    <span
      className={`world-cup-candidate-visual world-cup-candidate-visual--symbol is-${candidate.visualTone}`}
      aria-hidden="true"
    >
      <span>{candidate.symbol}</span>
    </span>
  );
}

function createSession(
  categoryId: WorldCupCategoryId,
  tournamentSize: TournamentSize,
): WorldCupSession {
  const category = findCategory(categoryId);

  return {
    version: 2,
    categoryId,
    current: createTournament(category.candidateIds, tournamentSize),
    previous: null,
  };
}

export function IdealWorldCupApp({
  onBackHome,
  initialWorldCupCategory = 'meal',
  onWorldCupCategoryChange,
}: IdealWorldCupAppProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<WorldCupCategoryId>(initialWorldCupCategory);
  const [selectedSize, setSelectedSize] = useState<TournamentSize>(32);
  const [savedSession, setSavedSession] = useState<WorldCupSession | null>(
    () => loadWorldCupSession(VALID_CANDIDATE_IDS, VALID_CATEGORY_IDS),
  );
  const [activeSession, setActiveSession] = useState<WorldCupSession | null>(() => (
    savedSession?.categoryId === initialWorldCupCategory && savedSession.current.phase === 'champion' ? savedSession : null
  ));
  const [isSharingResult, setIsSharingResult] = useState(false);
  const { message, clearNotice, reportShare } = useShareNotice();

  useEffect(() => {
    if (!activeSession) {
      setSelectedCategoryId(initialWorldCupCategory);
    }
  }, [activeSession, initialWorldCupCategory]);

  useEffect(() => {
    onWorldCupCategoryChange?.(activeSession?.categoryId ?? selectedCategoryId);
  }, [activeSession?.categoryId, onWorldCupCategoryChange, selectedCategoryId]);

  useEffect(() => {
    if (activeSession) {
      saveWorldCupSession(activeSession);
    }
  }, [activeSession]);

  useEffect(() => {
    if (activeSession?.current.phase === 'champion' && activeSession.current.championId) {
      void completeContentParticipation('ideal-world-cup');
    }
  }, [activeSession]);

  const startNewTournament = (
    categoryId: WorldCupCategoryId,
    tournamentSize: TournamentSize,
  ) => {
    clearWorldCupSession();
    setSavedSession(null);

    void startContentParticipation('ideal-world-cup');
    setActiveSession(createSession(categoryId, tournamentSize));
  };

  const resetToSetup = () => {
    clearWorldCupSession();
    setSavedSession(null);
    setActiveSession(null);
  };

  const undoLastChoice = () => {
    setActiveSession((session) => {
      if (!session?.previous) {
        return session;
      }

      return {
        ...session,
        current: session.previous,
        previous: null,
      };
    });
  };

  if (!activeSession) {
    const savedState = savedSession?.current;
    const savedCategory = savedSession ? findCategory(savedSession.categoryId) : null;
    const selectedCategory = findCategory(selectedCategoryId);
    const availableSizes = SIZE_OPTIONS.filter(
      (size) => size <= selectedCategory.candidateIds.length,
    );

    return (
      <ScreenLayout className="world-cup-screen world-cup-setup">
        <button className="test-home-button" type="button" onClick={onBackHome}>
          <span aria-hidden="true">←</span> 홈
        </button>

        <header className="world-cup-hero">
          <p className="eyebrow">온기 · 토너먼트</p>
          <h1 aria-label="최애 월드컵">최애<br />월드컵</h1>
          <p className="world-cup-hero__subtitle">오늘 가장 끌리는 하나를 남겨보세요.</p>
        </header>

        {savedState ? (
          <section className="world-cup-resume" aria-labelledby="resume-title">
            <span>진행 중인 대진</span>
            <h2 id="resume-title">
              {savedCategory?.title} · {savedState.tournamentSize}강
            </h2>
            <p>
              {getRoundLabel(savedState.roundCandidateIds.length)} · 선택 {savedState.history.length}개 저장
            </p>
            <div>
              <PrimaryButton onClick={() => {
                setSelectedCategoryId(savedSession.categoryId);
                setActiveSession(savedSession);
              }}>이어하기</PrimaryButton>
              <button type="button" onClick={() => {
                clearWorldCupSession();
                setSavedSession(null);
              }}>
                저장된 대진 지우기
              </button>
            </div>
          </section>
        ) : null}

        <section className="world-cup-setup__section" aria-labelledby="topic-title">
          <span className="world-cup-step">01</span>
          <h2 id="topic-title">오늘의 주제</h2>
          <div className="world-cup-topic-options">
            {WORLD_CUP_CATEGORIES.map((category) => (
              <button
                className={`world-cup-topic-card${selectedCategoryId === category.id ? ' is-selected' : ''}`}
                type="button"
                aria-pressed={selectedCategoryId === category.id}
                onClick={() => {
                  setSelectedCategoryId(category.id);
                  if (selectedSize > category.candidateIds.length) {
                    setSelectedSize(32);
                  }
                }}
                key={category.id}
              >
                <img src={category.image} alt="" />
                <span>
                  <strong>{category.title}</strong>
                </span>
                <b aria-hidden="true">✓</b>
              </button>
            ))}
          </div>
        </section>

        <section className="world-cup-setup__section" aria-labelledby="size-title">
          <span className="world-cup-step">02</span>
          <h2 id="size-title">몇 강부터 시작할까요?</h2>
          <div className="world-cup-size-options">
            {availableSizes.map((size) => (
              <button
                className={selectedSize === size ? 'is-selected' : undefined}
                type="button"
                aria-label={`${size}강, ${SIZE_COPY[size]}`}
                aria-pressed={selectedSize === size}
                onClick={() => setSelectedSize(size)}
                key={size}
              >
                <strong>{size}강</strong>
                <small>{SIZE_COPY[size]}</small>
              </button>
            ))}
          </div>
        </section>

        <PrimaryButton
          className="world-cup-start"
          onClick={() => startNewTournament(selectedCategoryId, selectedSize)}
        >
          {selectedCategory.title} {selectedSize}강 시작하기
        </PrimaryButton>
        <p className="world-cup-credit">창작자 · hyunee</p>
      </ScreenLayout>
    );
  }

  const state = activeSession.current;
  const activeCategory = findCategory(activeSession.categoryId);

  if (state.phase === 'round-complete') {
    const completedRoundLabel = getRoundLabel(state.roundCandidateIds.length);
    const nextRoundLabel = getRoundLabel(state.winners.length);
    const previewCandidates = state.winners.slice(0, 6).map(findCandidate);

    return (
      <ScreenLayout className="world-cup-screen world-cup-round-complete">
        <button className="test-home-button" type="button" onClick={onBackHome}>
          <span aria-hidden="true">←</span> 홈
        </button>
        <div className="world-cup-round-complete__mark" aria-hidden="true">★</div>
        <p className="eyebrow">{activeCategory.title} · {completedRoundLabel} 완료</p>
        <h1>{nextRoundLabel} 진출!</h1>
        <p>{state.winners.length}개의 후보가 다음 대결을 기다리고 있어요.</p>

        <div className="world-cup-advance-preview" aria-label={`${nextRoundLabel} 진출 후보 미리보기`}>
          {previewCandidates.map((candidate) => (
            <CandidateVisual candidate={candidate} key={candidate.id} />
          ))}
        </div>

        <div className="world-cup-round-complete__actions">
          <PrimaryButton onClick={() => setActiveSession((session) => session ? {
            ...session,
            current: startNextRound(session.current),
          } : session)}>
            {nextRoundLabel} 계속하기
          </PrimaryButton>
          <button type="button" onClick={undoLastChoice}>방금 선택 취소</button>
        </div>
      </ScreenLayout>
    );
  }

  if (state.phase === 'champion') {
    const champion = findCandidate(state.championId ?? '');
    const defeatedCandidates = state.history
      .filter((match) => match.winnerId === champion.id)
      .map((match) => findCandidate(match.leftId === champion.id ? match.rightId : match.leftId));
    const shareResult = async () => {
      setIsSharingResult(true);
      clearNotice();

      try {
        const file = await createWorldCupResultFile({
          candidate: champion,
          categoryTitle: activeCategory.title,
          tournamentSize: state.tournamentSize,
        });
        const action = await shareWorldCupResultFile(file);
        reportShare(action);

        if (action === 'shared') {
          void recordShareClick('ideal-world-cup', 'native');
        }

      } catch {
        reportShare('failed');
      } finally {
        setIsSharingResult(false);
      }
    };

    return (
      <ScreenLayout className="world-cup-screen world-cup-champion">
        <div className="world-cup-champion__crown" aria-hidden="true">★</div>
        <p className="eyebrow">{activeCategory.title} 월드컵 우승</p>
        <h1>{champion.name}</h1>
        <div className="world-cup-champion__image">
          <CandidateVisual candidate={champion} />
        </div>
        <p>{state.tournamentSize}강에서 마지막까지 살아남은 오늘의 최애예요.</p>

        <section className="world-cup-champion__path" aria-labelledby="winner-path-title">
          <h2 id="winner-path-title">우승까지 만난 후보</h2>
          <div>
            {defeatedCandidates.map((candidate) => (
              <span key={candidate.id}>{candidate.name}</span>
            ))}
          </div>
        </section>

        <aside className="world-cup-closing-note" aria-label="끝으로 한마디">
          <span>끝으로 한마디</span>
          <p>{activeCategory.closingMessage}</p>
        </aside>

        <details className="world-cup-conversation">
          <summary>함께 이야기하기</summary>
          <p>{champion.name}을 고른 이유는 무엇인가요?</p>
        </details>
        <ShareNotice message={message} />

        <div className="world-cup-champion__actions">
          <PrimaryButton disabled={isSharingResult} onClick={shareResult}>
            {isSharingResult ? '이미지 만드는 중…' : '우승 이미지 공유하기'}
          </PrimaryButton>
          <button type="button" onClick={() => startNewTournament(activeSession.categoryId, state.tournamentSize)}>
            {state.tournamentSize}강 다시 하기
          </button>
          <button type="button" onClick={resetToSetup}>다른 주제 고르기</button>
          <button type="button" onClick={onBackHome}>홈으로</button>
        </div>
      </ScreenLayout>
    );
  }

  const [leftId, rightId] = getCurrentMatch(state);
  const leftCandidate = findCandidate(leftId);
  const rightCandidate = findCandidate(rightId);
  const roundSize = state.roundCandidateIds.length;
  const roundMatchCount = roundSize / 2;
  const totalMatchCount = getTotalMatchCount(state.tournamentSize);

  return (
    <ScreenLayout className="world-cup-screen world-cup-match">
      <button className="test-home-button" type="button" onClick={onBackHome}>
        <span aria-hidden="true">←</span> 홈
      </button>

      <header className="world-cup-match__progress">
        <div>
          <strong>{activeCategory.title} · {getRoundLabel(roundSize)}</strong>
          <span>{state.matchIndex + 1} / {roundMatchCount}</span>
        </div>
        <ProgressBar
          current={state.history.length}
          total={totalMatchCount}
          label="최애 월드컵 전체 진행률"
        />
        <small>전체 {state.history.length} / {totalMatchCount}</small>
      </header>

      <section className="world-cup-match__question" aria-labelledby="world-cup-match-title">
        <p className="eyebrow">오늘 더 끌리는 쪽은?</p>
        <h1 id="world-cup-match-title">하나만 고른다면</h1>
      </section>

      <div className="world-cup-duel" role="group" aria-label="월드컵 후보 대결">
        {[leftCandidate, rightCandidate].map((candidate, index) => (
          <div className="world-cup-duel__side" key={candidate.id}>
            <button
              type="button"
              aria-label={`${candidate.name} 선택`}
              onClick={() => setActiveSession((session) => session ? {
                ...session,
                current: chooseWinner(session.current, candidate.id),
                previous: session.current,
              } : session)}
            >
              <CandidateVisual candidate={candidate} />
              <strong>{candidate.name}</strong>
            </button>
            {index === 0 ? <span className="world-cup-duel__vs" aria-hidden="true">VS</span> : null}
          </div>
        ))}
      </div>

      <footer className="world-cup-match__footer">
        <button
          className="world-cup-undo"
          type="button"
          disabled={activeSession.previous === null}
          onClick={undoLastChoice}
        >
          ↶ 방금 선택 취소
        </button>
      </footer>
    </ScreenLayout>
  );
}
