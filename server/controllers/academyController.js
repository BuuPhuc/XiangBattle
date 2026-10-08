const academyService = require('../services/academyService')

// Same split as friendController.js: the service throws a typed
// `{ code, message }` error, this is the one place that maps it to a status.
const ERROR_STATUS = {
  COURSE_NOT_FOUND: 404,
  CHALLENGE_NOT_FOUND: 404,
  INCORRECT_SOLUTION: 422,
}

// Catalog ids are short lowercase slugs ("pieces", "rook-1"). Anything else
// is rejected before it reaches the catalog lookup or the database.
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

// No challenge comes close to this many moves — a cap on how much of an
// untrusted body is ever looked at.
const MAX_SOLUTION_MOVES = 20

function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      if (error.code && ERROR_STATUS[error.code]) {
        return res.status(ERROR_STATUS[error.code]).json({ success: false, code: error.code, message: error.message })
      }
      console.error('[academy] unexpected error:', error.message)
      res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
      })
    }
  }
}

// GET /api/academy/progress — every challenge the caller has completed.
// Whose progress is always req.auth.userId (the verified JWT); there is no
// user id anywhere in the path, query or body to read someone else's.
const getProgress = withErrorHandling(async (req, res) => {
  const completedChallengeIds = await academyService.listCompletedChallengeIds(req.auth.userId)
  return res.json({ success: true, completedChallengeIds })
})

// POST /api/academy/courses/:courseId/challenges/:challengeId/complete
// Body: { moves: [{ from: [col, row], to: [col, row] }, ...] } — the moves
// the caller played. The body carries no "completed" flag and no user id:
// the service replays the moves against the challenge and only then stores
// the row, for the JWT's user.
const completeChallenge = withErrorHandling(async (req, res) => {
  const { courseId, challengeId } = req.params
  if (!ID_PATTERN.test(courseId)) {
    return res.status(400).json({ success: false, code: 'INVALID_COURSE_ID', message: 'Mã khóa học không hợp lệ.' })
  }
  if (!ID_PATTERN.test(challengeId)) {
    return res.status(400).json({ success: false, code: 'INVALID_CHALLENGE_ID', message: 'Mã thử thách không hợp lệ.' })
  }

  const moves = req.body && req.body.moves
  if (!Array.isArray(moves) || moves.length === 0 || moves.length > MAX_SOLUTION_MOVES) {
    return res.status(400).json({ success: false, code: 'INVALID_SOLUTION', message: 'Lời giải không hợp lệ.' })
  }

  const { alreadyCompleted } = await academyService.completeChallenge(req.auth.userId, courseId, challengeId, moves)
  return res.status(alreadyCompleted ? 200 : 201).json({ success: true, challengeId, alreadyCompleted })
})

module.exports = { getProgress, completeChallenge }
