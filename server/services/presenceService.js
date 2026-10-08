const { listFriendUserIds } = require('./friendService')

// userId -> Set<socketId>. Runtime-only, in-memory presence — intentionally
// never persisted to Postgres (see contract.prisma's Friendship doc comment
// for why friendship itself IS persisted but "online" never is). A user can
// have several sockets open at once (two tabs, phone + laptop), so presence
// is ref-counted: only the *last* socket closing flips them offline, and
// only the *first* socket opening flips them online — this is what makes a
// page refresh (briefly zero-then-one sockets, but never actually zero
// between the old tab's disconnect and the new tab's connect) harmless, and
// what makes a genuine reconnect after a real drop report correctly too.
const onlineSockets = new Map()

// Returns true when this socket just brought userId online (0 -> 1
// sockets) — the caller only needs to broadcast a presence change on that
// transition, never on every socket added.
function addSocket(userId, socketId) {
  let sockets = onlineSockets.get(userId)
  if (!sockets) {
    sockets = new Set()
    onlineSockets.set(userId, sockets)
  }
  const wasOffline = sockets.size === 0
  sockets.add(socketId)
  return wasOffline
}

// Returns true when this was userId's last socket (1 -> 0) — the
// transition that actually means "now offline".
function removeSocket(userId, socketId) {
  const sockets = onlineSockets.get(userId)
  if (!sockets || !sockets.has(socketId)) return false
  sockets.delete(socketId)
  if (sockets.size === 0) {
    onlineSockets.delete(userId)
    return true
  }
  return false
}

function isOnline(userId) {
  return onlineSockets.has(userId)
}

// Ids of every socket userId currently has open (empty when offline) — for
// the rare caller that has to act on one specific connection rather than
// broadcast to all of them (see sockets/challengeHandler.js, which seats a
// challenger's socket in a room).
function getSocketIds(userId) {
  const sockets = onlineSockets.get(userId)
  return sockets ? [...sockets] : []
}

// Socket.IO room name every authenticated socket joins on connect (see
// socketHandler.js) — lets any part of the server reach "all of this
// user's open tabs/devices" without tracking socket ids itself.
function userRoom(userId) {
  return `user:${userId}`
}

// Tells userId's online friends that userId's own online state changed, so
// an already-open Friends page updates live instead of needing a refresh.
// Best-effort and fire-and-forget by design (see gameHistoryService.js for
// the same try/catch-and-log convention) — a failed presence broadcast
// should never be allowed to affect the socket connection/disconnect flow
// it's called from.
async function broadcastPresenceChange(io, userId, online) {
  try {
    const friendIds = await listFriendUserIds(userId)
    friendIds.forEach((friendId) => {
      io.to(userRoom(friendId)).emit('friend_presence', { userId, online })
    })
  } catch (error) {
    console.error(`[presence] failed to broadcast presence for user ${userId}:`, error.message)
  }
}

module.exports = { addSocket, removeSocket, isOnline, getSocketIds, userRoom, broadcastPresenceChange }
