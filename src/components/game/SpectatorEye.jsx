import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import { cn } from '../utils/cn'

// "Đang xem (3)" next to the time control, for players and spectators alike.
// The eye stays shut until you point at it (or tap it, on a phone): then it
// opens — the lid lifts, the pupil looks around — and the list of who is
// watching drops down. Accounts are listed by name (linking to their
// profile); guests only as a number.
//
// `spectators`: { count, viewers: [{ userId, username, avatarUrl }], guests }
// from the server (spectators_update), or null before it's known.
export function SpectatorEye({ spectators, className }) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const rootRef = useRef(null)
  const open = hovered || pinned

  // A tapped-open list closes on a tap anywhere else, or Escape.
  useEffect(() => {
    if (!pinned) return undefined
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setPinned(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPinned(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pinned])

  const count = spectators?.count ?? 0
  const viewers = spectators?.viewers ?? []
  const guests = spectators?.guests ?? 0

  return (
    <div
      ref={rootRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid="spectator-eye"
    >
      <button
        type="button"
        onClick={() => setPinned((value) => !value)}
        aria-expanded={open}
        aria-label={`Đang xem (${count}) — danh sách người xem`}
        className={cn(
          'spectator-eye inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-colors font-label-sm text-label-sm',
          'text-on-surface-variant hover:text-primary hover:bg-primary/10',
          open && 'is-open text-primary bg-primary/10'
        )}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="flex-shrink-0 overflow-visible">
          {/* Shut: a lowered lid with lashes. */}
          <g className="spectator-eye__closed" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 11c2.5 3.2 5.6 4.8 9 4.8s6.5-1.6 9-4.8" />
            <path d="M6.2 14.1 5 16.2M12 15.8v2.4M17.8 14.1l1.2 2.1" />
          </g>
          {/* Open: the lid lifts (scaled from a slit), the pupil wanders. */}
          <g className="spectator-eye__open">
            <path
              d="M2 12c2.8-4.6 6.1-6.9 10-6.9s7.2 2.3 10 6.9c-2.8 4.6-6.1 6.9-10 6.9S4.8 16.6 2 12Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <g className="spectator-eye__pupil">
              <circle cx="12" cy="12" r="3.6" fill="currentColor" />
              <circle cx="13.3" cy="10.8" r="1.1" fill="white" />
            </g>
          </g>
        </svg>
        <span className="tabular-nums whitespace-nowrap">Đang xem ({count})</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Người đang xem"
          className="spectator-eye__list absolute right-0 top-full mt-2 z-30 w-64 max-w-[calc(100vw-32px)] rounded-xl border border-outline-variant/40 bg-surface shadow-lg p-3 text-left"
        >
          <p className="font-label-md text-label-md text-on-surface mb-2">Người đang xem</p>
          {count === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Chưa có ai đang xem.</p>
          ) : (
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {viewers.map((viewer) => (
                <li key={viewer.userId}>
                  <Link
                    to={`/profile/${viewer.userId}`}
                    className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-surface-container transition-colors"
                  >
                    <Avatar src={viewer.avatarUrl} name={viewer.username} size={28} />
                    <span className="font-body-sm text-body-sm text-on-surface truncate">{viewer.username}</span>
                  </Link>
                </li>
              ))}
              {guests > 0 && (
                <li className="flex items-center gap-2 px-1 font-body-sm text-body-sm text-on-surface-variant">
                  <span className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-[12px] font-bold">
                    +{guests}
                  </span>
                  {viewers.length > 0 ? `${guests} khách` : `${guests} khách (chưa đăng nhập)`}
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default SpectatorEye
