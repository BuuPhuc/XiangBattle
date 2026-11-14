// optionalAuth (public routes such as the leaderboard): a valid token
// identifies the caller, anything else is treated as a guest — never a 401
// and never an identity taken from the token's unverified contents.
// Token versions come from an in-memory store (no database).
process.env.JWT_SECRET ||= 'test-secret-for-optional-auth'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const { optionalAuth, requireAuth } = require('../middleware/authMiddleware')
const { signAccessToken } = require('../utils/token')
const sessionService = require('../services/sessionService')
const { memoryStore, runMiddleware: run } = require('./helpers/authTestUtils')

before(() => sessionService.setTokenVersionStore(memoryStore({ 7: 0 })))
after(() => sessionService.setTokenVersionStore(null))

test('valid token → identified, like requireAuth', async () => {
  const token = signAccessToken({ id: 7, username: 'tester' })
  const { req, nextCalled } = await run(optionalAuth, `Bearer ${token}`)
  assert.equal(nextCalled, true)
  assert.equal(req.auth.userId, 7)
  assert.equal(req.auth.username, 'tester')
})

test('no token → guest, request continues', async () => {
  const { req, res, nextCalled } = await run(optionalAuth)
  assert.equal(nextCalled, true)
  assert.equal(req.auth, undefined)
  assert.equal(res.statusCode, 200)
})

test('invalid, forged or expired token → guest, never a 401', async () => {
  const forged = jwt.sign({ userId: 1, username: 'admin' }, 'some-other-secret')
  const expired = jwt.sign({ userId: 7, username: 'tester' }, process.env.JWT_SECRET, { expiresIn: -10 })
  for (const header of ['Bearer not-a-jwt', `Bearer ${forged}`, `Bearer ${expired}`, 'Basic abc', 'Bearer']) {
    const { req, res, nextCalled } = await run(optionalAuth, header)
    assert.equal(nextCalled, true, header)
    assert.equal(req.auth, undefined, `identity accepted from: ${header}`)
    assert.equal(res.statusCode, 200, header)
  }
})

test('requireAuth is unchanged: no token → 401', async () => {
  const { res, nextCalled } = await run(requireAuth)
  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 401)
})
