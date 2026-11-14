// What happens when the server says this browser's login is over.
//
// Exactly three error codes mean that (server/services/sessionService.js),
// whether they arrive as an HTTP 401 or as a socket `session_ended` event:
//   TOKEN_EXPIRED — the 7 days since login are up
//   INVALID_TOKEN — the token isn't ours / is malformed / its account is gone
//   TOKEN_REVOKED — "Đăng xuất khỏi tất cả thiết bị" (or, later, a password
//                   reset) ended every session of the account
// Nothing else signs the user out — not INVALID_CREDENTIALS (a wrong
// password on the login form, also a 401), not a 403, not a 503 / network
// failure: those are answered where they happen.
import { clearAuthSession } from './authStorage'
import socket, { setSocketAuthToken } from '../../socket/socket'

export const SESSION_END_CODES = ['TOKEN_EXPIRED', 'INVALID_TOKEN', 'TOKEN_REVOKED']

// Shown on the login page the user lands on (?session=<reason>).
// LOGGED_OUT_ALL is this device's own "Đăng xuất khỏi tất cả thiết bị".
export const SESSION_END_MESSAGES = {
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  INVALID_TOKEN: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
  TOKEN_REVOKED: 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.',
  LOGGED_OUT_ALL: 'Đã đăng xuất khỏi tất cả thiết bị.',
}

export function isSessionEndCode(code) {
  return SESSION_END_CODES.includes(code)
}

// The session-ending code of a failed axios request, or null.
export function sessionEndCodeOf(error) {
  const response = error && error.response
  if (!response || response.status !== 401) return null
  const code = response.data && response.data.code
  return isSessionEndCode(code) ? code : null
}

// App.jsx registers the one handler (it needs the store to tell a live
// session from one already gone); axios and the socket report through here.
let handler = null

export function setSessionEndHandler(next) {
  handler = next
  return () => {
    if (handler === next) handler = null
  }
}

// `token` is the token the refused request / socket actually used, so a
// late reply for an older session can never end a newer one. `source` is
// 'http' or 'socket'.
export function reportSessionEnded(code, token, source = 'http') {
  if (handler && isSessionEndCode(code)) handler(code, token, source)
}

// While this device's own logout-all is in flight, its socket is told
// TOKEN_REVOKED like every other device — that must not beat the request's
// own reply (which lands on LOGGED_OUT_ALL instead). Only the socket report
// is held back: an HTTP refusal of the logout-all request itself still ends
// the session as usual.
let ownLogoutAllInFlight = false
export function setOwnLogoutAllInFlight(value) {
  ownLogoutAllInFlight = value
}
export function isOwnLogoutAllInFlight() {
  return ownLogoutAllInFlight
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}`
}

export function sessionEndedPath(reason, returnTo) {
  const params = new URLSearchParams({ session: reason })
  if (returnTo) params.set('next', returnTo)
  return `/login?${params}`
}

// Forgets the login on this device and starts over on the login page with
// the reason shown. A full page load rather than an in-app navigation, so
// nothing on the current page — a match in progress included — keeps acting
// with the session that's gone; the reload is also what other tabs already
// do when this one clears the shared storage (onStoredUserChange). `next` is
// where Login sends the user back once they sign in again — for a match,
// its page, which then resumes the seat while the grace period still runs.
let leaving = false
export function endSessionAndLeave(reason) {
  if (leaving) return // several refused requests at once still mean one sign-out
  leaving = true
  clearAuthSession()
  setSocketAuthToken(null)
  socket.disconnect()
  window.location.assign(sessionEndedPath(reason, currentPath()))
}
