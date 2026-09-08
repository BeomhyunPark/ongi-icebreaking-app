export function SharingHeader({ onBackHome }: { onBackHome: () => void }) {
  return (
    <header className="anonymous-sharing-header">
      <button type="button" onClick={onBackHome} aria-label="온기 홈으로 돌아가기">
        <span aria-hidden="true">←</span> 홈
      </button>
    </header>
  );
}
