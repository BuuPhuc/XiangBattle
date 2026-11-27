import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../utils/cn'
import Button from './Button'
import Icon from './Icon'

const PADDING = {
  md: 'p-6',
  lg: 'p-8',
}

// The one dialog shell of the app: dimmed, blurred backdrop and a centered
// wood-shadow card. Portaled to <body> so a modal opened from inside a
// fixed or backdrop-blurred container (sidebar, top bar) is never clipped
// or anchored to that container instead of the viewport.
//
// - `onDismiss`: when given, Escape and a click on the backdrop call it. Leave
//   it out for a dialog that must be answered explicitly (an incoming draw
//   offer, the game result), or while a request is in flight.
// - `onClose`: when given, shows the "Đóng" X button in the top-right corner.
// - `labelledBy`: id of the element that names the dialog (its heading or
//   question), so screen readers and tests can find it by name.
export function Modal({ children, onDismiss, onClose, labelledBy, padding = 'md', className }) {
  useEffect(() => {
    if (!onDismiss) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss])

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-onyx-ink/60 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'relative w-full max-w-sm bg-surface rounded-2xl shadow-2xl text-center wood-shadow',
          PADDING[padding],
          className
        )}
      >
        {onClose && (
          <Button variant="icon" onClick={onClose} aria-label="Đóng" className="absolute top-3 right-3">
            <Icon name="close" />
          </Button>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}

const TILE_TONE = {
  danger: 'bg-error/10 text-error',
  success: 'bg-secondary/10 text-secondary',
}

// The rounded icon square at the top of a dialog.
export function ModalIcon({ name, tone = 'danger', size = 'md', filled = false }) {
  return (
    <div
      className={cn(
        'rounded-2xl flex items-center justify-center mx-auto',
        size === 'lg' ? 'w-16 h-16' : 'w-14 h-14',
        TILE_TONE[tone]
      )}
    >
      <Icon name={name} size={size === 'lg' ? 'xl' : 'lg'} filled={filled} />
    </div>
  )
}

export default Modal
