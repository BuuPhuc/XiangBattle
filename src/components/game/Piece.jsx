import { cn } from '../utils/cn'

const COL_STEP = 100 / 8
const ROW_STEP = 100 / 9

export function Piece({ side, char, col, row, selected, onSelect }) {
  return (
    <div
      className={cn('piece', side, selected && 'selected')}
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
