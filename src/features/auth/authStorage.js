// Two localStorage keys, deliberately separate: the JWT (opaque, sent as a
// bearer token) and a small non-sensitive snapshot of the user (id/username/
// email/emailVerified) that other modules — like roomSession's getPlayerId —
// can read synchronously without touching Redux or making a network call.
// Never store the password, the email verification token, or anything else
// sensitive here.
const TOKEN_KEY = 'accessToken'
const USER_KEY = 'xiangbattle_user'

export function saveAuthSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function loadAuthSession() {
  const token = localStorage.getItem(TOKEN_KEY)
  const raw = localStorage.getItem(USER_KEY)
  if (!token || !raw) return null
  try {
    return { token, user: JSON.parse(raw) }
  } catch {
    return null
  }
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
