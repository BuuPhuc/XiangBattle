import axios from 'axios'
import { env } from './env'
import { sessionEndCodeOf, reportSessionEnded } from '../features/auth/sessionEnd'

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

// A request that carried a token and got back one of the session-ending
// 401 codes (see features/auth/sessionEnd.js) means this browser's login is
// over — report it so the app signs itself out. Only those codes: a wrong
// password (INVALID_CREDENTIALS), a 403, a 503 or a network failure never
// sign anyone out. The error is always passed on to the caller unchanged.
api.interceptors.response.use(undefined, (error) => {
  const code = sessionEndCodeOf(error)
  const header = error.config && error.config.headers && error.config.headers.Authorization
  if (code && typeof header === 'string' && header.startsWith('Bearer ')) {
    reportSessionEnded(code, header.slice('Bearer '.length))
  }
  return Promise.reject(error)
})

export default api
