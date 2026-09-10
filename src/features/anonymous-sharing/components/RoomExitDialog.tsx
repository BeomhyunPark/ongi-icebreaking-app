import { useEffect, useRef } from 'react';

export function RoomExitDialog({
  kind, busy, error, onCancel, onConfirm,
}: {
  kind: 'leave' | 'delete';
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const deleting = kind === 'delete';
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    cancel.current?.focus();
    return () => { element.close(); previous?.focus(); };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="anonymous-sharing-exit-dialog"
      aria-labelledby="room-exit-title"
      aria-describedby="room-exit-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
    >
      <h2 id="room-exit-title">{deleting ? '정말 이 방을 없앨까요?' : '모임에서 나갈까요?'}</h2>
      <p id="room-exit-description">
        {deleting
          ? '참여자 이름과 작성 중인 답변까지 즉시 삭제되며 다시 복구할 수 없어요.'
          : '내 이름과 작성한 답변이 삭제돼요. 다시 참여하려면 모임 입장이 열려 있을 때 QR을 스캔해주세요.'}
      </p>
      {error ? <p className="anonymous-sharing-error" role="alert">{error}</p> : null}
      <div>
        <button ref={cancel} type="button" disabled={busy} onClick={onCancel}>
          {deleting ? '계속 사용하기' : '계속 작성하기'}
        </button>
        <button className="is-danger" type="button" disabled={busy} onClick={onConfirm}>
          {busy ? (deleting ? '삭제하는 중…' : '나가는 중…') : (deleting ? '방 없애기' : '모임 나가기')}
        </button>
      </div>
    </dialog>
  );
}
