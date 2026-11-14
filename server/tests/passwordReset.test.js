// "Quên mật khẩu" / "Đặt lại mật khẩu", in-process and without a database:
// the real controllers, passwordResetService and sessionService, on the
// in-memory store in helpers/passwordResetTestStore.js (whose transactions
// are all-or-nothing) and a stub mailer that records what would be sent.
//
// Covers: forgot-password gives every email the same status and body, at
// once, before any work or mail; the background work never rejects (mail
// failure, database failure, a synchronous throw) and is awaited with
// whenIdle(), never a sleep; the cooldown; a new request invalidates older
// links; wrong / expired / used tokens are refused with RESET_TOKEN_* 400s;
// a successful reset changes the password (the new one passes the same
// check login uses, the old one fails), consumes the token, invalidates the
// other links and pending email verifications, marks the email verified,
// raises tokenVersion (an earlier JWT is TOKEN_REVOKED) and only then
// disconnects the account's sockets; a failure inside the transaction
// changes nothing — not the password, not tokenVersion; one token cannot win
// twice; tokens never reach a log or a response; the mailer's link and log.
process.env.JWT_SECRET ||= 'test-secret-for-password-reset'
const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const passwordResetService = require('../services/passwordResetService')
const sessionService = require('../services/sessionService')
const { forgotPassword, resetPassword: resetPasswordHandler, FORGOT_PASSWORD_RESPONSE } = require('../controllers/authController')
const { comparePassword } = require('../utils/password')
const { signAccessToken } = require('../utils/token')
const { buildPasswordResetUrl, unsentPasswordResetLog } = require('../utils/mailer')
const { createPasswordResetTestStore } = require('./helpers/passwordResetTestStore')
const { fakeRes } = require('./helpers/authTestUtils')

const OLD_PASSWORD = 'old-password-1'
const NEW_PASSWORD = 'new-password-2'
const ALICE = { id: 7, username: 'alice', email: 'alice@example.com', password: OLD_PASSWORD }
const BOB = { id: 8, username: 'bob', email: 'bob@example.com', password: 'bob-password-3' }
const UNVERIFIED = { id: 9, username: 'carol', email: 'carol@example.com', password: 'carol-password', emailVerified: false }

let store
let mail // every sendPasswordResetEmail call: { to, username, rawToken, expiresInMinutes }
let mailer
let io
let logs

function fakeIo() {
  const log = []
  return {
    log,
    to: (room) => ({ emit: (event, payload) => log.push(['emit', room, event, payload]) }),
    in: (room) => ({ disconnectSockets: (close) => log.push(['disconnect', room, close]) }),
  }
}

// Records console output (to check no token is ever logged) without
// printing it.
function captureConsole() {
  const lines = []
  const original = {}
  for (const level of ['log', 'warn', 'error']) {
    original[level] = console[level]
    console[level] = (...args) => lines.push(args.map(String).join(' '))
  }
  lines.restore = () => Object.assign(console, original)
  return lines
}

beforeEach(() => {
  store = createPasswordResetTestStore({
    users: [ALICE, BOB, UNVERIFIED],
    verificationTokens: [{ userId: UNVERIFIED.id, tokenHash: 'pending-verification' }],
  })
  mail = []
  mailer = {
    impl: async () => ({ sent: true }),
    sendPasswordResetEmail(message) {
      mail.push(message)
      return mailer.impl(message)
    },
  }
  io = fakeIo()
  passwordResetService.setPasswordResetStore(store)
  passwordResetService.setPasswordResetMailer(mailer)
  sessionService.setTokenVersionStore(store.tokenVersionStore)
  sessionService.attachIo(io)
  logs = captureConsole()
})

afterEach(async () => {
  await passwordResetService.whenIdle()
  logs.restore()
  passwordResetService.setPasswordResetStore(null)
  passwordResetService.setPasswordResetMailer(null)
  sessionService.setTokenVersionStore(null)
  sessionService.attachIo(null)
})

function callForgot(email) {
  const res = fakeRes()
  forgotPassword({ body: { email } }, res)
  return res
}

async function callReset(body) {
  const res = fakeRes()
  await resetPasswordHandler({ body }, res)
  return res
}

// Requests a link for `email` and returns the raw token the email carried.
async function requestLink(email) {
  const before = mail.length
  callForgot(email)
  await passwordResetService.whenIdle()
  assert.equal(mail.length, before + 1, `no email was sent to ${email}`)
  return mail.at(-1).rawToken
}

// Lets a new request through the per-account cooldown.
function endCooldown(userId) {
  for (const t of store.resetTokens(userId)) store.patchResetToken(t.id, { createdAt: new Date(Date.now() - 10 * 60 * 1000) })
}

// --- forgot-password: never reveals anything ----------------------------------

test('forgot-password: account, no account, unverified and cooldown all get the identical 200', async () => {
  const replies = []
  for (const email of ['alice@example.com', 'nobody@example.com', 'carol@example.com', 'alice@example.com', 'ALICE@Example.com ']) {
    const res = callForgot(email)
    replies.push({ status: res.statusCode, body: res.body })
  }
  await passwordResetService.whenIdle()

  for (const reply of replies) assert.deepEqual(reply, { status: 200, body: FORGOT_PASSWORD_RESPONSE })
  assert.equal(JSON.stringify(replies[0]), JSON.stringify(replies[1]), 'an unknown email must look exactly like a known one')
  // Alice once (her 2nd and 3rd requests are in the cooldown), Carol once, nobody@ never.
  assert.deepEqual(
    mail.map((m) => m.to),
    ['alice@example.com', 'carol@example.com']
  )
  assert.equal(mail[0].expiresInMinutes, 30)
})

test('forgot-password: the reply is sent before any lookup or email (no timing difference)', async () => {
  let releaseMail
  mailer.impl = () =>
    new Promise((resolve) => {
      releaseMail = resolve
    })
  let lookups = 0
  const find = store.findUserByEmail
  store.findUserByEmail = async (email) => {
    lookups += 1
    return find(email)
  }

  const res = callForgot('alice@example.com')
  // Synchronously answered: no lookup has even started yet.
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, FORGOT_PASSWORD_RESPONSE)
  assert.equal(lookups, 0)

  // The email is still held back; the background work finishes once it goes out.
  while (!releaseMail) await new Promise((resolve) => setImmediate(resolve))
  releaseMail({ sent: true })
  await passwordResetService.whenIdle()
  assert.equal(lookups, 1)
  assert.equal(mail.length, 1)
})

test('forgot-password: a malformed email is a 400 INVALID_EMAIL, nothing else runs', async () => {
  for (const email of ['', 'not-an-email', undefined, 42]) {
    const res = callForgot(email)
    assert.equal(res.statusCode, 400)
    assert.equal(res.body.code, 'INVALID_EMAIL')
  }
  await passwordResetService.whenIdle()
  assert.equal(mail.length, 0)
})

// --- forgot-password: the background work never escapes ------------------------

async function expectNoUnhandledRejection(fn) {
  const seen = []
  const onUnhandled = (reason) => seen.push(reason)
  process.on('unhandledRejection', onUnhandled)
  try {
    await fn()
    // Give any stray rejection a turn to surface before checking.
    await new Promise((resolve) => setImmediate(resolve))
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
  assert.deepEqual(seen, [], 'a background failure escaped as an unhandled rejection')
}

test('forgot-password background: a failing email is caught and logged without the token', async () => {
  mailer.impl = async () => {
    throw new Error('SMTP connection refused')
  }
  await expectNoUnhandledRejection(async () => {
    const res = callForgot('alice@example.com')
    assert.deepEqual(res.body, FORGOT_PASSWORD_RESPONSE)
    const outcome = await passwordResetService.startPasswordResetRequest('bob@example.com')
    assert.equal(outcome, 'failed')
    await passwordResetService.whenIdle()
  })
  assert.equal(mail.length, 2)
  assert.ok(logs.some((l) => /password-reset\] request failed: SMTP connection refused/.test(l)), logs.join('\n'))
  for (const m of mail) assert.ok(!logs.join('\n').includes(m.rawToken), 'a token was logged')
})

test('forgot-password background: a database failure is caught; nothing is sent', async () => {
  store.control.failing = true
  await expectNoUnhandledRejection(async () => {
    const res = callForgot('alice@example.com')
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, FORGOT_PASSWORD_RESPONSE)
    await passwordResetService.whenIdle()
  })
  assert.equal(mail.length, 0)
  assert.ok(logs.some((l) => /request failed: database unreachable/.test(l)))
})

test('forgot-password background: a synchronous throw (not a rejected promise) is caught too', async () => {
  mailer.sendPasswordResetEmail = () => {
    throw new TypeError('mailer exploded synchronously')
  }
  await expectNoUnhandledRejection(async () => {
    callForgot('alice@example.com')
    await passwordResetService.whenIdle()
  })
  assert.ok(logs.some((l) => /mailer exploded synchronously/.test(l)))
})

test('forgot-password: a failure while creating the link leaves no half-made link behind', async () => {
  store.control.failAt = 'createResetToken'
  callForgot('alice@example.com')
  await passwordResetService.whenIdle()
  assert.equal(mail.length, 0)
  assert.deepEqual(store.resetTokens(ALICE.id), [])
})

// --- links ------------------------------------------------------------------------

test('a new request invalidates every older unused link; only the newest works', async () => {
  const first = await requestLink('alice@example.com')
  endCooldown(ALICE.id)
  const second = await requestLink('alice@example.com')
  assert.notEqual(first, second)

  const stale = await callReset({ token: first, password: NEW_PASSWORD })
  assert.equal(stale.statusCode, 400)
  assert.equal(stale.body.code, 'RESET_TOKEN_INVALID')

  const fresh = await callReset({ token: second, password: NEW_PASSWORD })
  assert.equal(fresh.statusCode, 200)
})

test('wrong, expired and already-used tokens are refused with RESET_TOKEN_* 400s', async () => {
  const wrong = await callReset({ token: 'f'.repeat(64), password: NEW_PASSWORD })
  assert.equal(wrong.statusCode, 400)
  assert.equal(wrong.body.code, 'RESET_TOKEN_INVALID')

  for (const token of [undefined, '', 42, 'x'.repeat(201)]) {
    const res = await callReset({ token, password: NEW_PASSWORD })
    assert.equal(res.statusCode, 400)
    assert.equal(res.body.code, 'RESET_TOKEN_INVALID')
  }

  const expiring = await requestLink('alice@example.com')
  const [row] = store.resetTokens(ALICE.id)
  store.patchResetToken(row.id, { expiresAt: new Date(Date.now() - 1000) })
  const expired = await callReset({ token: expiring, password: NEW_PASSWORD })
  assert.equal(expired.statusCode, 400)
  assert.equal(expired.body.code, 'RESET_TOKEN_EXPIRED')
  assert.match(expired.body.message, /hết hạn/)

  endCooldown(ALICE.id)
  const token = await requestLink('alice@example.com')
  assert.equal((await callReset({ token, password: NEW_PASSWORD })).statusCode, 200)
  const reused = await callReset({ token, password: 'another-password-4' })
  assert.equal(reused.statusCode, 400)
  assert.equal(reused.body.code, 'RESET_TOKEN_INVALID')
  assert.ok(await comparePassword(NEW_PASSWORD, store.user(ALICE.id).passwordHash), 'a used link changed the password again')

  // None of these is a session-ending code / 401 (those sign the client out).
  for (const res of [wrong, expired, reused]) {
    assert.ok(!['TOKEN_EXPIRED', 'INVALID_TOKEN', 'TOKEN_REVOKED'].includes(res.body.code))
  }
})

test('the new password must follow the sign-up rule (INVALID_PASSWORD), and the link survives', async () => {
  const token = await requestLink('alice@example.com')
  for (const password of ['short', '', undefined, 'x'.repeat(201)]) {
    const res = await callReset({ token, password })
    assert.equal(res.statusCode, 400)
    assert.equal(res.body.code, 'INVALID_PASSWORD')
  }
  assert.equal((await callReset({ token, password: NEW_PASSWORD })).statusCode, 200, 'a rejected password used up the link')
})

// --- a successful reset ---------------------------------------------------------------

test('success: new password works, old fails, token used, others invalidated, sessions revoked', async () => {
  const oldJwt = signAccessToken({ id: ALICE.id, username: ALICE.username, tokenVersion: 0 })
  const bobJwt = signAccessToken({ id: BOB.id, username: BOB.username, tokenVersion: 0 })
  assert.ok((await sessionService.authenticateToken(oldJwt)).payload)

  const token = await requestLink('alice@example.com')
  // A second open link for the same account, made directly.
  await store.transaction((repo) =>
    repo.createResetToken({ userId: ALICE.id, tokenHash: 'another-open-link', expiresAt: new Date(Date.now() + 60_000) })
  )
  assert.equal(store.resetTokens(ALICE.id).filter((t) => t.consumedAt === null).length, 2)

  const res = await callReset({ token, password: NEW_PASSWORD })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { success: true, message: 'Đã đổi mật khẩu, hãy đăng nhập lại.' })

  // The password, checked with the same function login uses.
  const alice = store.user(ALICE.id)
  assert.equal(await comparePassword(NEW_PASSWORD, alice.passwordHash), true, 'the new password does not log in')
  assert.equal(await comparePassword(OLD_PASSWORD, alice.passwordHash), false, 'the old password still logs in')

  // Every link of the account is used up now.
  assert.equal(store.resetTokens(ALICE.id).filter((t) => t.consumedAt === null).length, 0)

  // Sessions: tokenVersion went up, the earlier JWT is refused, sockets told then dropped.
  assert.equal(alice.tokenVersion, 1)
  assert.deepEqual(await sessionService.authenticateToken(oldJwt), { code: 'TOKEN_REVOKED' })
  assert.deepEqual(io.log, [
    ['emit', 'user:7', 'session_ended', { code: 'TOKEN_REVOKED' }],
    ['disconnect', 'user:7', true],
  ])
  // A login after the reset gets the new version and works.
  const freshJwt = signAccessToken({ id: ALICE.id, username: ALICE.username, tokenVersion: alice.tokenVersion })
  assert.ok((await sessionService.authenticateToken(freshJwt)).payload)

  // Nobody else is touched.
  assert.ok((await sessionService.authenticateToken(bobJwt)).payload)
  assert.equal(await comparePassword('bob-password-3', store.user(BOB.id).passwordHash), true)
})

test('success on an unverified account: email marked verified, pending verification links invalidated', async () => {
  assert.equal(store.user(UNVERIFIED.id).emailVerified, false)
  const token = await requestLink('carol@example.com')
  assert.equal((await callReset({ token, password: NEW_PASSWORD })).statusCode, 200)
  assert.equal(store.user(UNVERIFIED.id).emailVerified, true)
  assert.ok(store.verificationTokens(UNVERIFIED.id).every((t) => t.consumedAt !== null))
})

test('one token cannot win twice, even with two resets at the same moment', async () => {
  const token = await requestLink('alice@example.com')
  const [a, b] = await Promise.all([
    callReset({ token, password: 'first-password-5' }),
    callReset({ token, password: 'second-password-6' }),
  ])
  const codes = [a.statusCode, b.statusCode].sort()
  assert.deepEqual(codes, [200, 400])
  assert.equal(store.user(ALICE.id).tokenVersion, 1, 'tokenVersion raised twice')
  const winner = a.statusCode === 200 ? 'first-password-5' : 'second-password-6'
  assert.equal(await comparePassword(winner, store.user(ALICE.id).passwordHash), true)
})

// --- requirement A: all or nothing ------------------------------------------------------

for (const step of ['setPasswordAndBumpTokenVersion', 'invalidateOpenResetTokens', 'invalidateOpenVerificationTokens']) {
  test(`a failure inside the reset transaction (${step}) changes nothing: password, tokenVersion, link`, async () => {
    const oldJwt = signAccessToken({ id: UNVERIFIED.id, username: UNVERIFIED.username, tokenVersion: 0 })
    const token = await requestLink('carol@example.com')
    const before = store.user(UNVERIFIED.id)

    store.control.failAt = step
    // The service rejects…
    await assert.rejects(passwordResetService.resetPassword(token, NEW_PASSWORD), new RegExp(`injected failure at ${step}`))
    // …and the HTTP route answers 503, never 200.
    const res = await callReset({ token, password: NEW_PASSWORD })
    assert.equal(res.statusCode, 503)

    const after = store.user(UNVERIFIED.id)
    assert.equal(after.passwordHash, before.passwordHash, 'the password changed although the transaction failed')
    assert.equal(after.tokenVersion, before.tokenVersion, 'tokenVersion went up although the transaction failed')
    assert.equal(after.emailVerified, false)
    assert.ok((await sessionService.authenticateToken(oldJwt)).payload, 'the old session was revoked anyway')
    assert.deepEqual(io.log, [], 'sockets were disconnected for a reset that did not happen')
    assert.equal(store.resetTokens(UNVERIFIED.id).filter((t) => t.consumedAt === null).length, 1, 'the link was used up')

    // Once the problem is gone, the very same link still works.
    store.control.failAt = null
    assert.equal((await callReset({ token, password: NEW_PASSWORD })).statusCode, 200)
    assert.equal(store.user(UNVERIFIED.id).tokenVersion, before.tokenVersion + 1)
  })
}

// --- tokens stay secret ------------------------------------------------------------------

test('no token ever appears in a log line or an API response', async () => {
  const replies = [callForgot('alice@example.com').body]
  await passwordResetService.whenIdle()
  const token = mail.at(-1).rawToken
  replies.push((await callReset({ token, password: 'short' })).body)
  replies.push((await callReset({ token, password: NEW_PASSWORD })).body)
  replies.push((await callReset({ token, password: NEW_PASSWORD })).body)

  const everything = JSON.stringify(replies) + '\n' + logs.join('\n')
  assert.ok(!everything.includes(token), 'the raw token leaked')
  // Not the stored hash either.
  for (const row of store.resetTokens(ALICE.id)) assert.ok(!everything.includes(row.tokenHash))
})

test('mailer: the link carries the token after "#"; without SMTP only a non-production run logs it', () => {
  const token = 'a'.repeat(64)
  const url = buildPasswordResetUrl(token)
  assert.match(url, /\/reset-password#token=a{64}$/)
  assert.ok(!url.includes('?'), 'the token must not be in the query string')

  const prod = unsentPasswordResetLog({ to: 'x@example.com', resetUrl: url, nodeEnv: 'production' })
  assert.ok(!prod.includes(token), 'production log contains the token')
  assert.match(prod, /not sent/)
  for (const nodeEnv of [undefined, 'development', 'test']) {
    assert.ok(unsentPasswordResetLog({ to: 'x@example.com', resetUrl: url, nodeEnv }).includes(url), `dev log (${nodeEnv}) lacks the link`)
  }
})

test('both routes are POST with the auth rate limit in front', () => {
  const router = require('../routes/authRoutes')
  for (const [path, handler] of [
    ['/forgot-password', forgotPassword],
    ['/reset-password', resetPasswordHandler],
  ]) {
    const layer = router.stack.find((l) => l.route && l.route.path === path)
    assert.ok(layer, `${path} missing`)
    assert.deepEqual(Object.keys(layer.route.methods), ['post'])
    assert.equal(layer.route.stack.length, 2, `${path}: expected rate limit + handler`)
    assert.equal(layer.route.stack[1].handle, handler)
    const login = router.stack.find((l) => l.route && l.route.path === '/login')
    assert.equal(layer.route.stack[0].handle, login.route.stack[0].handle, `${path} is not behind authRateLimit`)
  }
})
