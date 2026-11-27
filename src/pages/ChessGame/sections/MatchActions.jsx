import { useState } from 'react'
import Button from '../../../components/ui/Button'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import Icon from '../../../components/ui/Icon'

// `onResign`/`canResign` and `onOfferDraw`/`canOfferDraw`/`onRespondDraw`
// only apply to an online match — both concede/negotiate with a specific
// server-tracked opponent, which has no equivalent in local/offline play,
// so their buttons/prompts stay disabled or hidden unless supplied.
// Confirmation for resign (this client's own action) and the incoming
// draw prompt (the opponent's action, surfaced via `incomingDrawOffer`)
// are both handled entirely here with the shared ConfirmDialog, so the
// caller only ever reacts to an actual confirmed resignation or an actual
// accept/decline decision.
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmingResign(true)}
          disabled={!canResign}
          className="flex-1 disabled:opacity-40"
        >
          <Icon name="flag" size="md" />
          Đầu hàng
        </Button>
        <Button
          size="sm"
          onClick={handleOfferDrawClick}
          disabled={!canOfferDraw || drawOfferPending}
          className="flex-1 disabled:opacity-40"
        >
          <Icon name="handshake" size="md" />
          {drawOfferPending ? 'Đang chờ phản hồi...' : 'Xin hòa'}
        </Button>
      </div>

      {confirmingResign && (
        <ConfirmDialog
          icon="flag"
          iconFilled
          tone="danger"
          message="Bạn có chắc muốn đầu hàng?"
          confirmLabel="Đầu hàng"
          onConfirm={handleConfirmResign}
          onCancel={() => setConfirmingResign(false)}
        />
      )}

      {/* Pops up on its own mid-game: no Escape/backdrop (that would decline
          the offer by accident) and no focus grab (the player may be typing
          in the chat). */}
      {incomingDrawOffer && (
        <ConfirmDialog
          icon="handshake"
          iconFilled
          tone="success"
          message="Đối thủ đề nghị hòa"
          cancelLabel="Từ chối"
          confirmLabel="Đồng ý"
          onConfirm={() => onRespondDraw?.(true)}
          onCancel={() => onRespondDraw?.(false)}
          dismissible={false}
          focusCancel={false}
        />
      )}
    </div>
  )
}

export default MatchActions
