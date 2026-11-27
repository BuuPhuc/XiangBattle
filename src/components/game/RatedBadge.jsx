import Badge from '../ui/Badge'

// "Tính Elo" (a Quick Play match — the rating moves) or "Giao hữu" (a room
// made by code or a friend challenge — saved and counted in wins/losses/
// draws, but nobody's Elo changes).
export function RatedBadge({ rated, className }) {
  return (
    <Badge
      tone={rated ? 'success' : 'neutral'}
      size="sm"
      icon={rated ? 'leaderboard' : 'handshake'}
      className={className}
      data-testid="rated-badge"
      title={rated ? 'Ván xếp hạng — kết quả tính vào điểm xếp hạng' : 'Ván giao hữu — không tính điểm'}
    >
      {rated ? 'Tính điểm' : 'Giao hữu'}
    </Badge>
  )
}

export default RatedBadge
