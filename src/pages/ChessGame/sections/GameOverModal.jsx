import Icon from '../../../components/ui/Icon'
import { GAME_STATUS } from '../../../features/game/gameLogic.js'

const REASON_HEADING = {
  [GAME_STATUS.CHECKMATE]: 'Chiếu bí!',
  [GAME_STATUS.TIMEOUT_MOVE]: 'Hết giờ đi quân!',
  [GAME_STATUS.TIMEOUT_GAME]: 'Hết giờ ván đấu!',
  [GAME_STATUS.OPPONENT_LEFT]: 'Đối thủ đã rời trận!',
}

export function GameOverModal({ winner, status, redName, blackName, onClose, onPlayAgain }) {
  const winnerName = winner === 'red' ? redName : blackName
  const loserName = winner === 'red' ? blackName : redName
  const winnerBg = winner === 'red' ? 'bg-piece-red' : 'bg-piece-black'
  const loserBg = winner === 'red' ? 'bg-piece-black' : 'bg-piece-red'
  const heading = REASON_HEADING[status] ?? REASON_HEADING[GAME_STATUS.CHECKMATE]

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

        <div className="w-16 h-16 rounded-2xl bg-error/10 text-error flex items-center justify-center mx-auto mb-4">
          <Icon name="bolt" className="text-4xl" filled />
        </div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-6">{heading}</h2>

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

        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md text-label-md flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-md"
        >
          <Icon name="refresh" />
          Chơi lại
        </button>
      </div>
    </div>
  )
}

export default GameOverModal
