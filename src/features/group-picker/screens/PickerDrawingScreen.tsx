import { ScreenLayout } from '../../../components/ScreenLayout';
import { getPickerModeDefinition } from '../domain/modeCatalog';
import type { DrawResult } from '../domain/types';

export function PickerDrawingScreen({ result }: { result: DrawResult }) {
  const drawingMode = getPickerModeDefinition(result.mode);
  return (
    <ScreenLayout className={`group-picker-screen group-picker-drawing is-${result.mode}`}>
      <div className="group-picker-drawing__visual" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>{drawingMode.icon}</span>
      </div>
      <p className="eyebrow">오늘은 누구?</p>
      <h1>{drawingMode.drawing}</h1>
      <div className="group-picker-drawing__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <p className="sr-only" role="status">
        {drawingMode.drawing}
      </p>
    </ScreenLayout>
  );
}
