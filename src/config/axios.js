import axios from 'axios'
import { env } from './env'

// No default Content-Type here on purpose: axios already sets
// 'application/json' automatically for a plain object body, and — the
// reason this must NOT be forced — it needs to set its own
// 'multipart/form-data; boundary=...' header when the body is a FormData
// instance (e.g. userService.uploadAvatar). A hardcoded 'application/json'
// default overrides that per-request detection, silently breaking every
// multipart upload (the server sees no multipart body to parse at all).
export const api = axios.create({
  baseURL: env.apiUrl,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
