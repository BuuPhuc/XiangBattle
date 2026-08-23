import api from '../config/axios'

export const userService = {
  getProfile: () => api.get('/users/me').then((res) => res.data),
  getLeaderboard: () => api.get('/users/leaderboard').then((res) => res.data),
}

export default userService
