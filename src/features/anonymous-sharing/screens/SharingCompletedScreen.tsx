import { PrimaryButton } from '../../../components/PrimaryButton';
import type { AnonymousSharingController } from '../hooks/useAnonymousSharingController';

export function SharingCompletedScreen({
  handleBackHome,
  startNewRoom,
}: Pick<AnonymousSharingController, 'handleBackHome' | 'startNewRoom'>) {
  return (
    <section className="anonymous-sharing-completed">
      <div className="anonymous-sharing-completed-symbol" aria-hidden="true">
        ♡
      </div>
      <p className="eyebrow">모임 종료</p>
      <h1>
        함께 나눈 이야기는
        <br />
        모두 지웠어요
      </h1>
      <div className="anonymous-sharing-completed-actions">
        <PrimaryButton onClick={startNewRoom}>새 모임 만들기</PrimaryButton>
        <button className="anonymous-sharing-home-link" type="button" onClick={handleBackHome}>
          홈으로 돌아가기
        </button>
      </div>
    </section>
  );
}
