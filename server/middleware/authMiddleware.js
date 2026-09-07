const { verifyAccessToken } = require('../utils/token')

// Protects a route: requires a valid `Authorization: Bearer <token>` header
// and attaches the decoded payload ({ userId, username }) to req.auth.
// Never trusts a client-supplied user id from the body/query for identity.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Thiếu token xác thực.' })
  }

  try {
    req.auth = verifyAccessToken(token)
    return next()
  } catch (error) {
    const expired = error.name === 'TokenExpiredError'
    return res.status(401).json({
      success: false,
      code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      message: expired ? 'Phiên đăng nhập đã hết hạn.' : 'Token không hợp lệ.',
    })
  }
}

module.exports = { requireAuth }
