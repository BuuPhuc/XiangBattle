import Icon from '../ui/Icon'
import Button from '../ui/Button'
import { cn } from '../utils/cn'
import { iconForType, formatRelativeTime } from '../../features/notifications/notificationUtils'

const RESOLUTION_TEXT = {
  accepted: { text: 'Đã chấp nhận lời mời.', className: 'text-secondary' },
  rejected: { text: 'Đã từ chối lời mời.', className: 'text-on-surface-variant' },
  expired: { text: 'Lời mời này không còn hiệu lực.', className: 'text-error' },
  'rematch-accepted': { text: 'Đã chấp nhận, đang vào trận…', className: 'text-secondary' },
  'rematch-expired': { text: 'Lời mời chơi lại này không còn hiệu lực.', className: 'text-error' },
  'challenge-accepted': { text: 'Đã chấp nhận, đang vào trận…', className: 'text-secondary' },
  'challenge-already-accepted': { text: 'Lời mời thách đấu đã được chấp nhận.', className: 'text-on-surface-variant' },
  'challenge-expired': { text: 'Lời mời thách đấu này không còn hiệu lực.', className: 'text-error' },
}

const ACTIONABLE_TYPES = new Set(['FRIEND_REQUEST', 'REMATCH_REQUEST', 'CHALLENGE'])

// What to say under a notification that no longer has buttons. An answer
// given in this session (`resolution`) wins; otherwise a challenge falls
// back to how the server says its request ended (`requestStatus`).
function resolutionKey(notification) {
  if (notification.resolution) return notification.resolution
  if (notification.type !== 'CHALLENGE' || notification.actionable || !notification.requestStatus) return null
  if (notification.requestStatus === 'ACCEPTED') return 'challenge-already-accepted'
  if (notification.requestStatus === 'REJECTED') return 'rejected'
  return 'challenge-expired'
}

// One row of the notification panel. The whole row is the click target
// (mark read + go wherever the type leads — see NotificationPanel); a
// still-pending friend request, rematch invite or challenge also gets its
// own Chấp nhận/Từ chối buttons, which answer it in place without
// triggering the row click.
export function NotificationItem({ notification, onOpen, onRespond }) {
  const resolution = RESOLUTION_TEXT[resolutionKey(notification)]
  const showActions = ACTIONABLE_TYPES.has(notification.type) && notification.actionable

  const handleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen(notification)
    }
  }

  const respond = (event, accept) => {
    event.stopPropagation()
    onRespond(notification, accept)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(notification)}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b border-outline-variant/20 last:border-b-0 cursor-pointer transition-colors focus:outline-none focus-visible:bg-surface-container',
        notification.read ? 'hover:bg-surface-container/60' : 'bg-primary/5 hover:bg-primary/10',
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
          notification.read ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary/10 text-primary',
        )}
      >
        <Icon name={iconForType(notification.type)} className="text-[20px]" />
      </div>

      <div className="flex-grow min-w-0">
        <p
          className={cn(
            'font-body-sm text-body-sm break-words',
            notification.read ? 'text-on-surface-variant' : 'text-on-surface font-semibold',
          )}
        >
          {notification.message}
        </p>
        <p className="font-label-sm text-label-sm text-on-surface-variant/70 mt-0.5">
          {formatRelativeTime(notification.createdAt)}
        </p>

        {showActions && (
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" disabled={notification.busy} onClick={(event) => respond(event, true)} className="disabled:opacity-50">
              Chấp nhận
            </Button>
            <Button
              variant="outline-sm"
              size="sm"
              disabled={notification.busy}
              onClick={(event) => respond(event, false)}
              className="disabled:opacity-50"
            >
              Từ chối
            </Button>
          </div>
        )}

        {resolution && <p className={cn('font-label-sm text-label-sm mt-1.5', resolution.className)}>{resolution.text}</p>}
        {notification.error && <p className="font-label-sm text-label-sm text-error mt-1.5">{notification.error}</p>}
      </div>

      {!notification.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" aria-label="Chưa đọc" />}
    </div>
  )
}

export default NotificationItem
