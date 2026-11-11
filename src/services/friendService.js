import api from '../config/axios'

// Mirrors server/routes/friendRoutes.js — every call identifies the other
// person by their userId (never a friendship row id), consistent with how
// userService already addresses /users/:userId.
export const friendService = {
  getFriends: () => api.get('/friends').then((res) => res.data),
  // Only the friends online right now — the server does the filtering.
  getOnlineFriends: () => api.get('/friends/online').then((res) => res.data),
  getReceivedRequests: () => api.get('/friends/requests/received').then((res) => res.data),
  getSentRequests: () => api.get('/friends/requests/sent').then((res) => res.data),
  // Relationship between the current user and :userId — drives which
  // action button Public Profile shows.
  getStatus: (userId) => api.get(`/friends/status/${userId}`).then((res) => res.data),
  sendRequest: (userId) => api.post(`/friends/requests/${userId}`).then((res) => res.data),
  acceptRequest: (userId) => api.patch(`/friends/requests/${userId}/accept`).then((res) => res.data),
  rejectRequest: (userId) => api.patch(`/friends/requests/${userId}/reject`).then((res) => res.data),
  cancelRequest: (userId) => api.delete(`/friends/requests/${userId}`).then((res) => res.data),
  removeFriend: (userId) => api.delete(`/friends/${userId}`).then((res) => res.data),
}

export default friendService
