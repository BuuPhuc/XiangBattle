const friendService = require('../services/friendService')
const presenceService = require('../services/presenceService')
const notificationService = require('../services/notificationService')

// Error codes friendService throws map to HTTP statuses here — the one
// place that decides the wire shape, same split userController.js and
// roomManager/socketHandler.js already use (service throws a typed
// `{ code, message }` error, caller decides the status).
const ERROR_STATUS = {
  USER_NOT_FOUND: 404,
  ALREADY_FRIENDS: 409,
  REQUEST_ALREADY_SENT: 409,
  REQUEST_NOT_FOUND: 404,
  FRIENDSHIP_NOT_FOUND: 404,
}

function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      if (error.code && ERROR_STATUS[error.code]) {
        return res.status(ERROR_STATUS[error.code]).json({ success: false, code: error.code, message: error.message })
      }
      console.error('[friends] unexpected error:', error.message)
      res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
      })
    }
  }
}

// Parses :userId the same way userController.js does — never trusts it
// beyond "is this syntactically a user id", the actual existence check
// stays in friendService (sendRequest) or falls out naturally as "not
// found" everywhere else.
function parseTargetUserId(req, res) {
  const userId = Number(req.params.userId)
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ success: false, code: 'INVALID_USER_ID', message: 'Mã người dùng không hợp lệ.' })
    return null
  }
  return userId
}

function withOnlineFlag(person) {
  return { ...person, online: presenceService.isOnline(person.id) }
}

// GET /api/friends — current user's accepted friends, each annotated with
// live online/offline from presenceService's in-memory registry (never
// persisted — see that module's doc comment).
const getFriends = withErrorHandling(async (req, res) => {
  const friends = await friendService.listFriends(req.auth.userId)
  return res.json({ success: true, friends: friends.map(withOnlineFlag) })
})

// GET /api/friends/online — only the accepted friends who are online right
// now, with just what an avatar needs. The filtering happens here, against
// the caller's own friend list (req.auth.userId, from the verified JWT) —
// a client never receives anyone's presence but its friends'.
const getOnlineFriends = withErrorHandling(async (req, res) => {
  const friends = await friendService.listFriends(req.auth.userId)
  return res.json({
    success: true,
    friends: friends
      .filter((friend) => presenceService.isOnline(friend.id))
      .map(({ id, username, displayName, avatarUrl }) => ({ id, username, displayName, avatarUrl })),
  })
})

// Tells both sides, on every tab they have open, that the two of them just
// became or stopped being friends, so anything listing friends (the home
// page's online friends) re-reads it instead of waiting for a reload. Each
// side is only told the other's id — the lists themselves always come from
// the authenticated GETs above.
function announceFriendshipChange(userIdA, userIdB) {
  notificationService.emitToUser(userIdA, 'friends:changed', { userId: userIdB })
  notificationService.emitToUser(userIdB, 'friends:changed', { userId: userIdA })
}

// GET /api/friends/requests/received — pending requests sent TO me.
const getReceivedRequests = withErrorHandling(async (req, res) => {
  const requests = await friendService.listReceivedRequests(req.auth.userId)
  return res.json({ success: true, requests })
})

// GET /api/friends/requests/sent — pending requests I sent, still unresolved.
const getSentRequests = withErrorHandling(async (req, res) => {
  const requests = await friendService.listSentRequests(req.auth.userId)
  return res.json({ success: true, requests })
})

// GET /api/friends/status/:userId — relationship between me and :userId,
// from my point of view. Drives which action Public Profile shows
// ('NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS' | 'SELF').
const getRelationshipStatus = withErrorHandling(async (req, res) => {
  const targetUserId = parseTargetUserId(req, res)
  if (targetUserId === null) return
  const status = await friendService.getRelationshipStatus(req.auth.userId, targetUserId)
  return res.json({ success: true, status })
})

// POST /api/friends/requests/:userId — send (or, if :userId already asked
// me, auto-accept) a friend request. currentUser always comes from the
// verified JWT (req.auth.userId), never from the body — nothing here lets
// caller A act as any id but their own.
const sendFriendRequest = withErrorHandling(async (req, res) => {
  const targetUserId = parseTargetUserId(req, res)
  if (targetUserId === null) return
  if (targetUserId === req.auth.userId) {
    return res.status(400).json({ success: false, code: 'SELF_REQUEST', message: 'Không thể tự kết bạn với chính mình.' })
  }

  const { friendship, autoAccepted } = await friendService.sendRequest(req.auth.userId, targetUserId)

  // Only reached once friendService has actually stored something — a
  // repeat send throws REQUEST_ALREADY_SENT/ALREADY_FRIENDS above and never
  // gets here, and the notification's own dedupeKey (the Friendship id)
  // covers anything that slips past that. autoAccepted means :userId had
  // already asked me, so this call accepted *their* request: they are the
  // one to tell, and my own pending notification about it is now handled.
  if (autoAccepted) {
    announceFriendshipChange(req.auth.userId, targetUserId)
    await notificationService.notifyFriendAccepted(friendship.id, req.auth.userId, targetUserId)
    await notificationService.markFriendRequestHandled(req.auth.userId, targetUserId)
  } else {
    await notificationService.notifyFriendRequest(friendship.id, req.auth.userId, targetUserId)
  }

  return res.status(201).json({ success: true, friendship, autoAccepted })
})

// PATCH /api/friends/requests/:userId/accept — accept a request :userId
// sent me. friendService itself re-checks that :userId is really the
// sender (not me), so this can't be used to accept my own outgoing request.
const acceptFriendRequest = withErrorHandling(async (req, res) => {
  const targetUserId = parseTargetUserId(req, res)
  if (targetUserId === null) return
  const friendship = await friendService.acceptRequest(req.auth.userId, targetUserId)
  announceFriendshipChange(req.auth.userId, targetUserId)
  await notificationService.notifyFriendAccepted(friendship.id, req.auth.userId, targetUserId)
  await notificationService.markFriendRequestHandled(req.auth.userId, targetUserId)
  return res.json({ success: true, friendship })
})

// PATCH /api/friends/requests/:userId/reject — decline a request :userId
// sent me. Deletes the row outright (see friendService) — :userId may send
// another request later.
const rejectFriendRequest = withErrorHandling(async (req, res) => {
  const targetUserId = parseTargetUserId(req, res)
  if (targetUserId === null) return
  await friendService.rejectRequest(req.auth.userId, targetUserId)
  // No notification goes to the sender for a rejection — only my own
  // notification about their request is settled.
  await notificationService.markFriendRequestHandled(req.auth.userId, targetUserId)
  return res.json({ success: true })
})

// DELETE /api/friends/requests/:userId — cancel a request I sent to
// :userId. Ownership (requestedById === me) is enforced in friendService.
const cancelFriendRequest = withErrorHandling(async (req, res) => {
  const targetUserId = parseTargetUserId(req, res)
  if (targetUserId === null) return
  await friendService.cancelRequest(req.auth.userId, targetUserId)
  return res.json({ success: true })
})

// DELETE /api/friends/:userId — unfriend :userId.
const removeFriend = withErrorHandling(async (req, res) => {
  const targetUserId = parseTargetUserId(req, res)
  if (targetUserId === null) return
  await friendService.removeFriend(req.auth.userId, targetUserId)
  announceFriendshipChange(req.auth.userId, targetUserId)
  return res.json({ success: true })
})

module.exports = {
  getFriends,
  getOnlineFriends,
  getReceivedRequests,
  getSentRequests,
  getRelationshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
}
