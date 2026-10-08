const express = require('express')
const { requireAuth } = require('../middleware/authMiddleware')
const {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationController')

const router = express.Router()

router.get('/', requireAuth, getNotifications)
router.get('/unread-count', requireAuth, getUnreadCount)

// Literal '/read-all' ahead of the ':id' route — same ordering convention
// as userRoutes.js / friendRoutes.js.
router.patch('/read-all', requireAuth, markAllNotificationsRead)
router.patch('/:id/read', requireAuth, markNotificationRead)

module.exports = router
