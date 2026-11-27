import Button from '../../../components/ui/Button'
import Icon from '../../../components/ui/Icon'

// Split out of MatchActions so undo/redo — pure local board navigation, no
// server round trip — can live in the sidebar below the history/chat panel
// instead of under the board, leaving the board's own row for just
// resign/offer-draw (see MatchActions.jsx) and freeing up vertical space for
// a bigger board (see ChessBoard.jsx).
export function UndoRedoControls({ canUndo, canRedo, onUndo, onRedo }) {
  return (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="flex-1"
        onClick={onUndo}
        disabled={!canUndo}
      >
        <Icon name="undo" size="sm" />
        Hoàn tác
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="flex-1"
        onClick={onRedo}
        disabled={!canRedo}
      >
        <Icon name="redo" size="sm" />
        Làm lại
      </Button>
    </div>
  )
}

export default UndoRedoControls
