import Icon from '../../../components/ui/Icon'

// Split out of MatchActions so undo/redo — pure local board navigation, no
// server round trip — can live in the sidebar below the history/chat panel
// instead of under the board, leaving the board's own row for just
// resign/offer-draw (see MatchActions.jsx) and freeing up vertical space for
// a bigger board (see ChessBoard.jsx).
export function UndoRedoControls({ canUndo, canRedo, onUndo, onRedo }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="flex-1 py-1.5 px-3 rounded-lg border border-outline-variant text-on-surface-variant font-label-sm text-label-sm hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Icon name="undo" className="text-[16px]" />
        Hoàn tác
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className="flex-1 py-1.5 px-3 rounded-lg border border-outline-variant text-on-surface-variant font-label-sm text-label-sm hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Icon name="redo" className="text-[16px]" />
        Làm lại
      </button>
    </div>
  )
}

export default UndoRedoControls
