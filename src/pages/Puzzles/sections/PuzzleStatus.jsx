import Icon from '../../../components/ui/Icon'

// "Đã giải" (solved unaided) or "Đã xem lời giải" (solution viewed, not
// solved) — nothing for an untouched puzzle.
export function PuzzleStatus({ entry }) {
  if (entry?.solved) {
    return (
      <span data-testid="puzzle-status" data-status="solved" className="inline-flex items-center gap-1 text-secondary font-label-sm text-label-sm font-bold">
        <Icon name="check_circle" filled className="text-base" />
        Đã giải
      </span>
    )
  }
  if (entry?.viewedSolution) {
    return (
      <span data-testid="puzzle-status" data-status="viewed" className="inline-flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
        <Icon name="visibility" className="text-base" />
        Đã xem lời giải
      </span>
    )
  }
  return null
}

export default PuzzleStatus
