// gameId -> { gameId, roomId, fromUserId, toUserId }. Runtime-only, like the
// Room it points at (see roomManager.js): a rematch invite is "come back
// into this room for another match", so it cannot outlive the room or a
// server restart anyway.
//
// This is what lets a rematch request reach an opponent who has already
// left the match screen: the request no longer has to be answered from
// inside the room (room.playAgainRequestBy), it can be answered from the
// REMATCH_REQUEST notification. An entry here only says an invite was
// *made* — whether it can still be acted on is re-derived from the Room
// itself every time someone answers (see gameHandler.js's
// respond_rematch_invite), never assumed from this map.
const invites = new Map()

function set(invite) {
  invites.set(invite.gameId, invite)
}

function get(gameId) {
  return invites.get(gameId) || null
}

function remove(gameId) {
  invites.delete(gameId)
}

// The inviter left their room for good — nothing left to come back to.
function removeFromInviter(roomId, fromUserId) {
  for (const invite of invites.values()) {
    if (invite.roomId === roomId && invite.fromUserId === fromUserId) invites.delete(invite.gameId)
  }
}

// Display hint for the notification list only (should the Chấp nhận / Từ
// chối buttons be drawn) — answering is validated separately.
function isPending(gameId, fromUserId, toUserId) {
  const invite = invites.get(gameId)
  return Boolean(invite) && invite.fromUserId === fromUserId && invite.toUserId === toUserId
}

module.exports = { set, get, remove, removeFromInviter, isPending }
