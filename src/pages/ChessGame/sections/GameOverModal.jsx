import Icon from '../../../components/ui/Icon'
import { GAME_STATUS } from '../../../features/game/gameLogic.js'

const REASON_HEADING = {
  [GAME_STATUS.CHECKMATE]: 'Chiếu bí!',
  [GAME_STATUS.STALEMATE]: 'Hết nước đi!',
  [GAME_STATUS.TIMEOUT_MOVE]: 'Hết giờ đi quân!',
  [GAME_STATUS.TIMEOUT_GAME]: 'Hết giờ ván đấu!',
  [GAME_STATUS.OPPONENT_LEFT]: 'Đối thủ đã rời trận!',
  [GAME_STATUS.DRAW]: 'Hòa cờ!',
  [GAME_STATUS.PERPETUAL_CHECK]: 'Chiếu dai — xử thua!',
  [GAME_STATUS.PERPETUAL_CHASE]: 'Đuổi dai — xử thua!',
  [GAME_STATUS.REPETITION_DRAW]: 'Hòa do lặp nước!',
}

const DRAW_STATUSES = new Set([GAME_STATUS.DRAW, GAME_STATUS.REPETITION_DRAW])

export function GameOverModal({
  winner,
  status,
  redName,
  blackName,
  youWon,
  onClose,
  onPlayAgain,
  onViewReplay,
  playAgainRequest,
  onRespondPlayAgain,
  playAgainError,
  ratingChange,
  ratingAfter,
}) {
  const isDraw = DRAW_STATUSES.has(status)
  const winnerName = winner === 'red' ? redName : blackName
  const loserName = winner === 'red' ? blackName : redName
  const winnerBg = winner === 'red' ? 'bg-piece-red' : 'bg-piece-black'
  const loserBg = winner === 'red' ? 'bg-piece-black' : 'bg-piece-red'
  // Resign is the one reason whose heading depends on which side is
  // reading it (everyone reads "Chiếu bí!" the same way, but "you resigned"
  // and "they resigned" are different sentences) — the winner/loser cards
  // below already read correctly from either side via redName/blackName
  // ("Bạn"/"Đối thủ"), this only needs the same treatment for the heading.
  const heading =
    status === GAME_STATUS.RESIGN
      ? youWon
        ? 'Đối thủ đã đầu hàng!'
        : 'Bạn đã đầu hàng!'
      : REASON_HEADING[status] ?? REASON_HEADING[GAME_STATUS.CHECKMATE]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-onyx-ink/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-surface rounded-2xl shadow-2xl p-8 text-center wood-shadow">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Đóng"
        >
          <Icon name="close" />
        </button>

        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            isDraw ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'
          }`}
        >
          <Icon name={isDraw ? 'handshake' : 'bolt'} className="text-4xl" filled />
        </div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-6">{heading}</h2>

        {isDraw ? (
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white bg-piece-red">
                {redName[0]}
              </div>
              <span className="font-label-md text-label-md text-on-surface">{redName}</span>
            </div>
            <span className="font-label-sm text-label-sm font-bold text-secondary uppercase tracking-wider">Hòa</span>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white bg-piece-black">
                {blackName[0]}
              </div>
              <span className="font-label-md text-label-md text-on-surface">{blackName}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="flex flex-col items-center gap-2">
              <span className="font-label-sm text-label-sm font-bold text-secondary uppercase tracking-wider">
                Thắng
              </span>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${winnerBg}`}>
                {winnerName[0]}
              </div>
              <span className="font-label-md text-label-md text-on-surface">{winnerName}</span>
            </div>
            <span className="font-body-md text-body-md text-on-surface-variant">và</span>
            <div className="flex flex-col items-center gap-2">
              <span className="font-label-sm text-label-sm font-bold text-error uppercase tracking-wider">Thua</span>
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white opacity-60 ${loserBg}`}
              >
                {loserName[0]}
              </div>
              <span className="font-label-md text-label-md text-on-surface-variant">{loserName}</span>
            </div>
          </div>
        )}

        {/* Only rendered once the server's Elo update for this match has
            actually arrived (see ChessGame.jsx's ratingUpdate) — never
            computed or guessed on the client, and absent entirely for a
            non-persisted (guest) match. */}
        {ratingChange !== undefined && (
          <div className="mb-6 -mt-2">
            <p
              className={`font-headline-sm text-headline-sm font-bold ${
                ratingChange > 0 ? 'text-secondary' : ratingChange < 0 ? 'text-error' : 'text-on-surface-variant'
              }`}
            >
              {ratingChange > 0 ? '+' : ''}
              {ratingChange} Rating
            </p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Rating: {ratingAfter}</p>
          </div>
        )}

        {playAgainError && !playAgainRequest && (
          <p className="font-label-sm text-label-sm text-error mb-3">{playAgainError}</p>
        )}

        {playAgainRequest === 'incoming' ? (
          <div className="space-y-3">
            <p className="font-label-md text-label-md text-on-surface-variant">Đối thủ muốn chơi lại ván mới</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onRespondPlayAgain?.(false)}
                className="flex-1 py-3 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container transition-colors"
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={() => onRespondPlayAgain?.(true)}
                className="flex-1 bg-primary text-on-primary py-3 rounded-lg font-label-md text-label-md flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-md"
              >
                <Icon name="refresh" />
                Đồng ý
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPlayAgain}
            disabled={playAgainRequest === 'outgoing'}
            className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md text-label-md flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-md disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <Icon name="refresh" />
            {playAgainRequest === 'outgoing' ? 'Đang chờ đối thủ...' : 'Chơi lại'}
          </button>
        )}

        {/* Only rendered once the match is actually persisted (both players
            logged in, see gameHistoryService.js on the server) — a local or
            guest match has nothing saved to replay. */}
        {onViewReplay && (
          <button
            type="button"
            onClick={onViewReplay}
            className="w-full mt-3 bg-transparent border-2 border-primary text-primary py-3 rounded-lg font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
          >
            <Icon name="history" />
            Xem lại ván đấu
          </button>
        )}
      </div>
    </div>
  )
}

export default GameOverModal
