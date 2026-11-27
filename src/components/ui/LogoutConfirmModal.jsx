import ConfirmDialog from './ConfirmDialog'

// "Bạn có chắc chắn muốn đăng xuất?" — opened from AppSidebar and Navbar.
// Settings' "Đăng xuất khỏi tất cả thiết bị" reuses it with its own wording
// (message / detail / confirmLabel / cancelLabel), a `busy` state while the
// request is in flight (both buttons disabled, Escape and backdrop ignored)
// and an `error`. The dialog itself is the shared ConfirmDialog.
export function LogoutConfirmModal({
  onConfirm,
  onCancel,
  message = 'Bạn có chắc chắn muốn đăng xuất?',
  detail = null,
  confirmLabel = 'Đăng xuất',
  cancelLabel = 'Hủy',
  busy = false,
  error = null,
}) {
  return (
    <ConfirmDialog
      icon="logout"
      tone="danger"
      message={message}
      detail={detail}
      error={error}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      onCancel={onCancel}
      busy={busy}
    />
  )
}

export default LogoutConfirmModal
