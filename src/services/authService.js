import api from '../config/axios'

export const authService = {
  register: (payload) => api.post('/auth/register', payload).then((res) => res.data),
  login: (credentials) => api.post('/auth/login', credentials).then((res) => res.data),
  getMe: () => api.get('/auth/me').then((res) => res.data),
  verifyEmail: (token) => api.get('/auth/verify-email', { params: { token } }).then((res) => res.data),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }).then((res) => res.data),
  // "Quên mật khẩu": always the same reply, whether or not the email has an account.
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((res) => res.data),
  // The token goes in the body only — never in a URL.
  resetPassword: ({ token, password }) => api.post('/auth/reset-password', { token, password }).then((res) => res.data),
  // Ends every session of the signed-in account, this one included.
  logoutAll: () => api.post('/auth/logout-all').then((res) => res.data),
}

export default authService
