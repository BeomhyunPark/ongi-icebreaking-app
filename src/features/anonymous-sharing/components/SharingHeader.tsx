export function SharingHeader({ onBackHome, onLeave, busy = false }: {
  onBackHome: () => void;
  onLeave?: () => void;
  busy?: boolean;
}) {
  return (
    <header className="anonymous-sharing-header">
      <button type="button" disabled={busy} onClick={onLeave ?? onBackHome} aria-label={onLeave ? '모임 나가기' : '온기 홈으로 돌아가기'}>
        <span aria-hidden="true">←</span> {onLeave ? '모임 나가기' : '홈'}
      </button>
    </header>
  );
}
