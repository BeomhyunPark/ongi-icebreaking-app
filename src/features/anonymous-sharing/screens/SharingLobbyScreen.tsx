import { PrimaryButton } from '../../../components/PrimaryButton';
import type { AnonymousSharingController } from '../hooks/useAnonymousSharingController';
import type { RoomState } from '../domain/types';
import { QRCodeSVG } from 'qrcode.react';

export function SharingLobbyScreen({
  roomState,
  participants,
  name,
  setName,
  busy,
  setHostWriting,
  setCancelConfirming,
  lockRoom,
  unlockRoom,
  joinAsHostParticipant,
  startSharing,
  editAnswers,
  visibleRoomCode,
  shareUrl,
  lobbyStep,
}: Pick<
  AnonymousSharingController,
  | 'participants'
  | 'name'
  | 'setName'
  | 'busy'
  | 'setHostWriting'
  | 'setCancelConfirming'
  | 'lockRoom'
  | 'unlockRoom'
  | 'joinAsHostParticipant'
  | 'startSharing'
  | 'editAnswers'
  | 'visibleRoomCode'
  | 'shareUrl'
  | 'lobbyStep'
> & { roomState: RoomState }) {
  return (
    <section className="anonymous-sharing-lobby">
      <p className="eyebrow">진행자 화면</p>
      <h1>{roomState.title}</h1>
      <ol className="anonymous-sharing-flow" aria-label="나눔 진행 단계">
        {['QR 공유', '입장 마감', '작성 완료', '나눔 시작'].map((label, index) => (
          <li className={index <= lobbyStep ? 'is-active' : ''} key={label}>
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <p className="anonymous-sharing-guide">나눔은 3명 이상부터 시작할 수 있어요.</p>
      {roomState.status !== 'LOCKED' && visibleRoomCode ? (
        <div className="anonymous-sharing-invite">
          <div className="anonymous-sharing-qr" role="img" aria-label="모임 참여 QR 코드">
            <QRCodeSVG value={shareUrl} size={164} level="M" marginSize={2} />
          </div>
          <p>카메라로 QR을 스캔해 참여해주세요.</p>
        </div>
      ) : (
        <div className="anonymous-sharing-locked">
          <span aria-hidden="true">✓</span> 참여자 입장을 마감했어요.
        </div>
      )}

      {!roomState.participantJoined && roomState.status !== 'LOCKED' ? (
        <div className="anonymous-sharing-host-participation">
          <strong>진행자도 함께 참여할까요?</strong>
          <p>이름을 입력하면 진행 권한은 유지하면서 익명 답변도 작성할 수 있어요.</p>
          <label htmlFor="sharing-host-name">내 이름</label>
          <input
            id="sharing-host-name"
            value={name}
            maxLength={40}
            autoComplete="name"
            placeholder="모임에서 사용할 이름"
            onChange={(event) => setName(event.target.value)}
          />
          <button type="button" disabled={busy || !name.trim()} onClick={joinAsHostParticipant}>
            나도 참여하기
          </button>
        </div>
      ) : null}

      {roomState.role === 'HOST' && roomState.participantJoined ? (
        <div className="anonymous-sharing-host-participation is-joined">
          <strong>
            {roomState.responseCompleted ? '내 답변 작성 완료' : '진행자도 참여 중이에요'}
          </strong>
          {roomState.responseCompleted ? (
            <button type="button" disabled={busy} onClick={editAnswers}>
              내 답변 확인·수정
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => setHostWriting(true)}>
              내 답변 작성하기
            </button>
          )}
        </div>
      ) : null}

      <div className="anonymous-sharing-progress-summary">
        <strong>
          {roomState.completedParticipantCount}/{roomState.participantCount}
        </strong>
        <span>작성 완료</span>
      </div>
      <ul className="anonymous-sharing-participants">
        {participants.map((participant) => (
          <li key={`${participant.name}-${participant.joinedAt}`}>
            <span>{participant.name}</span>
            <b className={participant.responseCompleted ? 'is-done' : ''}>
              {participant.responseCompleted ? '작성 완료' : '작성 중'}
            </b>
          </li>
        ))}
      </ul>
      {participants.length === 0 ? (
        <p className="anonymous-sharing-empty">QR을 공유하고 참여자를 기다려주세요.</p>
      ) : null}

      <div className="anonymous-sharing-lobby-actions">
        {roomState.status !== 'LOCKED' ? (
          <PrimaryButton disabled={busy || roomState.participantCount === 0} onClick={lockRoom}>
            참여자 입장 마감
          </PrimaryButton>
        ) : (
          <>
            <PrimaryButton
              disabled={
                busy ||
                roomState.participantCount < 3 ||
                roomState.completedParticipantCount !== roomState.participantCount
              }
              onClick={startSharing}
            >
              모두 준비됐어요 · 나눔 시작
            </PrimaryButton>
            <button type="button" disabled={busy} onClick={unlockRoom}>
              참여자 입장 다시 열기
            </button>
          </>
        )}
      </div>
      {roomState.status === 'LOCKED' &&
      roomState.completedParticipantCount !== roomState.participantCount ? (
        <p className="anonymous-sharing-help">모든 참여자가 작성을 완료하면 시작할 수 있어요.</p>
      ) : null}

      <div className="anonymous-sharing-cancel-room">
        <button type="button" disabled={busy} onClick={() => setCancelConfirming(true)}>
          방 없애기
        </button>
      </div>
    </section>
  );
}
