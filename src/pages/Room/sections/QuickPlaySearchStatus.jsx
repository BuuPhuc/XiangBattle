import { useEffect, useState } from 'react'
import { ratingRangeFor } from '../../../features/matchmaking/ratingWindow.js'

const formatWaited = (ms) => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// The "Đang tìm đối thủ…" line of Quick Play: the Elo searched around, the
// range accepted right now (it widens the longer you wait — the same
// ratingWindow.js the server pairs with), and how long you've waited.
// `search` is useRoom's queueSearch ({ rating, since }), or null before the
// server has confirmed the queue (or from an older server) — then just the
// plain line.
export function QuickPlaySearchStatus({ search }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!search) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [search])

  if (!search) {
    return <p className="font-body-md text-body-md text-on-surface-variant">Đang tìm đối thủ...</p>
  }

  const waited = Math.max(0, now - search.since)
  const range = ratingRangeFor(waited)

  return (
    <div className="space-y-1" data-testid="quick-play-search">
      {Number.isFinite(range) ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          Đang tìm đối thủ quanh <strong className="text-primary tabular-nums">{search.rating}</strong> Elo{' '}
          <span className="tabular-nums">
            ({search.rating - range}–{search.rating + range})
          </span>
          ...
        </p>
      ) : (
        <p className="font-body-md text-body-md text-on-surface-variant">Đang tìm bất kỳ đối thủ nào...</p>
      )}
      <p className="font-label-sm text-label-sm text-on-surface-variant/80 tabular-nums">
        Đã chờ {formatWaited(waited)}
        {Number.isFinite(range) && ' · khoảng Elo sẽ mở rộng dần nếu chưa tìm thấy'}
      </p>
    </div>
  )
}

export default QuickPlaySearchStatus
