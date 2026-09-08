import { shareAppLink } from '../../../platform/shareLink';
import { useState } from 'react';
import { ShareNotice, useShareNotice } from '../../../components/ShareNotice';

export function ShareApp() {
  const [busy, setBusy] = useState(false);
  const { message, clearNotice, reportShare } = useShareNotice();
  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    clearNotice();
    try {
      reportShare(await shareAppLink());
    } catch {
      reportShare('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="share-app">
      <button
        className="share-app__button"
        type="button"
        aria-label="공유하기"
        disabled={busy}
        onClick={handleShare}
      >
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
          </svg>
        </span>
      </button>
      <ShareNotice message={message} />
    </div>
  );
}
