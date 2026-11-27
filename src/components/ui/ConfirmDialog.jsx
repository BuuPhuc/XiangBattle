import { useId } from 'react'
import Button from './Button'
import { Modal, ModalIcon } from './Modal'

// A yes/no question in a Modal: icon, question, optional detail and error
// line, then [cancel] [confirm]. Used for sign-out, resign and an incoming
// draw offer.
//
// - `tone="danger"` (red icon, red confirm button) for something that cannot
//   be undone; `tone="success"` (green icon, primary confirm) for accepting.
// - `dismissible`: Escape / backdrop click count as cancel. Turn it off when
//   cancelling has a consequence of its own (declining a draw offer).
// - `busy`: a request is in flight — both buttons are disabled and the
//   dialog cannot be dismissed.
// - `focusCancel`: put keyboard focus on the cancel button when it opens.
//   Only for dialogs the player opened themselves; a dialog that pops up on
//   its own must not take focus from what they are typing (e.g. chat).
export function ConfirmDialog({
  icon,
  iconFilled = false,
  tone = 'danger',
  message,
  detail = null,
  error = null,
  confirmLabel,
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel,
  busy = false,
  dismissible = true,
  focusCancel = true,
}) {
  const titleId = useId()
  return (
    <Modal onDismiss={dismissible && !busy ? onCancel : undefined} labelledBy={titleId} className="space-y-6">
      <ModalIcon name={icon} tone={tone} filled={iconFilled} />
      <p id={titleId} className="font-body-md text-body-md text-on-surface">
        {message}
      </p>
      {detail && <p className="font-body-sm text-body-sm text-on-surface-variant -mt-3">{detail}</p>}
      {error && (
        <p role="alert" className="font-label-md text-label-md text-error -mt-3">
          {error}
        </p>
      )}
      <div className="flex gap-4">
        <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={busy} autoFocus={focusCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          className="flex-1 disabled:opacity-50"
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
