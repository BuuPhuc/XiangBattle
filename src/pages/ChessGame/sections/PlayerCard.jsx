import Icon from '../../../components/ui/Icon'
import { cn } from '../../../components/utils/cn'

export function PlayerCard({ name, elo, side, clock, clockActive, online, accentClassName = '' }) {
  const isRed = side === 'red'

  return (
    <div className={cn('glass-panel border border-gold-shimmer/30 p-4 rounded-xl flex flex-col gap-4', accentClassName)}>
      <div className="flex items-center gap-4 w-full">
        <div
          className={cn(
            'w-16 h-16 rounded-full border-2 flex items-center justify-center shadow-md shrink-0',
            isRed ? 'border-error bg-piece-red/10 text-error' : 'border-wood-dark bg-wood-dark/10 text-wood-dark'
          )}
        >
          <Icon name="person" className="text-3xl" />
        </div>
        <div className="flex-1">
          <h3 className="font-label-md text-label-md text-on-surface">{name}</h3>
          <p className="font-label-sm text-label-sm text-on-surface-variant">ELO: {elo}</p>
          {online && (
            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container mt-1">
              <span className="w-2 h-2 rounded-full bg-secondary mr-2 shadow-[0_0_5px_rgba(27,109,36,0.5)]" />
              <span className="text-xs font-medium text-on-surface-variant">Đang trực tuyến</span>
            </div>
          )}
        </div>
      </div>
      <div className="w-full text-center xl:text-left">
        <div className={cn('player-clock', clockActive && 'active')}>{clock}</div>
      </div>
    </div>
  )
}

export default PlayerCard
