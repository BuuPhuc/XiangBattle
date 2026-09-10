const express = require('express')
const { requireAuth } = require('../middleware/authMiddleware')
const { getGameById } = require('../controllers/gameController')

const router = express.Router()

router.get('/:id', requireAuth, getGameById)

module.exports = router
