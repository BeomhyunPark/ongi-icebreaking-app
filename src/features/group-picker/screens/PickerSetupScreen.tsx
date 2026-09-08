import { PrimaryButton } from '../../../components/PrimaryButton';
import { ScreenLayout } from '../../../components/ScreenLayout';
import { PICKER_MODES } from '../domain/modeCatalog';
import { MAX_PARTICIPANTS } from '../domain/items';
import { ItemEditor } from '../components/ItemEditor';
import type { PickerController } from '../hooks/useGroupPicker';

export function PickerSetupScreen({
  mode,
  names,
  nameDraft,
  outcomes,
  outcomeDraft,
  winnerCount,
  groupCount,
  error,
  selectedMode,
  selectMode,
  clearItems,
  setNames,
  setNameDraft,
  setOutcomes,
  setOutcomeDraft,
  setWinnerCount,
  setGroupCount,
  prepareDraw,
  onBackHome,
}: Pick<
  PickerController,
  | 'mode'
  | 'names'
  | 'nameDraft'
  | 'outcomes'
  | 'outcomeDraft'
  | 'winnerCount'
  | 'groupCount'
  | 'error'
  | 'selectedMode'
  | 'selectMode'
  | 'clearItems'
  | 'setNames'
  | 'setNameDraft'
  | 'setOutcomes'
  | 'setOutcomeDraft'
  | 'setWinnerCount'
  | 'setGroupCount'
  | 'prepareDraw'
> & { onBackHome: () => void }) {
  return (
    <ScreenLayout className="group-picker-screen group-picker-setup">
      <button className="test-home-button" type="button" onClick={onBackHome}>
        <span aria-hidden="true">←</span> 홈
      </button>
      <header className="group-picker-hero">
        <p className="eyebrow">온기 · 모임 도구</p>
        <h1 aria-label="오늘은 누구?">
          오늘은
          <br />
          누구?
        </h1>
      </header>

      <section className="group-picker-section" aria-labelledby="picker-mode-title">
        <h2 id="picker-mode-title">무엇을 정할까요?</h2>
        <div className="group-picker-modes">
          {PICKER_MODES.map((item) => (
            <button
              className={`${mode === item.id ? 'is-selected ' : ''}is-${item.id}`.trim()}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => selectMode(item.id)}
              key={item.id}
            >
              <span aria-hidden="true">{item.icon}</span>
              <strong>{item.title}</strong>
              <b aria-hidden="true">✓</b>
            </button>
          ))}
        </div>
      </section>

      <section className="group-picker-section" aria-labelledby="picker-names-title">
        <div className="group-picker-section__heading">
          <h2 id="picker-names-title">함께할 사람</h2>
          <div className="group-picker-section__controls">
            <span>
              {names.length}/{MAX_PARTICIPANTS}
            </span>
            {names.length > 0 ? (
              <button type="button" onClick={clearItems}>
                모두 지우기
              </button>
            ) : null}
          </div>
        </div>
        <ItemEditor
          id="group-picker-name"
          label="참여자"
          items={names}
          draft={nameDraft}
          max={MAX_PARTICIPANTS}
          placeholder="이름 입력"
          onDraftChange={setNameDraft}
          onItemsChange={setNames}
        />
      </section>

      {mode === 'lottery' ? (
        <section className="group-picker-section" aria-labelledby="winner-count-title">
          <div className="group-picker-section__heading">
            <h2 id="winner-count-title">몇 명을 뽑을까요?</h2>
            <strong>{Math.min(winnerCount, Math.max(1, names.length - 1))}명</strong>
          </div>
          <input
            type="range"
            min="1"
            max={Math.max(1, names.length - 1)}
            value={Math.min(winnerCount, Math.max(1, names.length - 1))}
            aria-label="당첨 인원"
            onChange={(event) => setWinnerCount(Number(event.target.value))}
          />
        </section>
      ) : null}

      {mode === 'groups' ? (
        <section className="group-picker-section" aria-labelledby="group-count-title">
          <div className="group-picker-section__heading">
            <h2 id="group-count-title">몇 조로 나눌까요?</h2>
            <strong>{Math.min(groupCount, Math.max(2, names.length))}조</strong>
          </div>
          <input
            type="range"
            min="2"
            max={Math.max(2, Math.min(8, names.length))}
            value={Math.min(groupCount, Math.max(2, Math.min(8, names.length)))}
            aria-label="나눔 조 개수"
            onChange={(event) => setGroupCount(Number(event.target.value))}
          />
        </section>
      ) : null}

      {mode === 'ladder' ? (
        <section className="group-picker-section" aria-labelledby="outcomes-title">
          <div className="group-picker-section__heading">
            <h2 id="outcomes-title">사다리 결과</h2>
            <span>
              {outcomes.length}/{names.length}
            </span>
          </div>
          <div className="group-picker-presets" aria-label="사다리 결과 빠른 설정">
            <button
              type="button"
              disabled={names.length < 2}
              onClick={() => setOutcomes(['커피 사기', ...names.slice(1).map(() => '통과')])}
            >
              커피 내기
            </button>
            <button
              type="button"
              disabled={names.length < 2}
              onClick={() => setOutcomes(['간식 사기', ...names.slice(1).map(() => '통과')])}
            >
              간식 내기
            </button>
            <button
              type="button"
              disabled={names.length < 2}
              onClick={() => setOutcomes(['꽝', ...names.slice(1).map(() => '통과')])}
            >
              한 명만 꽝
            </button>
            <button
              type="button"
              disabled={names.length < 2}
              onClick={() => setOutcomes(names.map((_, index) => `${index + 1}번`))}
            >
              번호만
            </button>
          </div>
          <ItemEditor
            id="group-picker-outcome"
            label="사다리 결과"
            items={outcomes}
            draft={outcomeDraft}
            max={Math.max(1, names.length)}
            placeholder="결과 입력"
            allowDuplicates
            onDraftChange={setOutcomeDraft}
            onItemsChange={setOutcomes}
          />
        </section>
      ) : null}

      {error ? (
        <p className="group-picker-error" role="alert">
          {error}
        </p>
      ) : null}
      <PrimaryButton className="group-picker-start" onClick={prepareDraw}>
        {selectedMode.action}
      </PrimaryButton>
      <p className="group-picker-credit">창작자 · hyunee</p>
    </ScreenLayout>
  );
}
