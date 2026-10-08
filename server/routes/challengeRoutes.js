const express = require('express')
const { requireAuth } = require('../middleware/authMiddleware')
const {
  getPendingChallenges,
  sendChallenge,
  rejectChallenge,
  cancelChallenge,
} = require('../controllers/challengeController')

const router = express.Router()

// Accepting a challenge is not here on purpose — it seats the accepter's
// socket in a room, so it is the `accept_challenge` socket event (see
// sockets/challengeHandler.js).
router.get('/pending', requireAuth, getPendingChallenges)
router.post('/', requireAuth, sendChallenge)
router.patch('/:challengeId/reject', requireAuth, rejectChallenge)
router.delete('/:challengeId', requireAuth, cancelChallenge)

module.exports = router
