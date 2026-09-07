const express = require('express')
const rateLimit = require('express-rate-limit')
const { register, login, verifyEmail, resendVerification, me } = require('../controllers/authController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

// Generic brute-force / spam guard on the endpoints that touch a password
// or send an email. Keyed by IP — coarse, but enough for this stage; the
// resend endpoint also has a per-account cooldown in the controller.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
})

router.post('/register', authRateLimit, register)
router.post('/login', authRateLimit, login)
router.get('/verify-email', verifyEmail)
router.post('/resend-verification', authRateLimit, resendVerification)
router.get('/me', requireAuth, me)

module.exports = router
