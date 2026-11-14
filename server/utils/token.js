const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const EMAIL_VERIFICATION_TOKEN_BYTES = 32
const EMAIL_VERIFICATION_EXPIRES_MINUTES = Number(process.env.EMAIL_VERIFICATION_EXPIRES_MINUTES || 60)

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Add it to server/.env before starting the server.')
}

// The raw token is the only copy that ever leaves the server (mailed to the
// user); only its SHA-256 digest is persisted, so a leaked database dump
// never yields a usable verification link on its own.
function hashVerificationToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

function createVerificationToken() {
  const rawToken = crypto.randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString('hex')
  const tokenHash = hashVerificationToken(rawToken)
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRES_MINUTES * 60 * 1000)
  return { rawToken, tokenHash, expiresAt }
}

// `tv` is the account's tokenVersion at signing time — what lets
// sessionService.revokeAllSessions invalidate every token issued so far.
// Otherwise still a plain 7-day token counted from login.
function signAccessToken(user) {
  return jwt.sign({ userId: user.id, username: user.username, tv: user.tokenVersion || 0 }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  })
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

module.exports = {
  hashVerificationToken,
  createVerificationToken,
  signAccessToken,
  verifyAccessToken,
  EMAIL_VERIFICATION_EXPIRES_MINUTES,
}
