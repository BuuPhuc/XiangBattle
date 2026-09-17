import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Avatar from '../../../components/ui/Avatar'
import { cn } from '../../../components/utils/cn'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

// Only meaningful on page 1 — the first 3 rows of the overall leaderboard,
// given a slightly more prominent treatment than the plain list below.
// Deliberately simple (no animation): a bordered card per rank, #1 given a
// gold border and a small scale bump on wider screens.
export function TopThreePodium({ players, currentUserId }) {
  if (players.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      {players.map((player) => {
        const name = player.displayName || player.username
        const isFirst = player.rank === 1
        const isMe = currentUserId && String(player.id) === String(currentUserId)

        return (
          <Link
            key={player.id}
            to={`/profile/${player.id}`}
            className={cn(
              'glass-panel rounded-xl p-5 text-center border transition-transform hover:scale-[1.02]',
              isFirst ? 'border-gold-shimmer sm:scale-[1.03]' : 'border-gold-shimmer/30',
              isMe && 'ring-2 ring-primary',
            )}
          >
            <span className="text-3xl leading-none">{MEDAL[player.rank]}</span>
            <Avatar src={player.avatarUrl} name={name} size={64} className="mx-auto mt-3 mb-2" />
            <p className="font-label-md text-label-md font-bold text-on-surface truncate">{name}</p>
            <p className="font-headline-sm text-headline-sm text-primary flex items-center justify-center gap-1 mt-1">
              <Icon name="star" className="text-[18px] text-gold-shimmer" filled />
              {player.rating}
            </p>
            <p className="font-label-sm text-label-sm text-on-surface-variant/70 mt-1">
              {player.wins}T · {player.draws}H · {player.losses}B
            </p>
          </Link>
        )
      })}
    </div>
  )
}

export default TopThreePodium
