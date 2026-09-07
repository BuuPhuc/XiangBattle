import { getStoredUser } from '../auth/authStorage'

// Reconnect needs two things a refresh (or a closed-then-reopened tab)
// always wipes out of React state: a stable identity for "this is still
// the same player" (socket.id changes on every reconnect, so it can't be
// that), and which room to try to resume. Both live in localStorage —
// sessionStorage would not survive closing the tab and opening a new one
// (only a same-tab refresh), which is exactly the "A closes the tab, opens
// a new one, types the room code again" case this is meant to handle.
// Tradeoff: two tabs of the *same* browser now share one playerId (they're
// the same "player" as far as the server is concerned), so testing two
// players locally requires two different browsers/profiles (or one normal
// + one private/incognito window) rather than two tabs of one browser. No
// game state is stored here; the server remains the source of truth for
// that, this is only enough to ask it "put me back where I was".
const PLAYER_ID_KEY = 'xiangbattle:playerId'
const ROOM_ID_KEY = 'xiangbattle:roomId'

// A logged-in user gets a playerId derived from their stable database id
// instead of the random per-browser UUID below — the same account then
// resumes the same in-progress match from any device/browser it logs into,
// not just the one that created the room. Guests (or an expired session)
// fall straight back to the UUID, so nothing here requires being logged in.
export function getPlayerId() {
  const user = getStoredUser()
  if (user && user.id != null) return `u:${user.id}`

  let id = localStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}

export function getSavedRoomId() {
  return localStorage.getItem(ROOM_ID_KEY)
}

export function saveRoomId(roomId) {
  localStorage.setItem(ROOM_ID_KEY, roomId)
}

export function clearSavedRoomId() {
  localStorage.removeItem(ROOM_ID_KEY)
}
