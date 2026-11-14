// An in-memory stand-in for passwordResetService's database store (same
// shape), for tests that need no database. Its transaction() really is
// all-or-nothing: the callback works on a copy of the data, which replaces
// the real data only if the callback returns; if it throws, every change is
// thrown away — like a rolled-back database transaction.
//
// `failAt` makes one repo step throw (e.g. 'invalidateOpenResetTokens'), to
// prove what a failure half-way through a reset leaves behind. `failing`
// makes every call throw (an unreachable database).
//
// It also acts as sessionService's token-version store (tokenVersionStore),
// so a JWT signed before a reset is refused afterwards.
const { hashPasswordSync } = require('./passwordUtils')

function clone(state) {
  return {
    users: state.users.map((u) => ({ ...u })),
    resetTokens: state.resetTokens.map((t) => ({ ...t })),
    verificationTokens: state.verificationTokens.map((t) => ({ ...t })),
    nextId: state.nextId,
  }
}

function createPasswordResetTestStore({ users = [], verificationTokens = [] } = {}) {
  let state = {
    users: users.map((u) => ({
      emailVerified: true,
      tokenVersion: 0,
      passwordHash: u.password ? hashPasswordSync(u.password) : null,
      ...u,
    })),
    resetTokens: [],
    verificationTokens: verificationTokens.map((t, i) => ({ id: i + 1, consumedAt: null, ...t })),
    nextId: 1,
  }
  const control = { failAt: null, failing: false }
  let lock = Promise.resolve()
  const check = (step) => {
    if (control.failing) throw new Error('database unreachable')
    if (control.failAt === step) throw new Error(`injected failure at ${step}`)
  }

  function repoOn(s) {
    const openOf = (list, userId) => list.filter((t) => t.userId === userId && t.consumedAt === null)
    return {
      async invalidateOpenResetTokens(userId, now) {
        check('invalidateOpenResetTokens')
        openOf(s.resetTokens, userId).forEach((t) => {
          t.consumedAt = now
        })
      },
      async createResetToken({ userId, tokenHash, expiresAt }) {
        check('createResetToken')
        const row = { id: s.nextId++, userId, tokenHash, expiresAt, consumedAt: null, createdAt: new Date() }
        s.resetTokens.push(row)
        return { ...row }
      },
      async findResetToken(tokenHash) {
        check('findResetToken')
        const row = s.resetTokens.find((t) => t.tokenHash === tokenHash)
        return row ? { ...row } : null
      },
      async consumeResetToken(id, now) {
        check('consumeResetToken')
        const row = s.resetTokens.find((t) => t.id === id && t.consumedAt === null)
        if (!row) return false
        row.consumedAt = now
        return true
      },
      async setPasswordAndBumpTokenVersion(userId, passwordHash) {
        check('setPasswordAndBumpTokenVersion')
        const user = s.users.find((u) => u.id === userId)
        if (!user) return false
        user.passwordHash = passwordHash
        user.emailVerified = true
        user.tokenVersion += 1
        return true
      },
      async invalidateOpenVerificationTokens(userId, now) {
        check('invalidateOpenVerificationTokens')
        openOf(s.verificationTokens, userId).forEach((t) => {
          t.consumedAt = now
        })
      },
    }
  }

  const store = {
    control,
    // Read-only views of the committed data.
    user: (id) => ({ ...state.users.find((u) => u.id === id) }),
    resetTokens: (userId) => state.resetTokens.filter((t) => t.userId === userId).map((t) => ({ ...t })),
    verificationTokens: (userId) => state.verificationTokens.filter((t) => t.userId === userId).map((t) => ({ ...t })),
    // Test setup: change a committed row directly (e.g. make a link expire).
    patchResetToken(id, patch) {
      Object.assign(
        state.resetTokens.find((t) => t.id === id),
        patch
      )
    },

    async findUserByEmail(email) {
      check('findUserByEmail')
      const user = state.users.find((u) => u.email === email)
      return user ? { id: user.id, username: user.username, email: user.email } : null
    },
    async latestResetRequestAt(userId) {
      check('latestResetRequestAt')
      const mine = state.resetTokens.filter((t) => t.userId === userId)
      return mine.length ? mine.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).createdAt : null
    },
    // Transactions run one at a time (like the row lock a conditional UPDATE
    // takes), so two resets racing on one token see each other's commit.
    transaction(fn) {
      const run = lock.then(async () => {
        const draft = clone(state)
        const result = await fn(repoOn(draft))
        state = draft // only reached when fn did not throw
        return result
      })
      lock = run.catch(() => {})
      return run
    },

    // sessionService's store shape.
    tokenVersionStore: {
      async getTokenVersion(userId) {
        const user = state.users.find((u) => u.id === userId)
        return user ? user.tokenVersion : null
      },
      async bumpTokenVersion(userId) {
        const user = state.users.find((u) => u.id === userId)
        if (!user) return null
        user.tokenVersion += 1
        return user.tokenVersion
      },
    },
  }
  return store
}

module.exports = { createPasswordResetTestStore }
