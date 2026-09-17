const express = require('express')
const { requireAuth } = require('../middleware/authMiddleware')
const { getLeaderboard } = require('../controllers/leaderboardController')

const router = express.Router()

router.get('/', requireAuth, getLeaderboard)

module.exports = router
