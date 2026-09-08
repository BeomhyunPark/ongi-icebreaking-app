import { useEffect, useState } from 'react';

type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed' | 'downloaded';
const messages: Record<ShareOutcome, string> = {
  shared: '공유했어요.', copied: '링크를 복사했어요.', cancelled: '',
  failed: '공유하지 못했어요. 다시 시도해 주세요.', downloaded: '이미지 다운로드를 시작했어요.',
};

export function useShareNotice() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);
  return { message, clearNotice: () => setMessage(''), reportShare: (outcome: ShareOutcome) => setMessage(messages[outcome]) };
}

export function ShareNotice({ message }: { message: string }) {
  return message ? <p className="share-feedback" role="status">{message}</p> : null;
}
