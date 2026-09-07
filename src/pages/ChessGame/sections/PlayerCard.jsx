import Icon from '../../../components/ui/Icon'
import { cn } from '../../../components/utils/cn'

// A single compact row — clocks, name/elo, and avatar — meant to sandwich
// GameHistoryPanel (see ChessGame.jsx) rather than stand as its own tall
// card the way this used to. `capturedPieces` is optional and only ever
// passed for the side whose captures are being shown (see ChessGame.jsx,
// which only tracks what black has captured, same as before this was a
// separate CapturedPieces panel).
export function PlayerCard({ name, elo, side, moveTime, gameTime, clockActive, online, accentClassName = '', capturedPieces = [] }) {
  const isRed = side === 'red'

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
        <h3 className="font-label-md text-label-md text-on-surface truncate">{name}</h3>
        <p className="font-label-sm text-label-sm text-on-surface-variant">ELO {elo}</p>
      </div>

      {capturedPieces.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 flex-wrap justify-end max-w-[25%]">
          {capturedPieces.slice(0, 6).map((piece, i) => (
            <span
              key={`${piece.id}-${i}`}
              className="w-5 h-5 rounded-full bg-piece-red border border-white flex items-center justify-center text-white text-[9px] font-bold shadow-sm"
            >
              {piece.char}
            </span>
          ))}
        </div>
      )}

      <div className="relative shrink-0">
        <div
          className={cn(
            'w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-md',
            isRed ? 'border-error bg-piece-red/10 text-error' : 'border-wood-dark bg-wood-dark/10 text-wood-dark'
          )}
        >
          <Icon name="person" className="text-2xl" />
        </div>
        {online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-secondary border-2 border-surface" />}
      </div>
    </div>
  )
}

export default PlayerCard
