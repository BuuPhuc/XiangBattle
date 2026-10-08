import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import useNotifications from '../../features/notifications/notificationContext'
import { saveRoomId } from '../../features/room/roomSession'
import NotificationItem from './NotificationItem'

// The dropdown body: header ("Thông báo" + mark-all), then one of
// loading / error / empty / list. Positioning is the caller's job (see
// NotificationBell) — this only fills whatever box it's given.
export function NotificationPanel({ onClose }) {
  const navigate = useNavigate()
  const {
    notifications,
    status,
    actionError,
    unreadCount,
    loadNotifications,
    markRead,
    markAllRead,
    respondToFriendRequest,
    respondToRematch,
    respondToChallenge,
  } = useNotifications()

  const goTo = (path, options) => {
    onClose()
    navigate(path, options)
  }

  // Clicking a notification marks it read and follows it to whatever it is
  // about, using routes that already exist. Marking read isn't awaited — if
  // it fails the row simply stays unread, it never blocks the navigation.
  const handleOpen = (notification) => {
    markRead(notification)

    switch (notification.type) {
      case 'FRIEND_REQUEST':
        goTo('/friends', { state: { tab: 'received' } })
        return
      case 'FRIEND_ACCEPTED':
        if (notification.relatedUserId) goTo(`/profile/${notification.relatedUserId}`)
        return
      case 'GAME_RESULT':
        if (notification.relatedGameId) goTo(`/replay/${notification.relatedGameId}`)
        return
      case 'CHALLENGE':
        // Answered with its own buttons (see handleRespond); the row itself
        // leads to whoever sent it.
        if (notification.relatedUserId) goTo(`/profile/${notification.relatedUserId}`)
        return
      default:
        // REMATCH_REQUEST is answered with its own buttons (see
        // handleRespond). Nothing to open.
        return
    }
  }

  const handleRespond = async (notification, accept) => {
    if (notification.type === 'FRIEND_REQUEST') {
      respondToFriendRequest(notification, accept)
      return
    }
    // A rematch invite and a challenge are different requests answered
    // through different server paths — they only share what happens after a
    // successful accept.
    let result
    if (notification.type === 'REMATCH_REQUEST') result = await respondToRematch(notification, accept)
    else if (notification.type === 'CHALLENGE') result = await respondToChallenge(notification, accept)
    else return

    if (!result.ok || !accept || !result.roomId) return
    // The server has already seated this player in the room and started
    // the match. Saving the room id is what makes the match screen resume
    // it when it mounts (useRoom's rejoin handshake) if we aren't already
    // on it; if we are, its game_started / match_found listener has picked
    // it up.
    saveRoomId(result.roomId)
    goTo('/room')
  }

  return (
    <div className="flex flex-col max-h-[min(32rem,calc(100vh-6rem))]">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant/30 flex-shrink-0">
        <h2 className="font-label-md text-label-md font-bold text-on-surface">Thông báo</h2>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="font-label-sm text-label-sm font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-default"
        >
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {actionError && (
        <p className="px-4 py-2 font-label-sm text-label-sm text-error bg-error-container/40 flex-shrink-0">{actionError}</p>
      )}

      <div className="overflow-y-auto">
        {status === 'loading' && (
          <p className="py-10 text-center px-4 font-body-sm text-body-sm text-on-surface-variant">Đang tải thông báo…</p>
        )}

        {status === 'error' && (
          <div className="py-10 text-center px-4 space-y-3">
            <p className="font-body-sm text-body-sm text-error">Không thể tải thông báo.</p>
            <button
              type="button"
              onClick={loadNotifications}
              className="font-label-md text-label-md font-semibold text-primary hover:underline"
            >
              Thử lại
            </button>
          </div>
        )}

        {status === 'ready' && notifications.length === 0 && (
          <div className="py-10 text-center px-4 space-y-2">
            <Icon name="notifications_off" className="text-4xl text-on-surface-variant/40 block" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">Bạn chưa có thông báo mới.</p>
          </div>
        )}

        {status === 'ready' &&
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onOpen={handleOpen}
              onRespond={handleRespond}
            />
          ))}
      </div>
    </div>
  )
}

export default NotificationPanel
