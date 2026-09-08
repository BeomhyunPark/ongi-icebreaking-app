import { resolveLadder, traceLadder, type Ladder } from '../domain/draw';
import { getSpecialOutcomeValues } from '../domain/outcomes';

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

export function LadderBoard({
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
        <div
          className="group-picker-ladder-labels"
          style={{ gridTemplateColumns: `repeat(${names.length}, 1fr)` }}
        >
          {names.map((name, index) => (
            <button
              className={revealedStarts.has(index) ? 'is-revealed' : undefined}
              type="button"
              disabled={activeStart !== null}
              onClick={() => onSelectStart(index)}
              key={name}
            >
              {name}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="완성된 사다리">
          {names.map((name, index) => {
            const x = side + index * gap;
            return (
              <line
                className="ladder-line"
                x1={x}
                y1={top - 28}
                x2={x}
                y2={bottom + 28}
                key={name}
              />
            );
          })}
          {ladder.rungs.map((rung) => {
            const x = side + rung.leftColumn * gap;
            const y = top + rung.row * rowGap;
            return (
              <line
                className="ladder-line"
                x1={x}
                y1={y}
                x2={x + gap}
                y2={y}
                key={`${rung.row}-${rung.leftColumn}`}
              />
            );
          })}
          {activeStart !== null ? (
            <polyline
              className={`ladder-trace${revealedStarts.has(activeStart) ? ' is-replay' : ''}`}
              pathLength="1"
              points={buildTracePoints(ladder, activeStart)}
            />
          ) : null}
        </svg>
        <div
          className="group-picker-ladder-labels is-outcomes"
          style={{ gridTemplateColumns: `repeat(${outcomes.length}, 1fr)` }}
        >
          {outcomes.map((outcome, index) => (
            <span
              className={`${revealedDestinations.has(index) ? 'is-revealed' : ''}${specialOutcomes.has(outcome) ? ' is-special' : ''}`.trim()}
              key={`${outcome}-${index}`}
            >
              {revealedDestinations.has(index) ? outcome : '?'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
