import Icon from '../../../components/ui/Icon'

export function MatchActions({ canUndo, canRedo, onUndo, onRedo }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex-1 py-2 px-4 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Icon name="undo" className="text-[18px]" />
          Hoàn tác
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="flex-1 py-2 px-4 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Icon name="redo" className="text-[18px]" />
          Làm lại
        </button>
      </div>
      <div className="flex gap-4">
        <button className="flex-1 py-3 px-4 rounded-lg border-2 border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
          <Icon name="flag" className="text-[20px]" />
          Xin thua
        </button>
        <button className="flex-1 py-3 px-4 rounded-lg bg-wood-dark text-white font-label-md text-label-md shadow-md hover:scale-[1.02] hover:shadow-lg transition-all flex items-center justify-center gap-2">
          <Icon name="handshake" className="text-[20px]" />
          Cầu hòa
        </button>
      </div>
    </div>
  )
}

export default MatchActions
