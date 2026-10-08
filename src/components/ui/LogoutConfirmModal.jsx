import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

// "Bạn có chắc chắn muốn đăng xuất?" — same look as the resign confirm in
// MatchActions.jsx. Portaled to <body> because both places that open it
// (AppSidebar, Navbar) are themselves fixed/backdrop-blurred containers,
// which would otherwise clip or mis-anchor a `fixed inset-0` overlay.
export function LogoutConfirmModal({ onConfirm, onCancel }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-onyx-ink/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-sm bg-surface rounded-2xl shadow-2xl p-6 text-center wood-shadow space-y-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-error/10 text-error flex items-center justify-center mx-auto">
          <Icon name="logout" className="text-3xl" />
        </div>
        <p id="logout-confirm-title" className="font-body-md text-body-md text-on-surface">
          Bạn có chắc chắn muốn đăng xuất?
        </p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="flex-1 py-2.5 px-4 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-lg bg-error text-white font-label-md text-label-md hover:opacity-90 transition-opacity"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default LogoutConfirmModal
