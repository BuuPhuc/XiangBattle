import Icon from '../../../components/ui/Icon'

// The old "Lượt của Đỏ/Đen" live-turn banner is gone for good — whose turn
// it is now reads directly off the board via the active general's highlight
// (see ChessBoard.jsx/Piece.jsx), not a separate text area. This component
// only ever renders while browsing move history (the caller gates it on
// `isViewingHistory`), which is an unrelated feature this task didn't touch.
export function MatchStatus({ viewedMoveNumber, onReturnToLive }) {
  return (
    <div className="mb-3 px-6 py-2 glass-panel border border-gold-shimmer/30 rounded-full flex items-center gap-3">
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

export default MatchStatus
