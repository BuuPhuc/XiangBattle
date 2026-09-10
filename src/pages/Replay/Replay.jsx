import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import ChessBoard from '../../components/game/ChessBoard'
import GameHistoryPanel from '../ChessGame/sections/GameHistoryPanel'
import { useReplayGame } from '../../features/replay/hooks/useReplayGame'

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

const RESULT_LABEL = {
  RED_WIN: 'Đỏ thắng',
  BLACK_WIN: 'Đen thắng',
  DRAW: 'Hòa',
}

function playerLabel(player) {
  return player ? player.displayName || player.username : '—'
}

// Read-only playback of a finished match, reached from GameOverModal's "Xem
// lại ván đấu" button. Reuses the exact same board/history components the
// live game uses (ChessBoard, GameHistoryPanel) — only the data source
// differs: pieces/turn here come from useReplayGame's precomputed
// moveHistory instead of a live socket-driven useGame, and the board is
// wired to a no-op click handler so nothing here can ever move a piece,
// emit a socket event, or touch the database.
export function Replay() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const {
    status,
    error,
    game,
    moveHistory,
    currentMoveIndex,
    pieces,
    turn,
    goToMove,
    goToStart,
    goToEnd,
    goPrev,
    goNext,
    canGoPrev,
    canGoNext,
    reload,
  } = useReplayGame(gameId)

  const handleExit = () => navigate('/play')

  if (status === 'loading') {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-3">
        <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
        <p className="font-body-md text-body-md text-on-surface-variant">Đang tải ván đấu...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
        <p className="font-body-md text-body-md text-error">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reload}>Thử lại</Button>
          <Button variant="outline" onClick={handleExit}>
            Quay lại
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-container-max mx-auto flex flex-col xl:flex-row gap-gutter justify-center">
      <div className="flex-grow flex flex-col items-center order-1 w-full xl:max-w-[780px]">
        <div className="w-full mb-3 glass-panel border border-gold-shimmer/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-label-md text-label-md">
            <span className="text-error">{playerLabel(game.redPlayer)}</span>
            <span className="text-on-surface-variant">vs</span>
            <span>{playerLabel(game.blackPlayer)}</span>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant text-right">
            {RESULT_LABEL[game.result] || game.result} · {END_REASON_LABEL[game.endReason] || game.endReason}
          </div>
        </div>

        <div className="w-full pointer-events-none select-none">
          <ChessBoard pieces={pieces} selectedId={null} turn={turn} legalMoves={[]} onSquareClick={() => {}} />
        </div>

        <div className="w-full mt-3 glass-panel border border-gold-shimmer/30 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={goToStart}
            disabled={!canGoPrev}
            className="p-2 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Về đầu"
          >
            <Icon name="first_page" />
          </button>
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="p-2 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Nước trước"
          >
            <Icon name="chevron_left" />
          </button>
          <span className="font-label-md text-label-md text-on-surface-variant px-3 tabular-nums">
            {currentMoveIndex + 1} / {moveHistory.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className="p-2 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Nước tiếp theo"
          >
            <Icon name="chevron_right" />
          </button>
          <button
            type="button"
            onClick={goToEnd}
            disabled={!canGoNext}
            className="p-2 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Đến cuối"
          >
            <Icon name="last_page" />
          </button>
        </div>

        <div className="w-full mt-3 flex justify-center">
          <Button variant="outline" onClick={handleExit}>
            <Icon name="arrow_back" />
            Thoát xem lại
          </Button>
        </div>
      </div>

      <div className="w-full xl:w-96 flex flex-col gap-3 order-2">
        <GameHistoryPanel moveHistory={moveHistory} currentMoveIndex={currentMoveIndex} onSelectMove={goToMove} chat={null} />
      </div>
    </div>
  )
}

export default Replay
