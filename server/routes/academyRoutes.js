const express = require('express')
const { requireAuth } = require('../middleware/authMiddleware')
const { getProgress, completeChallenge } = require('../controllers/academyController')

const router = express.Router()

// Only progress lives on the server. The catalog itself is static data
// bundled with the client (src/features/academy), so guests can browse and
// play every challenge without calling anything here.
router.get('/progress', requireAuth, getProgress)
router.post('/courses/:courseId/challenges/:challengeId/complete', requireAuth, completeChallenge)

module.exports = router
