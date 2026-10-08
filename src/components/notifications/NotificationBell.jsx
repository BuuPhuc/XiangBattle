import { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import { cn } from '../utils/cn'
import useNotifications from '../../features/notifications/notificationContext'
import { formatBadgeCount } from '../../features/notifications/notificationUtils'
import NotificationPanel from './NotificationPanel'

// Where the panel opens relative to the bell, per host:
//   'sidebar' — beside the desktop sidebar, same flyout placement the
//               "Xã hội" menu already uses there.
//   'topbar'  — under the mobile top bar, spanning the screen width on a
//               phone and capped to a dropdown from `sm` up.
const PANEL_POSITION = {
  sidebar: 'absolute left-full top-0 ml-10 w-96',
  topbar: 'fixed top-[68px] left-2 right-2 sm:left-auto sm:w-96',
}

// The bell + unread badge + dropdown. Renders nothing for a guest — there
// is no account to have notifications for.
export function NotificationBell({ placement = 'sidebar', className = '' }) {
  const { enabled, unreadCount, loadNotifications } = useNotifications()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!enabled) return null

  // Re-fetched on every open rather than trusted from the last time: the
  // list (and which friend requests are still answerable) always reflects
  // the database as of now.
  const toggle = () => {
    if (!open) loadNotifications()
    setOpen(!open)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          'relative w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 active:scale-95',
          open ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-primary',
        )}
      >
        <Icon name="notifications" filled={open || unreadCount > 0} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[11px] leading-[18px] font-bold text-center">
            {formatBadgeCount(unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          className={cn(
            'z-50 bg-surface border border-gold-shimmer/40 rounded-xl shadow-xl overflow-hidden',
            PANEL_POSITION[placement],
          )}
        >
          <NotificationPanel onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

export default NotificationBell
