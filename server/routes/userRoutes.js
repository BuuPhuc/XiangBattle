const express = require('express')
const multer = require('multer')
const { requireAuth } = require('../middleware/authMiddleware')
const { uploadAvatar: uploadAvatarMiddleware, MAX_AVATAR_BYTES } = require('../middleware/uploadMiddleware')
const {
  getMe,
  updateMe,
  uploadAvatar,
  getMySettings,
  updateMySettings,
  getPublicProfile,
  getUserGames,
  searchUsers,
} = require('../controllers/userController')

const router = express.Router()

// multer's own middleware calls next(err) on a bad upload (wrong file type,
// too large, ...) — without catching that here it would fall through to
// Express's default error handler and leak a raw stack-trace page instead
// of the app's usual { success:false, code, message } envelope.
function parseAvatarUpload(req, res, next) {
  uploadAvatarMiddleware.single('avatar')(req, res, (err) => {
    if (!err) return next()
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          code: 'FILE_TOO_LARGE',
          message: `Ảnh vượt quá dung lượng cho phép (tối đa ${Math.round(MAX_AVATAR_BYTES / (1024 * 1024))}MB).`,
        })
      }
      return res.status(400).json({ success: false, code: 'INVALID_FILE', message: 'Vui lòng chọn một tệp ảnh hợp lệ (JPEG, PNG, WEBP hoặc GIF).' })
    }
    console.error('[user] avatar parse error:', err.message)
    return res.status(400).json({ success: false, code: 'UPLOAD_FAILED', message: 'Không thể xử lý ảnh đã chọn.' })
  })
}

router.get('/me', requireAuth, getMe)
router.patch('/me', requireAuth, updateMe)
router.post('/me/avatar', requireAuth, parseAvatarUpload, uploadAvatar)
router.get('/me/settings', requireAuth, getMySettings)
router.patch('/me/settings', requireAuth, updateMySettings)
router.get('/search', requireAuth, searchUsers)

// Must stay registered after the /me and /search routes above — Express
// matches route patterns in registration order, so a literal path always
// wins over this param route for its own path; registered any earlier it
// would swallow those requests as userId="me" / userId="search" instead.
router.get('/:userId', requireAuth, getPublicProfile)
router.get('/:userId/games', requireAuth, getUserGames)

module.exports = router
