// Reconnect needs two things a refresh always wipes out of React state: a
// stable identity for "this is still the same player" (socket.id changes
// on every reconnect, so it can't be that), and which room to try to
// resume. Both live in sessionStorage rather than localStorage on purpose
// — per-tab, not shared across tabs, so two tabs on the same browser stay
// two independent players/sessions, matching how this app is tested and
// used. No game state is stored here; the server remains the source of
// truth for that, this is only enough to ask it "put me back where I was".
const PLAYER_ID_KEY = 'xiangbattle:playerId'
const ROOM_ID_KEY = 'xiangbattle:roomId'

export function getPlayerId() {
  let id = sessionStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}

export function getSavedRoomId() {
  return sessionStorage.getItem(ROOM_ID_KEY)
}

export function saveRoomId(roomId) {
  sessionStorage.setItem(ROOM_ID_KEY, roomId)
}

export function clearSavedRoomId() {
  sessionStorage.removeItem(ROOM_ID_KEY)
}
