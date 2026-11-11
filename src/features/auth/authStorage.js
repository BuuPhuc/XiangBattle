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

// Calls `callback(storedUser | null)` whenever ANOTHER tab of this browser
// logs in, logs out or switches account (the `storage` event never fires
// in the tab that made the change). All tabs share this storage, so the
// listening tab's in-memory session is stale from that moment on.
// Returns an unsubscribe function.
export function onStoredUserChange(callback) {
  function handleStorage(event) {
    // key === null means localStorage.clear() in the other tab.
    if (event.key !== null && event.key !== USER_KEY && event.key !== TOKEN_KEY) return
    callback(getStoredUser())
  }
  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
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
