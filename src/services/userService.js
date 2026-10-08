import api from '../config/axios'

export const userService = {
  getMe: () => api.get('/users/me').then((res) => res.data),
  // Only username/bio ever belong in this payload — the backend whitelists
  // anyway, but keeping the caller's intent narrow here too.
  updateProfile: (payload) => api.patch('/users/me', payload).then((res) => res.data),
  // FormData — axios sets the multipart Content-Type (with boundary)
  // automatically as long as it's not overridden here.
  uploadAvatar: (file) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return api.post('/users/me/avatar', formData).then((res) => res.data)
  },
  // Another user's read-only public profile (Public Profile page,
  // PlayerCard links). Server strips this to public-safe fields only.
  getPublicProfile: (userId) => api.get(`/users/${userId}`).then((res) => res.data),
  // A user's FINISHED-match history (Public Profile's "Ván đấu gần đây").
  // Answers 403 GAME_HISTORY_PRIVATE when that user's own "Ván đấu gần
  // đây" setting excludes the caller — see the server's gameAccessService
  // for where that policy actually lives.
  getUserGames: (userId, { page = 1, limit = 10 } = {}) =>
    api.get(`/users/${userId}/games`, { params: { page, limit } }).then((res) => res.data),
  // Leaderboard — players ranked by rating DESC (computed server-side).
  // Also returns the caller's own rank/stats, even off the requested page.
  getLeaderboard: ({ page = 1, limit = 50 } = {}) =>
    api.get('/leaderboard', { params: { page, limit } }).then((res) => res.data),
  // Username search (Friends page's "Lời mời kết bạn" search box). Server
  // trims/limits the query and excludes the caller themselves — see
  // server/controllers/userController.js's searchUsers.
  searchUsers: (query) => api.get('/users/search', { params: { q: query } }).then((res) => res.data),
  // Settings page. The server only ever accepts the four settings fields
  // (soundEnabled, arrowsEnabled, recentGamesVisibility,
  // challengePermission) — see userController.js's SETTINGS_FIELDS.
  getSettings: () => api.get('/users/me/settings').then((res) => res.data),
  updateSettings: (payload) => api.patch('/users/me/settings', payload).then((res) => res.data),
}

export default userService
