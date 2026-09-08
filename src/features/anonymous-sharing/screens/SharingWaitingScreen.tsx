import type { AnonymousSharingController } from '../hooks/useAnonymousSharingController';
import type { RoomState } from '../domain/types';
import { HowToPlay } from '../components/HowToPlay';

export function SharingWaitingScreen({
  roomState,
  busy,
  editAnswers,
}: Pick<AnonymousSharingController, 'busy' | 'editAnswers'> & { roomState: RoomState }) {
  return (
    <section className="anonymous-sharing-waiting">
      <div aria-hidden="true">✓</div>
      <p className="eyebrow">작성 완료</p>
      <h1>이제 서로를 기다려요</h1>
      <p>진행자가 나눔을 시작하면 익명 프로필이 여기에 나타나요. 화면을 잠시 꺼도 괜찮아요.</p>
      <strong>
        {roomState.completedParticipantCount}/{roomState.participantCount}명 완료
      </strong>
      <button
        className="anonymous-sharing-edit"
        type="button"
        disabled={busy}
        onClick={editAnswers}
      >
        내 답변 확인·수정
      </button>
      <p>나눔 시작 전까지 수정할 수 있어요. 수정 후에는 다시 작성 완료를 눌러주세요.</p>
      <HowToPlay />
    </section>
  );
}
