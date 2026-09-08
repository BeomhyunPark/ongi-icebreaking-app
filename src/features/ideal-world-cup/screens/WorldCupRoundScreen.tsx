import { ScreenLayout } from '../../../components/ScreenLayout';
import { PrimaryButton } from '../../../components/PrimaryButton';
import type { WorldCupController } from '../hooks/useWorldCup';
import type { WorldCupSession } from '../domain/types';
import { CandidateVisual } from '../components/CandidateVisual';
import { findCandidate, findCategory } from '../data/catalog';
import { getRoundLabel } from '../domain/tournament';

export function WorldCupRoundScreen({
  activeSession,
  nextRound,
  undoLastChoice,
  onBackHome,
}: Pick<WorldCupController, 'nextRound' | 'undoLastChoice'> & {
  onBackHome: () => void;
  activeSession: WorldCupSession;
}) {
  const state = activeSession.current;
  const activeCategory = findCategory(activeSession.categoryId);
  const completedRoundLabel = getRoundLabel(state.roundCandidateIds.length);
  const nextRoundLabel = getRoundLabel(state.winners.length);
  const previewCandidates = state.winners.slice(0, 6).map(findCandidate);

  return (
    <ScreenLayout className="world-cup-screen world-cup-round-complete">
      <button className="test-home-button" type="button" onClick={onBackHome}>
        <span aria-hidden="true">←</span> 홈
      </button>
      <div className="world-cup-round-complete__mark" aria-hidden="true">
        ★
      </div>
      <p className="eyebrow">
        {activeCategory.title} · {completedRoundLabel} 완료
      </p>
      <h1>{nextRoundLabel} 진출!</h1>
      <p>{state.winners.length}개의 후보가 다음 대결을 기다리고 있어요.</p>

      <div
        className="world-cup-advance-preview"
        aria-label={`${nextRoundLabel} 진출 후보 미리보기`}
      >
        {previewCandidates.map((candidate) => (
          <CandidateVisual candidate={candidate} key={candidate.id} />
        ))}
      </div>

      <div className="world-cup-round-complete__actions">
        <PrimaryButton onClick={nextRound}>{nextRoundLabel} 계속하기</PrimaryButton>
        <button type="button" onClick={undoLastChoice}>
          방금 선택 취소
        </button>
      </div>
    </ScreenLayout>
  );
}
