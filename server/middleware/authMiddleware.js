const { authenticateToken, SESSION_ERROR } = require('../services/sessionService')

function bearerToken(req) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  return scheme === 'Bearer' && token ? token : null
}

// Protects a route: requires a valid `Authorization: Bearer <token>` header
// — signed by us, unexpired and not revoked (sessionService.js) — and
// attaches the decoded payload ({ userId, username, tv }) to req.auth.
// Never trusts a client-supplied user id from the body/query for identity.
//
// 401 codes: UNAUTHORIZED (no token), TOKEN_EXPIRED, INVALID_TOKEN,
// TOKEN_REVOKED. If the revocation check itself can't reach the database
// the answer is a 503 — never a 401, which would sign the client out over
// an outage.
async function requireAuth(req, res, next) {
  const token = bearerToken(req)
  if (!token) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Thiếu token xác thực.' })
  }

  let result
  try {
    result = await authenticateToken(token)
  } catch (error) {
    console.error('[auth] session check failed:', error.message)
    return res.status(503).json({
      success: false,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
    })
  }

  if (result.code) {
    return res.status(401).json({ success: false, ...SESSION_ERROR[result.code] })
  }
  req.auth = result.payload
  return next()
}

// For routes anyone may call (e.g. the leaderboard): a valid Bearer token
// attaches req.auth exactly like requireAuth does, so the handler can add
// the caller's own data; no token — or a missing / invalid / expired /
// revoked one, or a failed check — just means "a guest" (req.auth stays
// unset) instead of a 401. Handlers behind this must work without req.auth
// and never trust anything else for identity.
async function optionalAuth(req, res, next) {
  const token = bearerToken(req)
  if (token) {
    try {
      const result = await authenticateToken(token)
      req.auth = result.payload
    } catch {
      req.auth = undefined
    }
  }
  return next()
}

module.exports = { requireAuth, optionalAuth }
