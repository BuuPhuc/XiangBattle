import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Avatar from '../../../components/ui/Avatar'
import { cn } from '../../../components/utils/cn'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

// One leaderboard row — used both in the ranked list and for the "Xếp hạng
// của bạn" card. Clicking anywhere on the row opens that player's Public
// Profile (PublicProfile.jsx already redirects a viewer to /profile when
// the id is their own, so this never needs to special-case "me").
export function PlayerRankRow({ player, highlight = false, className = '' }) {
  const name = player.displayName || player.username

  return (
    <Link
      to={`/profile/${player.id}`}
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-container',
        highlight && 'bg-primary-container/40',
        className,
      )}
    >
      <span className="w-9 flex-shrink-0 text-center font-label-md text-label-md font-bold text-on-surface-variant">
        {MEDAL[player.rank] || `#${player.rank}`}
      </span>
      <Avatar src={player.avatarUrl} name={name} size={40} />
      <div className="flex-grow min-w-0">
        <p className="font-body-md text-body-md text-on-surface truncate">{name}</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant/70 flex items-center gap-2 sm:hidden">
          <span>{player.wins}T</span>
          <span>{player.draws}H</span>
          <span>{player.losses}B</span>
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-5 flex-shrink-0 text-center">
        <div className="w-12">
          <p className="font-label-sm text-label-sm text-on-surface-variant/60">Thắng</p>
          <p className="font-body-sm text-body-sm text-on-surface">{player.wins}</p>
        </div>
        <div className="w-12">
          <p className="font-label-sm text-label-sm text-on-surface-variant/60">Hòa</p>
          <p className="font-body-sm text-body-sm text-on-surface">{player.draws}</p>
        </div>
        <div className="w-12">
          <p className="font-label-sm text-label-sm text-on-surface-variant/60">Thua</p>
          <p className="font-body-sm text-body-sm text-on-surface">{player.losses}</p>
        </div>
      </div>
      <div className="flex-shrink-0 text-right w-16 flex items-center justify-end gap-1">
        <Icon name="star" className="text-[16px] text-gold-shimmer" filled />
        <span className="font-label-md text-label-md font-bold text-primary">{player.rating}</span>
      </div>
    </Link>
  )
}

export default PlayerRankRow
