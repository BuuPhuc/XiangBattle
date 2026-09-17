import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import { cn } from '../../../components/utils/cn'
import userService from '../../../services/userService'

// A single compact row — clocks, name/elo, and avatar — meant to sandwich
// GameHistoryPanel (see ChessGame.jsx) rather than stand as its own tall
// card the way this used to.
//
// `userId` (a real logged-in account's id — see room.js's toGameStarted)
// makes the name and avatar clickable, opening /profile/:userId (Public
// Profile). It's undefined for a guest opponent, the local/offline
// placeholder, or before the server has resolved it yet — in every one of
// those cases this falls back to the old plain (non-link) rendering rather
// than pointing at a profile that doesn't exist.
export function PlayerCard({ name, elo, side, moveTime, gameTime, clockActive, online, accentClassName = '', userId }) {
  const isRed = side === 'red'

  // Avatar-only addition — fetches nothing but the avatar for whichever
  // account `userId` already points at (same public endpoint the Profile
  // pages use), purely to swap the placeholder person icon below for a real
  // picture when one exists. Doesn't touch any of the existing name/elo/
  // online/link logic above or below.
  const [avatarUrl, setAvatarUrl] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (!userId) return undefined

    userService
      .getPublicProfile(userId)
      .then((data) => {
        if (!cancelled) setAvatarUrl(data.user.avatarUrl || null)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [userId])

  const avatarContent = avatarUrl ? (
    <img src={avatarUrl} alt={name} onError={() => setAvatarUrl(null)} className="w-full h-full rounded-full object-cover" />
  ) : (
    <Icon name="person" className="text-2xl" />
  )

  return (
    <div
      className={cn(
        'glass-panel border border-gold-shimmer/30 rounded-xl px-3 py-2.5 flex items-center gap-3 flex-shrink-0',
        accentClassName
      )}
    >
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-center leading-tight">
          <div
            className={cn(
              'font-label-lg text-label-lg font-bold tabular-nums font-mono',
              clockActive ? 'text-primary' : 'text-on-surface'
            )}
          >
            {moveTime}
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant/70 whitespace-nowrap">Giờ/nước</div>
        </div>
        <div className="text-center leading-tight">
          <div
            className={cn(
              'font-label-lg text-label-lg font-bold tabular-nums font-mono',
              clockActive ? 'text-primary' : 'text-on-surface'
            )}
          >
            {gameTime}
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant/70 whitespace-nowrap">Ván đấu</div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {userId ? (
          <Link
            to={`/profile/${userId}`}
            className="font-label-md text-label-md text-on-surface truncate block hover:text-primary hover:underline"
          >
            {name}
          </Link>
        ) : (
          <h3 className="font-label-md text-label-md text-on-surface truncate">{name}</h3>
        )}
        {/* elo is null/undefined until the real rating is known (loading,
            or no account to read one from, e.g. a guest or the offline
            practice opponent) — never a placeholder number. */}
        <p className="font-label-sm text-label-sm text-on-surface-variant">ELO {elo ?? '—'}</p>
      </div>

      <div className="relative shrink-0">
        {userId ? (
          <Link
            to={`/profile/${userId}`}
            className={cn(
              'w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-md transition-transform hover:scale-105',
              isRed ? 'border-error bg-piece-red/10 text-error' : 'border-wood-dark bg-wood-dark/10 text-wood-dark'
            )}
          >
            {avatarContent}
          </Link>
        ) : (
          <div
            className={cn(
              'w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-md',
              isRed ? 'border-error bg-piece-red/10 text-error' : 'border-wood-dark bg-wood-dark/10 text-wood-dark'
            )}
          >
            {avatarContent}
          </div>
        )}
        {online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-secondary border-2 border-surface" />}
      </div>
    </div>
  )
}

export default PlayerCard
