import { cn } from '../utils/cn'

const COL_STEP = 100 / 8
const ROW_STEP = 100 / 9

// `turnActive` is only ever true for the general belonging to whichever side
// is currently on move (see ChessBoard.jsx) — it's what replaced the old
// "Lượt của Đỏ/Đen" text banner: instead of a separate UI area, the active
// side's own general carries a small ring so whose turn it is reads directly
// off the board.
export function Piece({ side, char, col, row, selected, turnActive, onSelect }) {
  return (
    <div
      className={cn('piece', side, selected && 'selected', turnActive && 'turn-active')}
      style={{ left: `${col * COL_STEP}%`, top: `${row * ROW_STEP}%` }}
      onClick={onSelect}
      role="button"
      aria-label={`${side === 'red' ? 'Quân đỏ' : 'Quân đen'} ${char}`}
      aria-pressed={selected}
    >
      {char}
    </div>
  )
}

export default Piece
