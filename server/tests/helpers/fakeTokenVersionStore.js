// TEST ONLY — preloaded into the backend that tests/helpers/testServer.js
// spawns (`node -r <this file> server.js`), and nowhere else: server.js,
// package.json's start/dev scripts and everything under services/ never
// require it. It replaces only *where token versions are stored* — an
// in-memory map instead of the user table — so the socket tests can use
// made-up account ids without writing to the database. The check that
// accepts or refuses a token (sessionService.authenticateToken) is the real,
// unchanged code.
//
// Every positive integer id counts as an existing account, starting at
// version 0; revokeAllSessions bumps it in memory like the real store does.
if (process.env.XIANGBATTLE_FAKE_TOKEN_STORE !== '1') {
  throw new Error('fakeTokenVersionStore.js is a test helper and must only be preloaded by tests/helpers/testServer.js')
}

const path = require('node:path')
const SERVER_DIR = path.resolve(__dirname, '..', '..')

// utils/token.js (pulled in by sessionService) reads JWT_SECRET when it is
// first loaded, which here happens before server.js runs dotenv itself.
require('dotenv').config({ path: path.join(SERVER_DIR, '.env'), quiet: true })

const sessionService = require(path.join(SERVER_DIR, 'services', 'sessionService'))

function createMemoryTokenVersionStore() {
  const versions = new Map()
  const exists = (userId) => Number.isInteger(userId) && userId > 0
  return {
    async getTokenVersion(userId) {
      if (!exists(userId)) return null
      return versions.get(userId) || 0
    },
    async bumpTokenVersion(userId) {
      if (!exists(userId)) return null
      const next = (versions.get(userId) || 0) + 1
      versions.set(userId, next)
      return next
    },
  }
}

sessionService.setTokenVersionStore(createMemoryTokenVersionStore())
console.log('[test] token versions kept in memory (fakeTokenVersionStore.js)')
