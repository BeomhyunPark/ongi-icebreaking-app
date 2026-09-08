import { useState, type KeyboardEvent } from 'react';
import { mergeItems, parseItems } from '../domain/items';

type ItemEditorProps = {
  id: string;
  label: string;
  items: readonly string[];
  draft: string;
  max: number;
  placeholder: string;
  allowDuplicates?: boolean;
  onDraftChange: (value: string) => void;
  onItemsChange: (items: string[]) => void;
};

export function ItemEditor({
  id,
  label,
  items,
  draft,
  max,
  placeholder,
  allowDuplicates = false,
  onDraftChange,
  onItemsChange,
}: ItemEditorProps) {
  const [notice, setNotice] = useState('');
  const addItems = (value: string) => {
    const added = parseItems(value);
    const merged = mergeItems(items, value, max, allowDuplicates);
    const duplicated =
      !allowDuplicates && new Set([...items, ...added]).size < items.length + added.length;
    setNotice(
      [
        duplicated ? '같은 이름은 번호로 구분했어요.' : '',
        items.length + added.length > max
          ? `최대 ${max}개예요. 초과한 항목은 입력란에 남겼어요.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
    onItemsChange(merged);
    onDraftChange(added.slice(max - items.length).join(', '));
  };
  const addDraft = () => {
    if (!draft.trim()) return;
    addItems(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!event.nativeEvent.isComposing && (event.key === 'Enter' || event.key === ',')) {
      event.preventDefault();
      addDraft();
    }
  };

  return (
    <div className="group-picker-editor">
      <div className="group-picker-editor__field">
        <input
          id={id}
          aria-label={label}
          value={draft}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (/[\n,]/.test(pasted)) {
              event.preventDefault();
              addItems(pasted);
            }
          }}
        />
        <button type="button" onClick={addDraft} disabled={!draft.trim() || items.length >= max}>
          추가
        </button>
      </div>
      {notice ? (
        <p className="group-picker-input-notice" role="status">
          {notice}
        </p>
      ) : null}
      {items.length > 0 ? (
        <div className="group-picker-chips" aria-label={`${label} 목록`}>
          {items.map((item, itemIndex) => (
            <span key={`${item}-${itemIndex}`}>
              {item}
              <button
                type="button"
                aria-label={`${item} ${itemIndex + 1}번째 삭제`}
                onClick={() => onItemsChange(items.filter((_, index) => index !== itemIndex))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
