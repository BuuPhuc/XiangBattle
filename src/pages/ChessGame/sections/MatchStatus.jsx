import Icon from '../../../components/ui/Icon'

export function MatchStatus({ turn, inCheck, isViewingHistory, viewedMoveNumber, onReturnToLive }) {
  if (isViewingHistory) {
    return (
      <div className="mb-6 px-6 py-2 glass-panel border border-gold-shimmer/30 rounded-full flex items-center gap-3">
        <Icon name="visibility" className="text-[18px] text-on-surface-variant" />
        <span className="font-label-md text-label-md text-on-surface-variant">
          {viewedMoveNumber === 0 ? 'Đang xem: vị trí ban đầu' : `Đang xem nước đi #${viewedMoveNumber}`}
        </span>
        <button
          type="button"
          onClick={onReturnToLive}
          className="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1"
        >
          <Icon name="undo" className="text-[16px]" />
          Về hiện tại
        </button>
      </div>
    )
  }

  return (
    <div className="mb-6 px-6 py-2 glass-panel border border-gold-shimmer/30 rounded-full flex items-center gap-3">
      <span
        className={`w-3 h-3 rounded-full bg-error shadow-[0_0_8px_rgba(186,26,26,0.6)] ${inCheck ? 'animate-pulse' : ''}`}
      />
      <span className="font-headline-md text-headline-md text-on-surface">Lượt của {turn}</span>
      {inCheck && (
        <span className="font-label-md text-label-md text-error uppercase tracking-wider animate-pulse">Chiếu!</span>
      )}
    </div>
  )
}

export default MatchStatus
