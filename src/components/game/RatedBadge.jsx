import Icon from '../ui/Icon'
import { cn } from '../utils/cn'

// "Tính Elo" (a Quick Play match — the rating moves) or "Giao hữu" (a room
// made by code or a friend challenge — saved and counted in wins/losses/
// draws, but nobody's Elo changes).
export function RatedBadge({ rated, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm whitespace-nowrap',
        rated ? 'bg-secondary/10 text-secondary' : 'bg-surface-container text-on-surface-variant',
        className
      )}
      data-testid="rated-badge"
      title={rated ? 'Ván xếp hạng — kết quả tính vào điểm xếp hạng' : 'Ván giao hữu — không tính điểm'}
    >
      <Icon name={rated ? 'leaderboard' : 'handshake'} size="xs" />
      {rated ? 'Tính điểm' : 'Giao hữu'}
    </span>
  )
}

export default RatedBadge
