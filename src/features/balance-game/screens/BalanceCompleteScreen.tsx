import { PrimaryButton } from '../../../components/PrimaryButton';
import { ScreenLayout } from '../../../components/ScreenLayout';
import type { BalanceController } from '../hooks/useBalanceGame';

export function BalanceCompleteScreen({
  weight,
  playQuestions,
  showPicker,
  reviewChoices,
  onBackHome,
}: Pick<BalanceController, 'weight' | 'playQuestions' | 'showPicker' | 'reviewChoices'> & {
  onBackHome: () => void;
}) {
  return (
    <ScreenLayout className={`balance-game-screen balance-game-screen--${weight} balance-complete`}>
      <div className="balance-complete__mark" aria-hidden="true">
        ✦
      </div>
      <p className="eyebrow">오늘의 밸런스 완료</p>
      <h1>
        {playQuestions.length}개의 선택,
        <br />
        서로 다른 이야기
      </h1>
      <p>
        같은 답보다 왜 골랐는지를 나눌 때<br />
        우리 사이가 조금 더 가까워져요.
      </p>
      <div className="balance-complete__actions">
        <PrimaryButton onClick={showPicker}>다른 질문 골라보기</PrimaryButton>
        <button type="button" onClick={reviewChoices}>
          내 선택 다시 보기
        </button>
        <button type="button" onClick={onBackHome}>
          홈으로
        </button>
      </div>
    </ScreenLayout>
  );
}
