const { verifyAccessToken } = require('../utils/token')

// Session revocation. A JWT stays a self-contained 7-day token, but it also
// carries the account's `tokenVersion` at signing time (claim `tv`, see
// utils/token.js). A token is only accepted while that number still equals
// the account's current one, so bumping it (revokeAllSessions) invalidates
// every JWT issued for the account so far, on every device, at once.
//
// A token signed before this existed has no `tv` and counts as version 0 —
// the column's default — so nobody was logged out by the rollout, and the
// first revoke invalidates those tokens like any other.

// Where token versions are read from / bumped. The database by default; the
// server tests swap in an in-memory store (tests/helpers/fakeTokenVersionStore.js,
// only ever preloaded by the test runner — server.js never loads it) so they
// need no real accounts. The check itself (authenticateToken) is the same
// code either way. `db` is required lazily so unit tests of the middleware
// never open a database connection.
const databaseStore = {
  // The account's current version, or null when the account doesn't exist.
  async getTokenVersion(userId) {
    const { db } = require('../prisma/db')
    const user = await db.orm.public.User.select('id', 'tokenVersion').first({ id: userId })
    return user ? user.tokenVersion : null
  },

  // Raises the version by one and returns the new value (null: no account).
  // Read-then-write inside a transaction: two revokes racing can at worst
  // raise it by one instead of two, which still invalidates every token
  // signed before either of them — "strictly newer than any issued token"
  // is all that matters, not the exact count.
  async bumpTokenVersion(userId) {
    const { db } = require('../prisma/db')
    return db.transaction(async (tx) => {
      const User = tx.orm.public.User
      const user = await User.select('id', 'tokenVersion').first({ id: userId })
      if (!user) return null
      const next = (user.tokenVersion || 0) + 1
      await User.where({ id: userId }).update({ tokenVersion: next })
      return next
    })
  },
}

let store = databaseStore

function setTokenVersionStore(next) {
  store = next || databaseStore
}

let io = null
function attachIo(instance) {
  io = instance
}

// Error codes a client should treat as "this session is over — sign out":
// the only three authenticateToken can produce.
const SESSION_ERROR = {
  TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn.' },
  INVALID_TOKEN: { code: 'INVALID_TOKEN', message: 'Token không hợp lệ.' },
  TOKEN_REVOKED: { code: 'TOKEN_REVOKED', message: 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.' },
}

// The one check every entry point uses (requireAuth, optionalAuth, the
// socket handshake). Resolves to { payload } for a token that is signed by
// us, unexpired and not revoked, or { code } (one of SESSION_ERROR) when it
// isn't. A database failure is NOT turned into a code — it rejects, so each
// caller can answer "try again later" instead of signing the user out.
async function authenticateToken(token) {
  let payload
  try {
    payload = verifyAccessToken(token)
  } catch (error) {
    return { code: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' }
  }
  if (!Number.isInteger(payload.userId)) return { code: 'INVALID_TOKEN' }

  const tokenVersion = payload.tv === undefined ? 0 : payload.tv
  if (!Number.isInteger(tokenVersion)) return { code: 'INVALID_TOKEN' }

  const current = await store.getTokenVersion(payload.userId)
  if (current === null || current === undefined) return { code: 'INVALID_TOKEN' } // account is gone
  if (tokenVersion !== current) return { code: 'TOKEN_REVOKED' }

  return { payload }
}

// Signs the account out everywhere, immediately: every JWT issued so far
// stops working on its next use, and every socket currently open for the
// account is told (session_ended, code TOKEN_REVOKED) and then disconnected — which, mid-
// match, starts the usual reconnect grace period (reconnectHandler.js). The
// one shared entry point for "end all sessions" (Đăng xuất khỏi tất cả
// thiết bị today; a password reset later). Returns false when there is no
// such account.
async function revokeAllSessions(userId) {
  const next = await store.bumpTokenVersion(userId)
  if (next === null || next === undefined) return false

  if (io) {
    const room = `user:${userId}` // presenceService.userRoom — every authenticated socket joins it
    io.to(room).emit('session_ended', { code: 'TOKEN_REVOKED' })
    io.in(room).disconnectSockets(true)
  }
  console.log(`[auth] all sessions revoked for user ${userId}`)
  return true
}

module.exports = {
  authenticateToken,
  revokeAllSessions,
  attachIo,
  setTokenVersionStore,
  SESSION_ERROR,
}
