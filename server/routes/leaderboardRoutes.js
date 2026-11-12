const express = require('express')
const { optionalAuth } = require('../middleware/authMiddleware')
const { getLeaderboard } = require('../controllers/leaderboardController')

const router = express.Router()

// Public: guests see the rankings too. A signed-in caller additionally gets
// their own rank (`currentUser`), which the controller only adds when
// req.auth is set.
router.get('/', optionalAuth, getLeaderboard)

module.exports = router
