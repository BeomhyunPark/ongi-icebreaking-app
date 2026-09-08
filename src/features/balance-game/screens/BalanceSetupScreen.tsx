import { ScreenLayout } from '../../../components/ScreenLayout';
import type { BalanceController } from '../hooks/useBalanceGame';

export function BalanceSetupScreen({
  weight,
  selectWeight,
  startRandomGame,
  showPicker,
  onBackHome,
}: Pick<BalanceController, 'weight' | 'selectWeight' | 'startRandomGame' | 'showPicker'> & {
  onBackHome: () => void;
}) {
  return (
    <ScreenLayout
      className={`balance-game-screen balance-game-screen--${weight} balance-setup balance-setup--${weight}`}
    >
      <button className="test-home-button" type="button" onClick={onBackHome}>
        <span aria-hidden="true">←</span> 홈
      </button>

      <header className="balance-header">
        <p className="eyebrow">온기 · VS 놀이</p>
        <h1 aria-label="극과 극 밸런스 게임">
          극과 극<br />
          밸런스 게임
        </h1>
      </header>

      <section className="balance-section" aria-labelledby="weight-title">
        <span className="balance-step">01</span>
        <h2 id="weight-title">오늘 대화의 온도</h2>
        <div className="balance-weight-grid">
          <button
            className={`balance-weight balance-weight--light${weight === 'light' ? ' is-selected' : ''}`}
            type="button"
            aria-pressed={weight === 'light'}
            onClick={() => selectWeight('light')}
          >
            <span aria-hidden="true">☀</span>
            <strong>가볍게</strong>
            <small>처음 만나도 편한 질문</small>
          </button>
          <button
            className={`balance-weight balance-weight--deep${weight === 'deep' ? ' is-selected' : ''}`}
            type="button"
            aria-pressed={weight === 'deep'}
            onClick={() => selectWeight('deep')}
          >
            <span aria-hidden="true">☾</span>
            <strong>조금 깊게</strong>
            <small>천천히 이유를 나누는 질문</small>
          </button>
        </div>
      </section>

      <section className="balance-section" aria-labelledby="mode-title">
        <span className="balance-step">02</span>
        <h2 id="mode-title">질문을 고르는 방법</h2>
        <div className="balance-mode-list">
          <button type="button" onClick={startRandomGame}>
            <strong>랜덤으로 시작</strong>
          </button>
          <button type="button" onClick={showPicker}>
            <strong>직접 골라 담기</strong>
          </button>
        </div>
      </section>
      <p className="balance-credit">창작자 · CK</p>
    </ScreenLayout>
  );
}
