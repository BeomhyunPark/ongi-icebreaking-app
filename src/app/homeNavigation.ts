import { PICKER_SHORTCUTS } from '../features/group-picker/domain/modeCatalog';
import type { ActivityTarget } from './activityNavigation';

// Translate feature metadata into links owned by the app shell.
export const HOME_TOOL_SHORTCUTS = PICKER_SHORTCUTS.map(({ id, shortcutLabel }) => ({
  label: shortcutLabel,
  target: { id: 'group-picker', initialGroupPickerMode: id } satisfies ActivityTarget,
}));
