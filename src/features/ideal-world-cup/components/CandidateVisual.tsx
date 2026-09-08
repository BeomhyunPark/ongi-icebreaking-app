import type { WorldCupCandidate } from '../domain/types';

export function CandidateVisual({ candidate }: { candidate: WorldCupCandidate }) {
  if (candidate.image) {
    return (
      <span
        className="world-cup-candidate-visual world-cup-candidate-visual--image"
        aria-hidden="true"
      >
        <img src={candidate.image} alt="" draggable="false" />
      </span>
    );
  }

  return (
    <span
      className={`world-cup-candidate-visual world-cup-candidate-visual--symbol is-${candidate.visualTone}`}
      aria-hidden="true"
    >
      <span>{candidate.symbol}</span>
    </span>
  );
}
