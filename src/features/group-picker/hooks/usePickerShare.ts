import { useState } from 'react';
import { useShareNotice } from '../../../components/ShareNotice';
import { recordShareClick } from '../../../engagement/tracker';
import { getPickerModeDefinition } from '../domain/modeCatalog';
import type { DrawResult } from '../domain/types';
import { createGroupPickerResultFile, shareGroupPickerResultFile } from '../services/resultImage';
import { presentPickerResult } from '../services/resultPresentation';

export function usePickerShare(result: DrawResult) {
  const [isSharing, setIsSharing] = useState(false);
  const { message, clearNotice, reportShare } = useShareNotice();
  const shareResult = async () => {
    setIsSharing(true);
    clearNotice();
    try {
      const file = await createGroupPickerResultFile({
        modeTitle: getPickerModeDefinition(result.mode).title,
        ...presentPickerResult(result),
      });
      const action = await shareGroupPickerResultFile(file);
      reportShare(action);
      if (action === 'shared') void recordShareClick('group-picker', 'native');
    } catch {
      reportShare('failed');
    } finally {
      setIsSharing(false);
    }
  };
  return { isSharing, message, shareResult };
}
