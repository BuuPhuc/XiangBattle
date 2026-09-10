const multer = require('multer')

const MAX_AVATAR_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// Memory storage — the file lives only as a Buffer on req.file.buffer for
// the lifetime of the request, then goes straight to Cloudinary
// (utils/cloudinary.js). Never written to disk, never touches Postgres.
const storage = multer.memoryStorage()

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'avatar'))
    return
  }
  cb(null, true)
}

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
})

module.exports = { uploadAvatar, MAX_AVATAR_BYTES, ALLOWED_MIME_TYPES }
