import { ScreenLayout } from '../../../components/ScreenLayout';
import { PrimaryButton } from '../../../components/PrimaryButton';
import type { WorldCupController } from '../hooks/useWorldCup';
import type { WorldCupSession } from '../domain/types';
import { CandidateVisual } from '../components/CandidateVisual';
import { ShareNotice } from '../../../components/ShareNotice';
import { findCandidate, findCategory } from '../data/catalog';
import { useWorldCupShare } from '../hooks/useWorldCupShare';

export function WorldCupChampionScreen({
  activeSession,
  startNewTournament,
  resetToSetup,
  onBackHome,
}: Pick<WorldCupController, 'startNewTournament' | 'resetToSetup'> & {
  onBackHome: () => void;
  activeSession: WorldCupSession;
}) {
  const state = activeSession.current;
  const activeCategory = findCategory(activeSession.categoryId);
  const champion = findCandidate(state.championId ?? '');
  const defeatedCandidates = state.history
    .filter((match) => match.winnerId === champion.id)
    .map((match) => findCandidate(match.leftId === champion.id ? match.rightId : match.leftId));
  const { message, isSharingResult, shareResult } = useWorldCupShare(
    champion,
    activeCategory.title,
    state.tournamentSize,
  );

  return (
    <ScreenLayout className="world-cup-screen world-cup-champion">
      <div className="world-cup-champion__crown" aria-hidden="true">
        ★
      </div>
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
        <button
          type="button"
          onClick={() => startNewTournament(activeSession.categoryId, state.tournamentSize)}
        >
          {state.tournamentSize}강 다시 하기
        </button>
        <button type="button" onClick={resetToSetup}>
          다른 주제 고르기
        </button>
        <button type="button" onClick={onBackHome}>
          홈으로
        </button>
      </div>
    </ScreenLayout>
  );
}
