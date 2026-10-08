import api from '../config/axios'

// Mirrors server/routes/notificationRoutes.js. The server identifies the
// caller from the JWT alone — none of these send a user id.
export const notificationService = {
  getNotifications: (limit = 30) => api.get('/notifications', { params: { limit } }).then((res) => res.data),
  getUnreadCount: () => api.get('/notifications/unread-count').then((res) => res.data),
  markRead: (notificationId) => api.patch(`/notifications/${notificationId}/read`).then((res) => res.data),
  markAllRead: () => api.patch('/notifications/read-all').then((res) => res.data),
}

export default notificationService
