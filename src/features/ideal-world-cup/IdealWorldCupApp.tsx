import type { WorldCupCategoryId } from './domain/types';
import { useWorldCup } from './hooks/useWorldCup';
import { WorldCupSetupScreen } from './screens/WorldCupSetupScreen';
import { WorldCupRoundScreen } from './screens/WorldCupRoundScreen';
import { WorldCupChampionScreen } from './screens/WorldCupChampionScreen';
import { WorldCupMatchScreen } from './screens/WorldCupMatchScreen';
import './styles/ideal-world-cup.css';

type IdealWorldCupAppProps = {
  onBackHome: () => void;
  initialWorldCupCategory?: WorldCupCategoryId;
  onWorldCupCategoryChange?: (category: WorldCupCategoryId) => void;
};

export function IdealWorldCupApp({
  onBackHome,
  initialWorldCupCategory = 'meal',
  onWorldCupCategoryChange,
}: IdealWorldCupAppProps) {
  const model = useWorldCup(initialWorldCupCategory, onWorldCupCategoryChange);
  const { activeSession } = model;
  if (!activeSession) return <WorldCupSetupScreen {...model} onBackHome={onBackHome} />;
  if (activeSession.current.phase === 'round-complete')
    return <WorldCupRoundScreen {...model} activeSession={activeSession} onBackHome={onBackHome} />;
  if (activeSession.current.phase === 'champion')
    return (
      <WorldCupChampionScreen {...model} activeSession={activeSession} onBackHome={onBackHome} />
    );
  return <WorldCupMatchScreen {...model} activeSession={activeSession} onBackHome={onBackHome} />;
}
