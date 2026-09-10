const { db } = require('../prisma/db')
const { toPublicUser } = require('./authController')
const { isValidUsername, isValidBio, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, BIO_MAX_LENGTH } = require('../utils/validate')
const { uploadAvatarBuffer } = require('../utils/cloudinary')

const User = db.orm.public.User

// Wraps a handler so an unexpected failure (DB unreachable, Cloudinary
// down, etc.) reaches the client as a generic message instead of a leaked
// stack trace — same shape as authController.js's withErrorHandling.
function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error('[user] unexpected error:', error.message)
      res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
      })
    }
  }
}

// GET /api/users/me — the current user's own full profile (stats, avatar,
// bio included). Identity comes from req.auth.userId (set by requireAuth
// from the verified JWT), never from anything the client claims.
const getMe = withErrorHandling(async (req, res) => {
  const user = await User.first({ id: req.auth.userId })
  if (!user) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Không tìm thấy người dùng.' })
  }
  return res.json({ success: true, user: toPublicUser(user) })
})

// PATCH /api/users/me — updates only username/bio. Every other User field
// (email, passwordHash, rating, wins/losses/draws, emailVerified, id) is
// simply never read from the request body — there is no code path here
// that could write them, regardless of what a client sends.
const updateMe = withErrorHandling(async (req, res) => {
  const body = req.body || {}
  const updates = {}

  if (body.username !== undefined) {
    if (!isValidUsername(body.username)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_USERNAME',
        message: `Tên người dùng phải từ ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} ký tự, chỉ gồm chữ cái, số và dấu gạch dưới.`,
      })
    }
    const trimmedUsername = body.username.trim()

    const existing = await User.first({ username: trimmedUsername })
    if (existing && existing.id !== req.auth.userId) {
      return res.status(409).json({ success: false, code: 'USERNAME_TAKEN', message: 'Tên đăng nhập đã được sử dụng.' })
    }
    updates.username = trimmedUsername
  }

  if (body.bio !== undefined) {
    if (!isValidBio(body.bio)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_BIO',
        message: `Tiểu sử tối đa ${BIO_MAX_LENGTH} ký tự.`,
      })
    }
    // Normalize an empty string to null rather than storing "" — same
    // "absent means absent" convention the nullable columns elsewhere use.
    updates.bio = body.bio === '' ? null : body.bio
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, code: 'NO_FIELDS', message: 'Không có thông tin nào để cập nhật.' })
  }

  let updated
  try {
    updated = await User.where({ id: req.auth.userId }).update(updates)
  } catch (error) {
    console.error('[user] update failed:', error.message)
    return res.status(409).json({ success: false, code: 'UPDATE_FAILED', message: 'Không thể cập nhật hồ sơ.' })
  }

  return res.json({ success: true, user: toPublicUser(updated) })
})

// POST /api/users/me/avatar — multipart upload (see middleware/uploadMiddleware.js
// for the multer config: memory storage, image-only, 5MB cap). The file
// buffer goes straight to Cloudinary, never to disk or Postgres — only the
// resulting URL is persisted.
const uploadAvatar = withErrorHandling(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, code: 'NO_FILE', message: 'Vui lòng chọn một ảnh.' })
  }

  let avatarUrl
  try {
    avatarUrl = await uploadAvatarBuffer(req.file.buffer, req.auth.userId)
  } catch (error) {
    console.error('[user] avatar upload failed:', error.message)
    return res.status(502).json({ success: false, code: 'UPLOAD_FAILED', message: 'Không thể tải ảnh lên. Vui lòng thử lại sau.' })
  }

  const updated = await User.where({ id: req.auth.userId }).update({ avatarUrl })
  return res.json({ success: true, user: toPublicUser(updated) })
})

module.exports = { getMe, updateMe, uploadAvatar }
