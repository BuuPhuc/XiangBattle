import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import { useLiveGames, findLiveGameOf } from '../../../features/spectate/useLiveGames'

// On Public Profile: when this player is in a match right now, "Đang chơi —
// Xem ván" opens it for watching. Nothing is shown otherwise.
export function WatchAction({ userId }) {
  const { games } = useLiveGames()
  const game = findLiveGameOf(games, Number(userId))
  if (!game) return null

  return (
    <div className="mt-3 flex justify-center">
      <Link
        to={`/watch/${game.roomId}`}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary font-label-md text-label-md hover:bg-primary/20 transition-colors"
      >
        <Icon name="visibility" size="md" />
        Đang chơi — Xem ván
      </Link>
    </div>
  )
}

export default WatchAction
