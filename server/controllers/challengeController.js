const challengeService = require('../services/challengeService')
const notificationService = require('../services/notificationService')

// Same split as friendController.js: challengeService throws a typed
// `{ code, message }` error, this decides the HTTP status.
const ERROR_STATUS = {
  SELF_CHALLENGE: 400,
  USER_NOT_FOUND: 404,
  CHALLENGE_NOT_FOUND: 404,
  CHALLENGE_NOT_ALLOWED: 403,
  CHALLENGE_FORBIDDEN: 403,
  CHALLENGE_ALREADY_SENT: 409,
  CHALLENGE_INCOMING_PENDING: 409,
  CHALLENGE_NOT_PENDING: 409,
  CHALLENGE_EXPIRED: 409,
}

function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      if (error.code && ERROR_STATUS[error.code]) {
        return res.status(ERROR_STATUS[error.code]).json({
          success: false,
          code: error.code,
          message: error.message,
          ...(error.challengeId ? { challengeId: error.challengeId } : {}),
          ...(error.status ? { status: error.status } : {}),
        })
      }
      console.error('[challenges] unexpected error:', error.message)
      res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
      })
    }
  }
}

function parseId(raw) {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

function parseChallengeId(req, res) {
  const challengeId = parseId(req.params.challengeId)
  if (challengeId === null) {
    res.status(400).json({ success: false, code: 'INVALID_CHALLENGE_ID', message: 'Mã lời mời thách đấu không hợp lệ.' })
  }
  return challengeId
}

function toPublic(challenge) {
  return {
    id: challenge.id,
    senderId: challenge.senderId,
    receiverId: challenge.receiverId,
    status: challenge.status,
    createdAt: challenge.createdAt,
    expiresAt: challenge.expiresAt,
  }
}

// GET /api/challenges/pending — the caller's open challenges, sent and
// received. Drives how the Thách đấu button draws itself.
const getPendingChallenges = withErrorHandling(async (req, res) => {
  const pending = await challengeService.listPendingForUser(req.auth.userId)
  return res.json({ success: true, ...pending })
})

// POST /api/challenges { receiverId } — challenge receiverId. The sender is
// always the verified JWT's user: a senderId in the body is never read, so
// there is nothing a client could send to challenge on someone else's behalf.
const sendChallenge = withErrorHandling(async (req, res) => {
  const receiverId = parseId(req.body && req.body.receiverId)
  if (receiverId === null) {
    return res.status(400).json({ success: false, code: 'INVALID_USER_ID', message: 'Mã người dùng không hợp lệ.' })
  }

  const challenge = await challengeService.sendChallenge(req.auth.userId, receiverId)

  // Only reached once a new PENDING row exists — a duplicate send threw
  // above and announces nothing. Stored first, pushed second: a receiver who
  // is offline finds the notification waiting when they next log in.
  await notificationService.notifyChallenge(challenge.id, challenge.senderId, challenge.receiverId)
  notificationService.announceChallengeUpdate(challenge)

  return res.status(201).json({ success: true, challenge: toPublic(challenge) })
})

// PATCH /api/challenges/:challengeId/reject — the receiver declines. No
// room, game or rating is involved, and the sender is not sent a
// notification — their button simply becomes available again.
const rejectChallenge = withErrorHandling(async (req, res) => {
  const challengeId = parseChallengeId(req, res)
  if (challengeId === null) return
  const challenge = await challengeService.rejectChallenge(req.auth.userId, challengeId)
  await notificationService.markChallengeHandled(req.auth.userId, challengeId)
  notificationService.announceChallengeUpdate(challenge)
  return res.json({ success: true, challenge: toPublic(challenge) })
})

// DELETE /api/challenges/:challengeId — the sender withdraws a challenge
// that has not been answered yet. The receiver's notification stays as
// history; accepting it afterwards is refused by challengeService.
const cancelChallenge = withErrorHandling(async (req, res) => {
  const challengeId = parseChallengeId(req, res)
  if (challengeId === null) return
  const challenge = await challengeService.cancelChallenge(req.auth.userId, challengeId)
  notificationService.announceChallengeUpdate(challenge)
  return res.json({ success: true, challenge: toPublic(challenge) })
})

module.exports = { getPendingChallenges, sendChallenge, rejectChallenge, cancelChallenge }
