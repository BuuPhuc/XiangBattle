import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import Avatar from '../../../components/ui/Avatar'
import { cn } from '../../../components/utils/cn'
import userService from '../../../services/userService'

function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const END_REASON_LABEL = {
  CHECKMATE: 'Chiếu bí',
  RESIGN: 'Đầu hàng',
  TIMEOUT: 'Hết giờ',
  DRAW_AGREEMENT: 'Hòa cờ',
  STALEMATE: 'Hết nước đi',
  REPETITION: 'Lặp nước',
  DISCONNECT: 'Đối thủ rời trận',
  CANCELLED: 'Đã hủy',
}

const RESULT_META = {
  WIN: { label: 'Thắng', dot: 'bg-secondary', text: 'text-secondary' },
  LOSS: { label: 'Thua', dot: 'bg-error', text: 'text-error' },
  DRAW: { label: 'Hòa', dot: 'bg-on-surface-variant', text: 'text-on-surface-variant' },
}

// One row of the "Ván đấu gần đây" list. Clicking "Xem" hands off to the
// existing read-only Replay route (/replay/:gameId) — this never fetches
// moves or renders a board itself, it only links into the replay system
// that already exists (see src/pages/Replay/Replay.jsx).
function GameHistoryCard({ game }) {
  const meta = RESULT_META[game.result] || RESULT_META.DRAW
  const opponentName = game.opponent ? game.opponent.displayName || game.opponent.username : 'Người chơi đã xóa'

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 last:border-b-0">
      <Avatar src={game.opponent && game.opponent.avatarUrl} name={opponentName} size={40} />
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full', meta.dot)} />
          <span className={cn('font-label-sm text-label-sm font-bold', meta.text)}>{meta.label}</span>
        </div>
        <p className="font-body-md text-body-md text-on-surface truncate mt-0.5">vs {opponentName}</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant/70 mt-0.5 truncate">
          {game.moveCount} nước · {END_REASON_LABEL[game.endReason] || game.endReason} · {formatDate(game.endedAt)}
        </p>
      </div>
      <Link to={`/replay/${game.gameId}`} className="flex-shrink-0">
        <Button variant="outline-sm" size="sm">
          Xem
        </Button>
      </Link>
    </div>
  )
}

// "Ván đấu gần đây" — a user's FINISHED-match history, used by both the
// current user's own Profile page and any other player's PublicProfile
// page (hence taking `userId` as a prop rather than reading it from auth).
// Fetches independently of whatever profile card sits above it — its own
// loading/error/empty states, so a slow or failed history fetch never
// blocks the profile itself from rendering, and vice versa.
export function GameHistorySection({ userId }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'empty' | 'hidden' | 'error'
  const [error, setError] = useState(null)
  const [games, setGames] = useState([])

  // "Reset during render" pattern (see PublicProfile.jsx) — resets back to
  // 'loading' the moment `userId` itself changes, instead of calling
  // setState synchronously inside the effect body below.
  const [loadedUserId, setLoadedUserId] = useState(userId)
  if (loadedUserId !== userId) {
    setLoadedUserId(userId)
    setStatus('loading')
    setError(null)
    setGames([])
  }

  useEffect(() => {
    let cancelled = false

    userService
      .getUserGames(userId, { page: 1, limit: 10 })
      .then((data) => {
        if (cancelled) return
        const list = data.games || []
        setGames(list)
        setStatus(list.length > 0 ? 'ready' : 'empty')
      })
      .catch((err) => {
        if (cancelled) return
        setError((err.response && err.response.data && err.response.data.message) || 'Không thể tải lịch sử đấu.')
        // 403: this player's own "Ván đấu gần đây" setting excludes the
        // viewer — an expected state, not a failure.
        setStatus(err.response && err.response.status === 403 ? 'hidden' : 'error')
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <div>
      <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3 flex items-center gap-2">
        <Icon name="history" className="text-[20px]" />
        Ván đấu gần đây
      </h2>
      <div className="glass-panel border border-gold-shimmer/30 rounded-xl overflow-hidden">
        {status === 'loading' && (
          <div className="py-10 text-center">
            <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
          </div>
        )}
        {status === 'error' && (
          <div className="py-10 text-center px-4">
            <p className="font-body-sm text-body-sm text-error">{error}</p>
          </div>
        )}
        {status === 'hidden' && (
          <div className="py-10 text-center px-4 space-y-2">
            <Icon name="lock" className="text-4xl text-on-surface-variant/40 block" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">{error}</p>
          </div>
        )}
        {status === 'empty' && (
          <div className="py-10 text-center px-4 space-y-2">
            <Icon name="sports_esports" className="text-4xl text-on-surface-variant/40 block" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">Chưa có ván đấu nào</p>
          </div>
        )}
        {status === 'ready' && games.map((game) => <GameHistoryCard key={game.gameId} game={game} />)}
      </div>
    </div>
  )
}

export default GameHistorySection
