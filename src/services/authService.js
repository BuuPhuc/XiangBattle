import api from '../config/axios'

export const authService = {
  register: (payload) => api.post('/auth/register', payload).then((res) => res.data),
  login: (credentials) => api.post('/auth/login', credentials).then((res) => res.data),
  getMe: () => api.get('/auth/me').then((res) => res.data),
  verifyEmail: (token) => api.get('/auth/verify-email', { params: { token } }).then((res) => res.data),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }).then((res) => res.data),
  // Ends every session of the signed-in account, this one included.
  logoutAll: () => api.post('/auth/logout-all').then((res) => res.data),
}

export default authService
