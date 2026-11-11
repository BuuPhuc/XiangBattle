// Decides which player identity a socket acts as. Never trusts the client's
// claim for an account: a `u:<userId>` playerId is what links a seat to a
// real account (match history, Elo, reconnecting to that account's seat),
// so it must come from the verified JWT (socket.user, see socketHandler.js's
// attachSocketUser), not from the payload.
//
//   - Logged-in socket: always `u:<socket.user.id>`, whatever was sent.
//   - Guest socket: the client's own random id (src/features/room/
//     roomSession.js), as long as it isn't trying to pass itself off as an
//     account (`u:` prefix) and looks like a sane id.
//
// Returns null when there's no usable identity; callers reply with
// INVALID_PLAYER_ID.
const GUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/

function resolvePlayerId(socket, claimedPlayerId) {
  if (socket.user && socket.user.id != null) return `u:${socket.user.id}`
  if (typeof claimedPlayerId !== 'string') return null
  if (claimedPlayerId.startsWith('u:')) return null
  return GUEST_ID_PATTERN.test(claimedPlayerId) ? claimedPlayerId : null
}

module.exports = { resolvePlayerId }
