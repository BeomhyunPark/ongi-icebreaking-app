import type { BalanceGameWeight } from './domain/types';
import { useBalanceGame } from './hooks/useBalanceGame';
import { BalanceSetupScreen } from './screens/BalanceSetupScreen';
import { BalancePickerScreen } from './screens/BalancePickerScreen';
import { BalanceCompleteScreen } from './screens/BalanceCompleteScreen';
import { BalancePlayScreen } from './screens/BalancePlayScreen';
import './styles/balance-game.css';

export { pickRandomQuestions } from './domain/pickQuestions';

type BalanceGameAppProps = {
  onBackHome: () => void;
  initialBalanceGameWeight?: BalanceGameWeight;
  onBalanceGameWeightChange?: (weight: BalanceGameWeight) => void;
};

export function BalanceGameApp({
  onBackHome,
  initialBalanceGameWeight = 'light',
  onBalanceGameWeightChange,
}: BalanceGameAppProps) {
  const model = useBalanceGame(initialBalanceGameWeight, onBalanceGameWeightChange);
  switch (model.phase) {
    case 'setup':
      return <BalanceSetupScreen {...model} onBackHome={onBackHome} />;
    case 'picker':
      return <BalancePickerScreen {...model} />;
    case 'complete':
      return <BalanceCompleteScreen {...model} onBackHome={onBackHome} />;
    case 'play':
      return <BalancePlayScreen {...model} />;
  }
}
