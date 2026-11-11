import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import { cn } from '../utils/cn'

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

const COLOR_META = {
  red: { label: 'Cầm Đỏ', swatch: 'bg-piece-red' },
  black: { label: 'Cầm Đen', swatch: 'bg-piece-black' },
}

// One finished match in a "Ván đấu gần đây" list (Profile pages, Play page).
// `game` is one item of GET /users/:id/games. Clicking "Xem" hands off to
// the existing read-only Replay route (/replay/:gameId) — this never fetches
// moves or renders a board itself.
// `showColor` adds which side the player had (Play page only — the Profile
// pages keep their original look).
export function GameHistoryCard({ game, showColor = false }) {
  const meta = RESULT_META[game.result] || RESULT_META.DRAW
  const opponentName = game.opponent ? game.opponent.displayName || game.opponent.username : 'Người chơi đã xóa'
  const color = showColor ? COLOR_META[game.color] : null

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 last:border-b-0">
      <Avatar src={game.opponent && game.opponent.avatarUrl} name={opponentName} size={40} />
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full', meta.dot)} />
          <span className={cn('font-label-sm text-label-sm font-bold', meta.text)}>{meta.label}</span>
          {color && (
            <span className="flex items-center gap-1 ml-2 font-label-sm text-label-sm text-on-surface-variant" data-testid="game-color">
              <span className={cn('w-2.5 h-2.5 rounded-full', color.swatch)} />
              {color.label}
            </span>
          )}
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

export default GameHistoryCard
