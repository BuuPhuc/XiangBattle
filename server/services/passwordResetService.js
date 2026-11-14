const { createOneTimeToken, hashVerificationToken } = require('../utils/token')
const { hashPassword } = require('../utils/password')
const sessionService = require('./sessionService')

// "Quên mật khẩu" / "Đặt lại mật khẩu".
//
// Request (POST /auth/forgot-password): the controller answers every valid
// email the same way, at once, and this runs afterwards in the background
// (startPasswordResetRequest) — so neither the reply nor its timing tells
// whether the email has an account, is in its cooldown, or the mail failed.
// A new request invalidates every earlier unused link of that account;
// within the cooldown nothing is sent at all.
//
// Reset (POST /auth/reset-password): ONE transaction consumes the token
// (a conditional UPDATE … WHERE consumedAt IS NULL, so a token can only ever
// win once), sets the new password, marks the email verified (opening the
// link proves the user reads that inbox), raises tokenVersion — every JWT
// issued so far stops working — and invalidates the account's other reset
// links and pending email-verification links. Either all of that commits or
// none of it does: never a changed password with the old sessions alive.
// Only after the commit are the account's open sockets told and
// disconnected (sessionService.endOpenSessions).
//
// Tokens: 32 random bytes, only their SHA-256 is stored, single use,
// PASSWORD_RESET_EXPIRES_MINUTES (30) to live. Never logged, never returned.

const RESET_EXPIRES_MINUTES = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 30)
const RESET_COOLDOWN_SECONDS = Number(process.env.PASSWORD_RESET_COOLDOWN_SECONDS || 60)

const RESET_ERROR = {
  RESET_TOKEN_INVALID: {
    code: 'RESET_TOKEN_INVALID',
    message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng.',
  },
  RESET_TOKEN_EXPIRED: {
    code: 'RESET_TOKEN_EXPIRED',
    message: 'Liên kết đặt lại mật khẩu đã hết hạn.',
  },
}

// --- Storage ----------------------------------------------------------------
// The database by default; tests swap in an in-memory store with the same
// shape (tests/helpers/passwordResetTestStore.js). `db` is required lazily so
// tests never open a database connection.
//
//   findUserByEmail(email)          → { id, username, email } | null
//   latestResetRequestAt(userId)    → when the newest reset link was made, or null
//   transaction(fn)                 → runs fn(repo) atomically, returns its result
// repo (only ever inside a transaction):
//   invalidateOpenResetTokens(userId, now)
//   createResetToken({ userId, tokenHash, expiresAt })
//   findResetToken(tokenHash)       → { id, userId, expiresAt, consumedAt } | null
//   consumeResetToken(id, now)      → true only for the one call that consumed it
//   setPasswordAndBumpTokenVersion(userId, passwordHash) → false if no such user
//   invalidateOpenVerificationTokens(userId, now)

function databaseRepo(tx) {
  const ResetToken = tx.orm.public.PasswordResetToken
  const User = tx.orm.public.User
  const openTokensOf = (table, userId) =>
    table.where((f, fns) => fns.and(fns.eq(f.userId, userId), fns.eq(f.consumedAt, null)))

  return {
    async invalidateOpenResetTokens(userId, now) {
      await tx.execute(openTokensOf(tx.sql.public.passwordResetToken.update({ consumedAt: now }), userId).build())
    },
    createResetToken: (data) => ResetToken.create(data),
    findResetToken: (tokenHash) => ResetToken.select('id', 'userId', 'expiresAt', 'consumedAt').first({ tokenHash }),
    // One statement: whoever's UPDATE matches the still-unconsumed row wins;
    // a second concurrent reset with the same token matches nothing.
    async consumeResetToken(id, now) {
      const plan = tx.sql.public.passwordResetToken
        .update({ consumedAt: now })
        .where((f, fns) => fns.and(fns.eq(f.id, id), fns.eq(f.consumedAt, null)))
        .build()
      const result = await tx.execute(plan)
      return result.affectedRows === 1
    },
    // Read-then-write inside this transaction, like sessionService's own
    // bump: racing a concurrent logout-all can at worst raise it by one
    // instead of two, which still refuses every token issued before.
    async setPasswordAndBumpTokenVersion(userId, passwordHash) {
      const user = await User.select('id', 'tokenVersion').first({ id: userId })
      if (!user) return false
      await User.where({ id: userId }).update({
        passwordHash,
        emailVerified: true,
        tokenVersion: (user.tokenVersion || 0) + 1,
      })
      return true
    },
    async invalidateOpenVerificationTokens(userId, now) {
      await tx.execute(openTokensOf(tx.sql.public.emailVerificationToken.update({ consumedAt: now }), userId).build())
    },
  }
}

const databaseStore = {
  async findUserByEmail(email) {
    const { db } = require('../prisma/db')
    return db.orm.public.User.select('id', 'username', 'email').first({ email })
  },
  async latestResetRequestAt(userId) {
    const { db } = require('../prisma/db')
    const latest = await db.orm.public.PasswordResetToken.select('createdAt')
      .where({ userId })
      .orderBy((t) => t.createdAt.desc())
      .first()
    return latest ? latest.createdAt : null
  },
  transaction(fn) {
    const { db } = require('../prisma/db')
    return db.transaction((tx) => fn(databaseRepo(tx)))
  },
}

let store = databaseStore
let mailer = null // lazily ../utils/mailer — tests always inject a stub

function setPasswordResetStore(next) {
  store = next || databaseStore
}
function setPasswordResetMailer(next) {
  mailer = next
}
function getMailer() {
  return mailer || require('../utils/mailer')
}

// --- Request ------------------------------------------------------------------

// Resolves to what happened ('no-account' | 'cooldown' | 'sent'); rejects
// on a database or mail failure. Callers go through
// startPasswordResetRequest, which never rejects.
async function requestPasswordReset(email) {
  const user = await store.findUserByEmail(email)
  if (!user) return 'no-account'

  const latest = await store.latestResetRequestAt(user.id)
  if (latest && Date.now() - new Date(latest).getTime() < RESET_COOLDOWN_SECONDS * 1000) return 'cooldown'

  const { rawToken, tokenHash, expiresAt } = createOneTimeToken(RESET_EXPIRES_MINUTES)
  const now = new Date()
  await store.transaction(async (repo) => {
    await repo.invalidateOpenResetTokens(user.id, now)
    await repo.createResetToken({ userId: user.id, tokenHash, expiresAt })
  })
  await getMailer().sendPasswordResetEmail({
    to: user.email,
    username: user.username,
    rawToken,
    expiresInMinutes: RESET_EXPIRES_MINUTES,
  })
  return 'sent'
}

// Background requests still running — see whenIdle().
const pending = new Set()
// email -> the newest request queued for it. Requests for one email run one
// after another, so the cooldown check of a request always sees the link
// the previous one created — several clicks at the same moment can't each
// pass the check and send an email apiece.
const queues = new Map()

// Starts a request in the background and returns its promise, which never
// rejects: any failure (database, mail, even a synchronous throw) is caught
// and logged by message only, so it can neither crash the server as an
// unhandled rejection nor leak a token into the log.
function startPasswordResetRequest(email) {
  const previous = queues.get(email) || Promise.resolve()
  const task = previous
    .then(() => requestPasswordReset(email))
    .catch((error) => {
      console.error('[password-reset] request failed:', error && error.message ? error.message : String(error))
      return 'failed'
    })
    .finally(() => {
      pending.delete(task)
      if (queues.get(email) === task) queues.delete(email)
    })
  queues.set(email, task)
  pending.add(task)
  return task
}

// Resolves once every background request started so far has finished —
// what tests await instead of sleeping.
async function whenIdle() {
  while (pending.size > 0) await Promise.all([...pending])
}

// --- Reset ----------------------------------------------------------------------

function tokenProblem(token, now) {
  if (!token || token.consumedAt) return 'RESET_TOKEN_INVALID'
  if (new Date(token.expiresAt).getTime() <= now.getTime()) return 'RESET_TOKEN_EXPIRED'
  return null
}

// Everything a successful reset changes, as one unit of work on `repo` —
// run inside store.transaction, so a failure at any step leaves the
// password, tokenVersion and every token exactly as they were.
async function completeReset(repo, { tokenHash, passwordHash, now }) {
  const token = await repo.findResetToken(tokenHash)
  const problem = tokenProblem(token, now)
  if (problem) return { error: problem }
  if (!(await repo.consumeResetToken(token.id, now))) return { error: 'RESET_TOKEN_INVALID' }
  if (!(await repo.setPasswordAndBumpTokenVersion(token.userId, passwordHash))) return { error: 'RESET_TOKEN_INVALID' }
  await repo.invalidateOpenResetTokens(token.userId, now)
  await repo.invalidateOpenVerificationTokens(token.userId, now)
  return { userId: token.userId }
}

// Resolves to { userId } on success or { error: RESET_TOKEN_INVALID |
// RESET_TOKEN_EXPIRED }; rejects only on an unexpected (database) failure,
// in which case nothing was changed.
async function resetPassword(rawToken, newPassword) {
  const tokenHash = hashVerificationToken(rawToken)
  const now = new Date()

  // Cheap pre-check, so a wrong or stale link never costs a bcrypt hash.
  // The transaction below re-checks: it is the one that decides.
  const precheck = await store.transaction((repo) => repo.findResetToken(tokenHash))
  const problem = tokenProblem(precheck, now)
  if (problem) return { error: problem }

  const passwordHash = await hashPassword(newPassword)
  const result = await store.transaction((repo) => completeReset(repo, { tokenHash, passwordHash, now }))
  if (result.error) return result

  sessionService.endOpenSessions(result.userId)
  console.log(`[auth] password reset for user ${result.userId}; all sessions revoked`)
  return result
}

module.exports = {
  startPasswordResetRequest,
  whenIdle,
  resetPassword,
  setPasswordResetStore,
  setPasswordResetMailer,
  RESET_ERROR,
  RESET_EXPIRES_MINUTES,
  RESET_COOLDOWN_SECONDS,
}
