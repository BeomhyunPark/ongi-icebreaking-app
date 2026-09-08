import { useState } from 'react';
import { useShareNotice } from '../../../components/ShareNotice';
import { recordShareClick } from '../../../engagement/tracker';
import type { TournamentSize, WorldCupCandidate } from '../domain/types';
import { createWorldCupResultFile, shareWorldCupResultFile } from '../services/resultImage';

export function useWorldCupShare(
  champion: WorldCupCandidate,
  categoryTitle: string,
  tournamentSize: TournamentSize,
) {
  const [isSharingResult, setIsSharingResult] = useState(false);
  const { message, clearNotice, reportShare } = useShareNotice();
  const shareResult = async () => {
    setIsSharingResult(true);
    clearNotice();

    try {
      const file = await createWorldCupResultFile({
        candidate: champion,
        categoryTitle,
        tournamentSize,
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

  return { message, isSharingResult, shareResult };
}
