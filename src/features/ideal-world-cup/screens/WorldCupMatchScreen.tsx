import { ScreenLayout } from '../../../components/ScreenLayout';
import type { WorldCupController } from '../hooks/useWorldCup';
import type { WorldCupSession } from '../domain/types';
import { CandidateVisual } from '../components/CandidateVisual';
import { ProgressBar } from '../../../components/ProgressBar';
import { findCandidate, findCategory } from '../data/catalog';
import { getCurrentMatch, getRoundLabel, getTotalMatchCount } from '../domain/tournament';

export function WorldCupMatchScreen({
  activeSession,
  selectWinner,
  undoLastChoice,
  onBackHome,
}: Pick<WorldCupController, 'selectWinner' | 'undoLastChoice'> & {
  onBackHome: () => void;
  activeSession: WorldCupSession;
}) {
  const state = activeSession.current;
  const activeCategory = findCategory(activeSession.categoryId);
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
          <strong>
            {activeCategory.title} · {getRoundLabel(roundSize)}
          </strong>
          <span>
            {state.matchIndex + 1} / {roundMatchCount}
          </span>
        </div>
        <ProgressBar
          current={state.history.length}
          total={totalMatchCount}
          label="최애 월드컵 전체 진행률"
        />
        <small>
          전체 {state.history.length} / {totalMatchCount}
        </small>
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
              onClick={() => selectWinner(candidate.id)}
            >
              <CandidateVisual candidate={candidate} />
              <strong>{candidate.name}</strong>
            </button>
            {index === 0 ? (
              <span className="world-cup-duel__vs" aria-hidden="true">
                VS
              </span>
            ) : null}
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
