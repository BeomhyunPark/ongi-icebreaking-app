import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';

import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenLayout } from '../../components/ScreenLayout';
import {
  createLadder,
  createPrayerSupportAssignments,
  resolveLadder,
  shuffle,
  splitIntoGroups,
  splitIntoPairs,
  traceLadder,
  type Ladder,
  type PrayerSupportAssignment,
} from './domain/draw';
import { getPickerModeDefinition, PICKER_MODES } from './domain/modeCatalog';
import { getSpecialOutcomeValues } from './domain/outcomes';
import type { PickerMode } from './domain/types';
import { loadGroupNames, saveGroupNames } from './services/nameStorage';
import {
  createGroupPickerResultFile,
  shareGroupPickerResultFile,
  type GroupPickerResultEntry,
} from './services/resultImage';
import './styles/group-picker.css';
import {
  completeContentParticipation,
  recordShareClick,
  startContentParticipation,
} from '../../engagement/tracker';

type GroupPickerAppProps = {
  onBackHome: () => void;
  initialGroupPickerMode?: PickerMode;
  onGroupPickerModeChange?: (mode: PickerMode) => void;
};
type PickerPhase = 'setup' | 'drawing' | 'result';

type DrawResult = {
  mode: PickerMode;
  orderedNames: string[];
  winnerCount: number;
  ladder: Ladder | null;
  outcomes: string[];
  groups: string[][];
  supportAssignments: PrayerSupportAssignment<string>[];
};

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

const DRAW_DELAY_MS = 1600;
const LADDER_TRACE_DELAY_MS = 1100;
const MAX_PARTICIPANTS = 32;

function parseItems(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function mergeItems(
  items: readonly string[],
  value: string,
  max: number,
  allowDuplicates = false,
): string[] {
  const merged = [...items];

  for (const item of parseItems(value)) {
    if ((allowDuplicates || !merged.includes(item)) && merged.length < max) {
      merged.push(item);
    }
  }

  return merged;
}

function ItemEditor({
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
  const addDraft = () => {
    if (!draft.trim()) return;
    onItemsChange(mergeItems(items, draft, max, allowDuplicates));
    onDraftChange('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addDraft();
    }
  };

  return (
    <div className="group-picker-editor">
      <div className="group-picker-editor__field">
        <input
          id={id}
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
              onItemsChange(mergeItems(items, pasted, max, allowDuplicates));
              onDraftChange('');
            }
          }}
        />
        <button type="button" onClick={addDraft} disabled={!draft.trim() || items.length >= max}>추가</button>
      </div>
      {items.length > 0 ? (
        <div className="group-picker-chips" aria-label={`${label} 목록`}>
          {items.map((item, itemIndex) => (
            <span key={`${item}-${itemIndex}`}>
              {item}
              <button
                type="button"
                aria-label={`${item} ${itemIndex + 1}번째 삭제`}
                onClick={() => onItemsChange(items.filter((_, index) => index !== itemIndex))}
              >×</button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildTracePoints(ladder: Ladder, startColumn: number): string {
  const gap = 86;
  const side = 34;
  const top = 58;
  const rowGap = 24;
  const trace = traceLadder(ladder, startColumn);
  const points: string[] = [`${side + startColumn * gap},${top - 28}`];
  let currentColumn = startColumn;

  trace.columnsByRow.forEach((nextColumn, row) => {
    const y = top + row * rowGap;
    points.push(`${side + currentColumn * gap},${y}`);
    if (nextColumn !== currentColumn) points.push(`${side + nextColumn * gap},${y}`);
    currentColumn = nextColumn;
  });

  points.push(`${side + currentColumn * gap},${top + (ladder.rowCount - 1) * rowGap + 28}`);
  return points.join(' ');
}

function LadderBoard({
  names,
  outcomes,
  ladder,
  activeStart,
  revealedStarts,
  onSelectStart,
}: {
  names: readonly string[];
  outcomes: readonly string[];
  ladder: Ladder;
  activeStart: number | null;
  revealedStarts: ReadonlySet<number>;
  onSelectStart: (index: number) => void;
}) {
  const gap = 86;
  const side = 34;
  const top = 58;
  const rowGap = 24;
  const bottom = top + (ladder.rowCount - 1) * rowGap;
  const width = side * 2 + gap * (ladder.columnCount - 1);
  const height = bottom + 44;
  const destinations = resolveLadder(ladder);
  const specialOutcomes = getSpecialOutcomeValues(outcomes);
  const revealedDestinations = new Set([...revealedStarts].map((start) => destinations[start]));

  return (
    <div className="group-picker-ladder-scroll">
      <div className="group-picker-ladder-board" style={{ minWidth: `${width}px` }}>
        <div className="group-picker-ladder-labels" style={{ gridTemplateColumns: `repeat(${names.length}, 1fr)` }}>
          {names.map((name, index) => (
            <button
              className={revealedStarts.has(index) ? 'is-revealed' : undefined}
              type="button"
              disabled={activeStart !== null}
              onClick={() => onSelectStart(index)}
              key={name}
            >{name}</button>
          ))}
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="완성된 사다리">
          {names.map((name, index) => {
            const x = side + index * gap;
            return <line className="ladder-line" x1={x} y1={top - 28} x2={x} y2={bottom + 28} key={name} />;
          })}
          {ladder.rungs.map((rung) => {
            const x = side + rung.leftColumn * gap;
            const y = top + rung.row * rowGap;
            return <line className="ladder-line" x1={x} y1={y} x2={x + gap} y2={y} key={`${rung.row}-${rung.leftColumn}`} />;
          })}
          {activeStart !== null ? (
            <polyline
              className={`ladder-trace${revealedStarts.has(activeStart) ? ' is-replay' : ''}`}
              pathLength="1"
              points={buildTracePoints(ladder, activeStart)}
            />
          ) : null}
        </svg>
        <div className="group-picker-ladder-labels is-outcomes" style={{ gridTemplateColumns: `repeat(${outcomes.length}, 1fr)` }}>
          {outcomes.map((outcome, index) => (
            <span className={`${revealedDestinations.has(index) ? 'is-revealed' : ''}${specialOutcomes.has(outcome) ? ' is-special' : ''}`.trim()} key={`${outcome}-${index}`}>
              {revealedDestinations.has(index) ? outcome : '?'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GroupPickerApp({
  onBackHome,
  initialGroupPickerMode = 'prayer',
  onGroupPickerModeChange,
}: GroupPickerAppProps) {
  const storedNames = useMemo(loadGroupNames, []);
  const [phase, setPhase] = useState<PickerPhase>('setup');
  const [mode, setMode] = useState<PickerMode>(initialGroupPickerMode);
  const [names, setNames] = useState<string[]>(storedNames);
  const [nameDraft, setNameDraft] = useState('');
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [outcomeDraft, setOutcomeDraft] = useState('');
  const [winnerCount, setWinnerCount] = useState(1);
  const [groupCount, setGroupCount] = useState(2);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [error, setError] = useState('');
  const [activeLadderStart, setActiveLadderStart] = useState<number | null>(null);
  const [revealedLadderStarts, setRevealedLadderStarts] = useState<Set<number>>(new Set());
  const [revealAllQueue, setRevealAllQueue] = useState<number[] | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const selectedMode = getPickerModeDefinition(mode);

  useEffect(() => {
    onGroupPickerModeChange?.(mode);
  }, [mode, onGroupPickerModeChange]);

  useEffect(() => {
    if (phase !== 'drawing') return;
    const timer = window.setTimeout(() => setPhase('result'), DRAW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'result' && result) {
      void completeContentParticipation('group-picker');
    }
  }, [phase, result]);

  useEffect(() => {
    if (activeLadderStart === null) return;
    const timer = window.setTimeout(() => {
      setRevealedLadderStarts((current) => new Set(current).add(activeLadderStart));
      if (revealAllQueue?.[0] === activeLadderStart) {
        const remaining = revealAllQueue.slice(1);

        if (remaining.length > 0) {
          setRevealAllQueue(remaining);
          setActiveLadderStart(remaining[0]);
        } else {
          setRevealedLadderStarts(new Set(result?.orderedNames.map((_, index) => index) ?? []));
          setRevealAllQueue(null);
          setActiveLadderStart(null);
        }
      } else {
        setActiveLadderStart(null);
      }
    }, LADDER_TRACE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeLadderStart, revealAllQueue, result]);

  const prepareDraw = () => {
    const nextNames = mergeItems(names, nameDraft, MAX_PARTICIPANTS);
    const nextOutcomes = mergeItems(outcomes, outcomeDraft, MAX_PARTICIPANTS, true);
    setNames(nextNames);
    setNameDraft('');
    setOutcomes(nextOutcomes);
    setOutcomeDraft('');

    if (nextNames.length < 2) {
      setError('함께할 사람을 두 명 이상 추가해 주세요.');
      return;
    }
    if (mode === 'ladder' && nextOutcomes.length > 0 && nextOutcomes.length !== nextNames.length) {
      setError(`결과를 ${nextNames.length}개 모두 추가해 주세요.`);
      return;
    }

    const ladderOutcomes = mode === 'ladder'
      ? nextOutcomes.length > 0 ? nextOutcomes : nextNames.map((_, index) => `${index + 1}번`)
      : [];
    saveGroupNames(nextNames);
    void startContentParticipation('group-picker');
    setError('');
    setRevealedLadderStarts(new Set());
    setActiveLadderStart(null);
    setRevealAllQueue(null);

    setResult({
      mode,
      orderedNames: mode === 'ladder' ? nextNames : shuffle(nextNames),
      winnerCount: Math.min(winnerCount, nextNames.length - 1),
      ladder: mode === 'ladder' ? createLadder(nextNames.length) : null,
      outcomes: ladderOutcomes,
      groups: mode === 'groups'
        ? splitIntoGroups(nextNames, Math.min(groupCount, nextNames.length))
        : mode === 'pairs'
          ? splitIntoPairs(nextNames)
          : [],
      supportAssignments: mode === 'supporter'
        ? createPrayerSupportAssignments(nextNames)
        : [],
    });
    setPhase('drawing');
  };

  const resetToSetup = () => {
    setPhase('setup');
    setResult(null);
    setActiveLadderStart(null);
    setRevealedLadderStarts(new Set());
    setRevealAllQueue(null);

  };

  if (phase === 'drawing' && result) {
    const drawingMode = getPickerModeDefinition(result.mode);
    return (
      <ScreenLayout className={`group-picker-screen group-picker-drawing is-${result.mode}`}>
        <div className="group-picker-drawing__visual" aria-hidden="true"><i /><i /><i /><span>{drawingMode.icon}</span></div>
        <p className="eyebrow">오늘은 누구?</p>
        <h1>{drawingMode.drawing}</h1>
        <div className="group-picker-drawing__dots" aria-hidden="true"><i /><i /><i /></div>
        <p className="sr-only" role="status">{drawingMode.drawing}</p>
      </ScreenLayout>
    );
  }

  if (phase === 'result' && result) {
    const resultMode = getPickerModeDefinition(result.mode);
    const destinations = result.ladder ? resolveLadder(result.ladder) : [];
    const allLadderResultsRevealed = result.mode === 'ladder' && revealedLadderStarts.size === result.orderedNames.length;
    const revealAllLadderResults = () => {
      if (!result.ladder) return;

      const specialOutcomes = getSpecialOutcomeValues(result.outcomes);
      const specialDestinations = new Set(
        result.outcomes
          .map((outcome, destination) => ({ outcome, destination }))
          .filter(({ outcome }) => specialOutcomes.has(outcome))
          .map(({ destination }) => destination),
      );
      const specialStarts = destinations
        .map((destination, start) => ({ destination, start }))
        .filter(({ destination, start }) => specialDestinations.has(destination) && !revealedLadderStarts.has(start))
        .map(({ start }) => start);

      if (specialStarts.length === 0) {
        setRevealedLadderStarts(new Set(result.orderedNames.map((_, index) => index)));
        return;
      }

      setRevealAllQueue(specialStarts);
      setActiveLadderStart(specialStarts[0]);
    };
    const specialOutcomeValues = getSpecialOutcomeValues(result.outcomes);
    const shareResult = async () => {
      const entries: GroupPickerResultEntry[] = result.mode === 'ladder'
        ? result.orderedNames.map((name, index) => {
            const value = result.outcomes[destinations[index]];
            return { name, value, special: specialOutcomeValues.has(value) };
          })
        : result.mode === 'groups' || result.mode === 'pairs'
          ? result.groups.flatMap((group, groupIndex) => group.map((name) => ({ name, value: `${groupIndex + 1}${result.mode === 'groups' ? '조' : '팀'}` })))
          : result.mode === 'lottery'
          ? result.orderedNames.slice(0, result.winnerCount).map((name) => ({ name, value: '당첨', special: true }))
          : result.mode === 'supporter'
            ? result.supportAssignments.map(({ supporter, recipient }) => ({ name: supporter, value: recipient }))
          : result.mode === 'prayer'
            ? [{ name: result.orderedNames[0], value: '기도', special: true }]
            : result.orderedNames.map((name, index) => ({ name, value: `${index + 1}번째`, special: index === 0 }));
      const resultTitle = result.mode === 'ladder'
        ? '사다리 결과'
        : result.mode === 'groups'
          ? '오늘의 나눔 조'
        : result.mode === 'pairs'
          ? '오늘의 원투원 짝'
        : result.mode === 'sharing'
          ? '오늘의 나눔 순서'
          : result.mode === 'lottery'
            ? '오늘의 당첨 결과'
            : result.mode === 'supporter'
              ? '이번 주 내 기도 후원자'
              : '오늘 기도할 사람';

      setIsSharing(true);

      try {
        const file = await createGroupPickerResultFile({ modeTitle: resultMode.title, resultTitle, entries });
        const action = await shareGroupPickerResultFile(file);
        if (action === 'shared') {
          void recordShareClick('group-picker', 'native');
        }

      } catch {

      } finally {
        setIsSharing(false);
      }
    };
    return (
      <ScreenLayout className={`group-picker-screen group-picker-result is-${result.mode}`}>
        <button className="test-home-button" type="button" onClick={onBackHome}><span aria-hidden="true">←</span> 홈</button>
        <header className="group-picker-result__header">
          <p className="eyebrow">오늘은 누구? · {resultMode.title}</p>
          <h1>{result.mode === 'sharing'
            ? '이 순서로 시작해요'
            : result.mode === 'groups'
              ? '나눔 조가 정해졌어요'
            : result.mode === 'pairs'
              ? '원투원 짝이 정해졌어요'
            : result.mode === 'supporter'
              ? '이번 주 내 기도 후원자는'
            : result.mode === 'ladder'
              ? allLadderResultsRevealed ? '사다리 결과' : '누구부터 내려갈까요?'
              : '오늘은 바로'}</h1>
        </header>

        {result.mode === 'ladder' && result.ladder ? (
          <>
            <LadderBoard
              names={result.orderedNames}
              outcomes={result.outcomes}
              ladder={result.ladder}
              activeStart={activeLadderStart}
              revealedStarts={revealedLadderStarts}
              onSelectStart={setActiveLadderStart}
            />
            {!allLadderResultsRevealed ? (
              <button
                className="group-picker-reveal-all"
                type="button"
                disabled={activeLadderStart !== null}
                onClick={revealAllLadderResults}
              >
                {revealAllQueue ? '특별 결과 찾는 중…' : '결과 한 번에 보기'}
              </button>
            ) : null}
            {revealedLadderStarts.size > 0 ? (
              <ol className="group-picker-ladder-results">
                {result.orderedNames.map((name, index) => revealedLadderStarts.has(index) ? (
                  <li className={specialOutcomeValues.has(result.outcomes[destinations[index]]) ? 'is-special' : undefined} key={name}>
                    <strong>{name}</strong><span>→</span><b>{result.outcomes[destinations[index]]}</b>
                  </li>
                ) : null)}
              </ol>
            ) : null}
          </>
        ) : result.mode === 'groups' || result.mode === 'pairs' ? (
          <div className="group-picker-groups">
            {result.groups.map((group, groupIndex) => (
              <section aria-labelledby={`group-${groupIndex + 1}`} key={`group-${groupIndex + 1}`}>
                <h2 id={`group-${groupIndex + 1}`}>{groupIndex + 1}{result.mode === 'groups' ? '조' : '팀'}</h2>
                <div>{group.map((name) => <span key={name}>{name}</span>)}</div>
              </section>
            ))}
          </div>
        ) : result.mode === 'supporter' ? (
          <ol className="group-picker-supporters">
            {result.supportAssignments.map(({ supporter, recipient }) => (
              <li key={supporter}>
                <strong>{supporter}</strong><span aria-hidden="true">→</span><b>{recipient}</b>
              </li>
            ))}
          </ol>
        ) : result.mode === 'prayer' ? (
          <div className="group-picker-prayer-result">
            <span aria-hidden="true">✦</span>
            <strong>{result.orderedNames[0]}</strong>
          </div>
        ) : result.mode === 'lottery' ? (
          <div className="group-picker-winners">
            {result.orderedNames.slice(0, result.winnerCount).map((name, index) => (
              <div className="group-picker-winner" key={name}><span>{index + 1}</span><strong>{name}</strong></div>
            ))}
          </div>
        ) : (
          <ol className="group-picker-order">
            {result.orderedNames.map((name, index) => (
              <li className={index === 0 ? 'is-first' : undefined} key={name}>
                <span>{index + 1}</span><strong>{name}</strong>{index === 0 && result.mode === 'sharing' ? <b>먼저</b> : null}
              </li>
            ))}
          </ol>
        )}

        <div className="group-picker-result__actions">
          {result.mode !== 'ladder' || allLadderResultsRevealed ? (
            <PrimaryButton disabled={isSharing} onClick={shareResult}>
              {isSharing ? '이미지 만드는 중…' : '결과 이미지 공유하기'}
            </PrimaryButton>
          ) : null}
          {result.mode !== 'ladder' || allLadderResultsRevealed ? <button className="group-picker-redraw" type="button" onClick={prepareDraw}>다시 뽑기</button> : null}
          <button type="button" onClick={resetToSetup}>설정 바꾸기</button>
          <button type="button" onClick={onBackHome}>홈으로</button>
        </div>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout className="group-picker-screen group-picker-setup">
      <button className="test-home-button" type="button" onClick={onBackHome}><span aria-hidden="true">←</span> 홈</button>
      <header className="group-picker-hero">
        <p className="eyebrow">온기 · 모임 도구</p>
        <h1 aria-label="오늘은 누구?">오늘은<br />누구?</h1>
      </header>

      <section className="group-picker-section" aria-labelledby="picker-mode-title">
        <h2 id="picker-mode-title">무엇을 정할까요?</h2>
        <div className="group-picker-modes">
          {PICKER_MODES.map((item) => (
            <button
              className={`${mode === item.id ? 'is-selected ' : ''}is-${item.id}`.trim()}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => { setMode(item.id); setError(''); }}
              key={item.id}
            >
              <span aria-hidden="true">{item.icon}</span><strong>{item.title}</strong><b aria-hidden="true">✓</b>
            </button>
          ))}
        </div>
      </section>

      <section className="group-picker-section" aria-labelledby="picker-names-title">
        <div className="group-picker-section__heading">
          <h2 id="picker-names-title">함께할 사람</h2>
          <div className="group-picker-section__controls">
            <span>{names.length}/{MAX_PARTICIPANTS}</span>
            {names.length > 0 ? (
              <button type="button" onClick={() => {
                setNames([]);
                setOutcomes([]);
                setNameDraft('');
                setOutcomeDraft('');
                saveGroupNames([]);
              }}>모두 지우기</button>
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
          onDraftChange={(value) => { setNameDraft(value); setError(''); }}
          onItemsChange={(items) => {
            setNames(items);
            setOutcomes((current) => current.slice(0, items.length));
            setError('');
          }}
        />
      </section>

      {mode === 'lottery' ? (
        <section className="group-picker-section" aria-labelledby="winner-count-title">
          <div className="group-picker-section__heading"><h2 id="winner-count-title">몇 명을 뽑을까요?</h2><strong>{Math.min(winnerCount, Math.max(1, names.length - 1))}명</strong></div>
          <input type="range" min="1" max={Math.max(1, names.length - 1)} value={Math.min(winnerCount, Math.max(1, names.length - 1))} aria-label="당첨 인원" onChange={(event) => setWinnerCount(Number(event.target.value))} />
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
          <div className="group-picker-section__heading"><h2 id="outcomes-title">사다리 결과</h2><span>{outcomes.length}/{names.length}</span></div>
          <div className="group-picker-presets" aria-label="사다리 결과 빠른 설정">
            <button type="button" disabled={names.length < 2} onClick={() => setOutcomes(['커피 사기', ...names.slice(1).map(() => '통과')])}>커피 내기</button>
            <button type="button" disabled={names.length < 2} onClick={() => setOutcomes(['간식 사기', ...names.slice(1).map(() => '통과')])}>간식 내기</button>
            <button type="button" disabled={names.length < 2} onClick={() => setOutcomes(['꽝', ...names.slice(1).map(() => '통과')])}>한 명만 꽝</button>
            <button type="button" disabled={names.length < 2} onClick={() => setOutcomes(names.map((_, index) => `${index + 1}번`))}>번호만</button>
          </div>
          <ItemEditor
            id="group-picker-outcome"
            label="사다리 결과"
            items={outcomes}
            draft={outcomeDraft}
            max={Math.max(1, names.length)}
            placeholder="결과 입력"
            allowDuplicates
            onDraftChange={(value) => { setOutcomeDraft(value); setError(''); }}
            onItemsChange={(items) => { setOutcomes(items); setError(''); }}
          />
        </section>
      ) : null}

      {error ? <p className="group-picker-error" role="alert">{error}</p> : null}
      <PrimaryButton className="group-picker-start" onClick={prepareDraw}>{selectedMode.action}</PrimaryButton>
      <p className="group-picker-credit">창작자 · hyunee</p>
    </ScreenLayout>
  );
}
