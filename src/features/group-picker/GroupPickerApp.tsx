import type { PickerMode } from './domain/types';
import { useGroupPicker } from './hooks/useGroupPicker';
import { PickerSetupScreen } from './screens/PickerSetupScreen';
import { PickerDrawingScreen } from './screens/PickerDrawingScreen';
import { PickerResultScreen } from './screens/PickerResultScreen';
import './styles/group-picker.css';

type GroupPickerAppProps = {
  onBackHome: () => void;
  initialGroupPickerMode?: PickerMode;
  onGroupPickerModeChange?: (mode: PickerMode) => void;
};

export function GroupPickerApp({ onBackHome, initialGroupPickerMode = 'prayer', onGroupPickerModeChange }: GroupPickerAppProps) {
  const picker = useGroupPicker(initialGroupPickerMode, onGroupPickerModeChange);
  if (picker.state.phase === 'drawing') return <PickerDrawingScreen result={picker.state.result} />;
  if (picker.state.phase === 'result') return <PickerResultScreen {...picker} result={picker.state.result} onBackHome={onBackHome} />;
  return <PickerSetupScreen {...picker} onBackHome={onBackHome} />;
}
