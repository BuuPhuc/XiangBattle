import { useState } from 'react'
import Icon from '../../../components/ui/Icon'

// `onResign`/`canResign` and `onOfferDraw`/`canOfferDraw`/`onRespondDraw`
// only apply to an online match — both concede/negotiate with a specific
// server-tracked opponent, which has no equivalent in local/offline play,
// so their buttons/prompts stay disabled or hidden unless supplied.
// Confirmation for resign (this client's own action) and the incoming
// draw prompt (the opponent's action, surfaced via `incomingDrawOffer`)
// are both handled entirely here as plain in-component modals, matching
// GameOverModal's overlay styling, so the caller only ever reacts to an
// actual confirmed resignation or an actual accept/decline decision.
// Undo/redo used to live here too — they moved to UndoRedoControls.jsx (in
// the sidebar) so this compact single row is all that sits under the board.
export function MatchActions({
  canResign = false,
  onResign,
  canOfferDraw = false,
  drawOfferPending = false,
  onOfferDraw,
  incomingDrawOffer = false,
  onRespondDraw,
}) {
  const [confirmingResign, setConfirmingResign] = useState(false)

  const handleConfirmResign = () => {
    setConfirmingResign(false)
    onResign?.()
  }

  const handleOfferDrawClick = () => {
    if (!drawOfferPending) onOfferDraw?.()
  }

  return (
    <div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirmingResign(true)}
          disabled={!canResign}
          className="flex-1 py-2 px-4 rounded-lg border-2 border-primary text-primary font-label-sm text-label-sm hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          <Icon name="flag" className="text-[18px]" />
          Đầu hàng
        </button>
        <button
          type="button"
          onClick={handleOfferDrawClick}
          disabled={!canOfferDraw || drawOfferPending}
          className="flex-1 py-2 px-4 rounded-lg bg-wood-dark text-white font-label-sm text-label-sm shadow-md hover:scale-[1.02] hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-md disabled:cursor-not-allowed"
        >
          <Icon name="handshake" className="text-[18px]" />
          {drawOfferPending ? 'Đang chờ phản hồi...' : 'Xin hòa'}
        </button>
      </div>

      {confirmingResign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-onyx-ink/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-surface rounded-2xl shadow-2xl p-6 text-center wood-shadow space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-error/10 text-error flex items-center justify-center mx-auto">
              <Icon name="flag" className="text-3xl" filled />
            </div>
            <p className="font-body-md text-body-md text-on-surface">Bạn có chắc muốn đầu hàng?</p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setConfirmingResign(false)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResign}
                className="flex-1 py-2.5 px-4 rounded-lg bg-error text-white font-label-md text-label-md hover:opacity-90 transition-opacity"
              >
                Đầu hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {incomingDrawOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-onyx-ink/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-surface rounded-2xl shadow-2xl p-6 text-center wood-shadow space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mx-auto">
              <Icon name="handshake" className="text-3xl" filled />
            </div>
            <p className="font-body-md text-body-md text-on-surface">Đối thủ đề nghị hòa</p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => onRespondDraw?.(false)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container transition-colors"
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={() => onRespondDraw?.(true)}
                className="flex-1 py-2.5 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 transition-opacity"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MatchActions
