import { barShare, formatScore } from '../../../features/analysis/analysis.js'

// Phân tích ván's advantage bar, beside the board: red's share fills from
// red's side (the bottom, or the top on a board flipped for black), so a
// bar mostly red means red is better in the position shown. Grey and level
// while that position hasn't been analysed yet.
export function EvalBar({ evaluation, flipped = false }) {
  const redPercent = Math.round(barShare(evaluation) * 1000) / 10
  const label = evaluation ? `Lợi thế: ${formatScore(evaluation)}` : 'Lợi thế: chưa phân tích'
  return (
    <div
      className="relative w-3 sm:w-4 self-stretch rounded-full overflow-hidden bg-[#2b2622] border border-outline-variant/50 flex-shrink-0"
      role="img"
      aria-label={label}
      title={label}
      data-testid="eval-bar"
      data-red-share={evaluation ? redPercent : ''}
    >
      <div
        className={`absolute left-0 right-0 bg-error transition-[height] duration-300 ${flipped ? 'top-0' : 'bottom-0'} ${
          evaluation ? '' : 'opacity-30'
        }`}
        style={{ height: `${redPercent}%` }}
      />
      <div className="absolute left-0 right-0 top-1/2 h-px bg-white/40" />
    </div>
  )
}

export default EvalBar
