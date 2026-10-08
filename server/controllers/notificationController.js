const notificationService = require('../services/notificationService')

// Every handler here identifies the caller by req.auth.userId (the verified
// JWT, see authMiddleware.js) and nothing else — there is no userId in any
// path, query or body, so there is nothing a client could send to read or
// modify another user's notifications.
function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error('[notifications] unexpected error:', error.message)
      res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
      })
    }
  }
}

// GET /api/notifications?limit=30 — the caller's most recent notifications
// (newest first, capped at 50) plus the unread count, so opening the panel
// refreshes the badge in the same round trip.
const getNotifications = withErrorHandling(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    notificationService.listForUser(req.auth.userId, req.query.limit),
    notificationService.countUnread(req.auth.userId),
  ])
  return res.json({ success: true, notifications, unreadCount })
})

// GET /api/notifications/unread-count — what the bell badge shows.
const getUnreadCount = withErrorHandling(async (req, res) => {
  const count = await notificationService.countUnread(req.auth.userId)
  return res.json({ success: true, count })
})

// PATCH /api/notifications/:id/read — a notification that isn't the
// caller's is indistinguishable from one that doesn't exist (404 either way).
const markNotificationRead = withErrorHandling(async (req, res) => {
  const notificationId = Number(req.params.id)
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ success: false, code: 'INVALID_NOTIFICATION_ID', message: 'Mã thông báo không hợp lệ.' })
  }

  const notification = await notificationService.markRead(req.auth.userId, notificationId)
  if (!notification) {
    return res.status(404).json({ success: false, code: 'NOTIFICATION_NOT_FOUND', message: 'Không tìm thấy thông báo.' })
  }
  const unreadCount = await notificationService.countUnread(req.auth.userId)
  return res.json({ success: true, notification, unreadCount })
})

// PATCH /api/notifications/read-all
const markAllNotificationsRead = withErrorHandling(async (req, res) => {
  await notificationService.markAllRead(req.auth.userId)
  return res.json({ success: true, unreadCount: 0 })
})

module.exports = { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead }
