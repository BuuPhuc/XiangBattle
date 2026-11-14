// Shared bits for the in-process auth tests (no server, no database).

// An in-memory token-version store with the same shape as sessionService's
// database store. `versions` maps userId -> current tokenVersion; an id not
// in it is an account that doesn't exist. `failing: true` makes every call
// reject, like an unreachable database.
function memoryStore(versions = {}, { failing = false } = {}) {
  const map = new Map(Object.entries(versions).map(([id, v]) => [Number(id), v]))
  const calls = { get: [], bump: [] }
  return {
    calls,
    versionOf: (userId) => map.get(userId),
    async getTokenVersion(userId) {
      calls.get.push(userId)
      if (failing) throw new Error('database unreachable')
      return map.has(userId) ? map.get(userId) : null
    },
    async bumpTokenVersion(userId) {
      calls.bump.push(userId)
      if (failing) throw new Error('database unreachable')
      if (!map.has(userId)) return null
      map.set(userId, map.get(userId) + 1)
      return map.get(userId)
    },
  }
}

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

// Runs an (async) Express middleware against a fake request carrying the
// given Authorization header.
async function runMiddleware(middleware, authorization, extra = {}) {
  const req = { headers: authorization ? { authorization } : {}, ...extra }
  const res = fakeRes()
  let nextCalled = false
  await middleware(req, res, () => {
    nextCalled = true
  })
  return { req, res, nextCalled }
}

module.exports = { memoryStore, fakeRes, runMiddleware }
