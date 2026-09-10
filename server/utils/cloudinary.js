const { v2: cloudinary } = require('cloudinary')

const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
)

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

// Uploads an in-memory image buffer (from multer's memory storage — the
// file never touches disk) to Cloudinary and resolves with the resulting
// secure (https) URL. Avatars live in their own folder, keyed by user id,
// so re-uploading always overwrites the same asset instead of accumulating
// orphaned images per user.
function uploadAvatarBuffer(buffer, userId) {
  if (!isConfigured) {
    return Promise.reject(
      new Error('Cloudinary chưa được cấu hình. Vui lòng thêm CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET vào server/.env.')
    )
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'xiangbattle/avatars',
        public_id: `user_${userId}`,
        overwrite: true,
        resource_type: 'image',
        // Keeps stored avatars from ballooning arbitrarily large — the
        // displayed size is much smaller than this, but this caps what
        // gets stored/served for a badly-cropped source image.
        transformation: [{ width: 512, height: 512, crop: 'limit' }],
      },
      (error, result) => {
        if (error) return reject(error)
        resolve(result.secure_url)
      }
    )
    uploadStream.end(buffer)
  })
}

module.exports = { cloudinary, isCloudinaryConfigured: isConfigured, uploadAvatarBuffer }
