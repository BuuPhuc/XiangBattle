import api from '../config/axios'

export const authService = {
  login: (credentials) => api.post('/auth/login', credentials).then((res) => res.data),
  register: (payload) => api.post('/auth/register', payload).then((res) => res.data),
  logout: () => api.post('/auth/logout').then((res) => res.data),
}

export default authService
