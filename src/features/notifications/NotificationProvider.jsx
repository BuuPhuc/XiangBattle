import { useCallback, useEffect, useMemo, useState } from 'react'
import socket from '../../socket/socket'
import notificationService from '../../services/notificationService'
import friendService from '../../services/friendService'
import challengeService, { isDeadChallengeCode } from '../../services/challengeService'
import { NotificationContext } from './notificationContext'

const REMATCH_RESPONSE_TIMEOUT_MS = 5000

function errorMessage(err, fallback) {
  return (err.response && err.response.data && err.response.data.message) || fallback
}

// Owns the notification state for the whole app shell, so the two bells
// that exist at once (AppTopBar on mobile, AppSidebar on desktop — one is
// only hidden by CSS) share one fetch, one socket subscription and one
// badge instead of each keeping its own.
//
// The database is the source of truth: the badge comes from
// GET /notifications/unread-count on mount and again on every socket
// (re)connect, and the list is re-fetched each time the panel opens. The
// socket events only make changes show up without waiting for either —
// nothing here depends on having received them. Every count the badge
// shows is one the server sent; this never increments or decrements it
// locally.
//
// `enabled` is false for a guest. AppShellLayout also keys this component
// by user id, so switching account starts from empty state rather than
// briefly showing the previous user's notifications.
export function NotificationProvider({ enabled, children }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [actionError, setActionError] = useState(null)

  const patchNotification = useCallback((id, patch) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    try {
      const data = await notificationService.getUnreadCount()
      setUnreadCount(data.count)
    } catch {
      // Badge keeps its last known value; the next connect/open retries.
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined

    function handleNew({ notification, unreadCount: count }) {
      setNotifications((current) =>
        current.some((item) => item.id === notification.id) ? current : [notification, ...current],
      )
      setUnreadCount(count)
    }

    function handleUnreadCount({ count }) {
      setUnreadCount(count)
    }

    // A challenge was answered, cancelled or expired somewhere else (the
    // sender withdrew it, or it was answered from the Friends page / another
    // tab) — its notification stops offering buttons right away rather than
    // on the next reload. Only a display update: pressing a stale button
    // would have been refused by the server anyway.
    function handleChallengeUpdated({ challengeId, status }) {
      if (status === 'PENDING') return
      setNotifications((current) =>
        current.map((item) =>
          item.type === 'CHALLENGE' && item.relatedRequestId === challengeId
            ? { ...item, actionable: false, requestStatus: status }
            : item,
        ),
      )
    }

    // Runs once now and again on every socket (re)connect after a drop:
    // whatever was pushed while this client was offline is picked up from
    // the database here.
    function syncUnreadCount() {
      notificationService
        .getUnreadCount()
        .then((data) => setUnreadCount(data.count))
        .catch(() => {
          // Badge keeps its last known value; the next connect/open retries.
        })
    }
    const handleConnect = syncUnreadCount

    syncUnreadCount()
    socket.on('notification:new', handleNew)
    socket.on('notification:unread_count', handleUnreadCount)
    socket.on('challenge:updated', handleChallengeUpdated)
    socket.on('connect', handleConnect)

    return () => {
      socket.off('notification:new', handleNew)
      socket.off('notification:unread_count', handleUnreadCount)
      socket.off('challenge:updated', handleChallengeUpdated)
      socket.off('connect', handleConnect)
    }
  }, [enabled])

  const loadNotifications = useCallback(async () => {
    setStatus('loading')
    setActionError(null)
    try {
      const data = await notificationService.getNotifications()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  // Returns whether it worked. On failure nothing changes locally — the
  // notification stays in the list, still unread.
  const markRead = useCallback(
    async (notification) => {
      if (notification.read) return true
      try {
        const data = await notificationService.markRead(notification.id)
        patchNotification(notification.id, { read: true })
        setUnreadCount(data.unreadCount)
        return true
      } catch {
        return false
      }
    },
    [patchNotification],
  )

  const markAllRead = useCallback(async () => {
    setActionError(null)
    try {
      const data = await notificationService.markAllRead()
      setNotifications((current) => current.map((item) => (item.read ? item : { ...item, read: true })))
      setUnreadCount(data.unreadCount)
    } catch {
      setActionError('Không thể đánh dấu đã đọc. Vui lòng thử lại.')
    }
  }, [])

  // Accept/reject straight from a FRIEND_REQUEST notification, through the
  // same friend endpoints the Friends page uses. Whether the request can
  // still be answered is decided by the server when the call lands
  // (friendService checks the Friendship row itself) — `actionable` on the
  // notification only decides whether the buttons are drawn. A request that
  // was cancelled, already answered, or otherwise gone comes back 404 and is
  // shown as no longer valid; the notification itself stays as history.
  const respondToFriendRequest = useCallback(
    async (notification, accept) => {
      patchNotification(notification.id, { busy: true, error: null })
      try {
        if (accept) await friendService.acceptRequest(notification.relatedUserId)
        else await friendService.rejectRequest(notification.relatedUserId)
        // The server marks the notification read as part of answering.
        patchNotification(notification.id, {
          busy: false,
          actionable: false,
          read: true,
          resolution: accept ? 'accepted' : 'rejected',
        })
        refreshUnreadCount()
      } catch (err) {
        if (err.response && err.response.status === 404) {
          patchNotification(notification.id, { busy: false, actionable: false, resolution: 'expired' })
          markRead(notification)
          return
        }
        patchNotification(notification.id, {
          busy: false,
          error: errorMessage(err, accept ? 'Không thể chấp nhận lời mời.' : 'Không thể từ chối lời mời.'),
        })
      }
    },
    [patchNotification, refreshUnreadCount, markRead],
  )

  // Accept/decline a rematch invite straight from its notification — works
  // whether or not this player is still on the match screen. The server
  // decides, at this moment, whether the invite can still be answered (see
  // gameHandler.js's respond_rematch_invite); `actionable` only decided
  // whether the buttons were drawn. Resolves { ok, roomId } so the caller
  // can take the player into the match on a successful accept.
  const respondToRematch = useCallback(
    (notification, accept) =>
      new Promise((resolve) => {
        const fail = (patch) => {
          patchNotification(notification.id, { busy: false, ...patch })
          resolve({ ok: false })
        }
        if (!socket.connected) {
          fail({ error: 'Mất kết nối. Vui lòng thử lại.' })
          return
        }
        patchNotification(notification.id, { busy: true, error: null })
        socket
          .timeout(REMATCH_RESPONSE_TIMEOUT_MS)
          .emit('respond_rematch_invite', { gameId: notification.relatedGameId, accept }, (err, response) => {
            if (err) {
              fail({ error: 'Không nhận được phản hồi. Vui lòng thử lại.' })
              return
            }
            if (!response || !response.ok) {
              markRead(notification)
              if (response && response.code === 'REMATCH_INVITE_EXPIRED') {
                fail({ actionable: false, resolution: 'rematch-expired' })
              } else {
                // e.g. already seated in another room — the invite itself
                // is still open, so the buttons stay.
                fail({ error: (response && response.message) || 'Không thể phản hồi lời mời chơi lại.' })
              }
              return
            }
            markRead(notification)
            patchNotification(notification.id, {
              busy: false,
              actionable: false,
              resolution: accept ? 'rematch-accepted' : 'rejected',
            })
            resolve({ ok: true, roomId: response.roomId })
          })
      }),
    [patchNotification, markRead],
  )

  // Accept/reject a challenge straight from its notification. The
  // notification only supplies the challenge id (relatedRequestId); whether
  // that challenge can still be answered is the server's call at this moment
  // (challengeService checks the Challenge row — see
  // server/sockets/challengeHandler.js). Resolves { ok, roomId } so the
  // caller can take the player into the match on a successful accept.
  const respondToChallenge = useCallback(
    async (notification, accept) => {
      const challengeId = notification.relatedRequestId
      patchNotification(notification.id, { busy: true, error: null })

      // Withdrawn, expired or already answered: nothing left to press.
      const settleDead = (requestStatus) => {
        patchNotification(notification.id, { busy: false, actionable: false, requestStatus: requestStatus || 'CANCELLED' })
        markRead(notification)
        return { ok: false }
      }

      if (!accept) {
        try {
          await challengeService.reject(challengeId)
          // The server marks the notification read as part of answering.
          patchNotification(notification.id, { busy: false, actionable: false, read: true, resolution: 'rejected' })
          refreshUnreadCount()
          return { ok: true }
        } catch (err) {
          const data = (err.response && err.response.data) || {}
          if (isDeadChallengeCode(data.code)) return settleDead(data.status)
          patchNotification(notification.id, { busy: false, error: errorMessage(err, 'Không thể từ chối lời mời thách đấu.') })
          return { ok: false }
        }
      }

      const result = await challengeService.accept(challengeId)
      if (!result.ok) {
        if (isDeadChallengeCode(result.code)) return settleDead(result.status)
        // e.g. the challenger is offline or mid-game, or I am still in
        // another room — the challenge itself is still open, so the buttons
        // stay.
        patchNotification(notification.id, {
          busy: false,
          error: result.message || 'Không thể chấp nhận lời mời thách đấu.',
        })
        return { ok: false }
      }
      patchNotification(notification.id, { busy: false, actionable: false, read: true, resolution: 'challenge-accepted' })
      refreshUnreadCount()
      return { ok: true, roomId: result.roomId }
    },
    [patchNotification, refreshUnreadCount, markRead],
  )

  const value = useMemo(
    () => ({
      enabled,
      unreadCount: enabled ? unreadCount : 0,
      notifications,
      status,
      actionError,
      loadNotifications,
      markRead,
      markAllRead,
      respondToFriendRequest,
      respondToRematch,
      respondToChallenge,
    }),
    [
      enabled,
      unreadCount,
      notifications,
      status,
      actionError,
      loadNotifications,
      markRead,
      markAllRead,
      respondToFriendRequest,
      respondToRematch,
      respondToChallenge,
    ],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export default NotificationProvider
