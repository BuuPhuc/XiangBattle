// TEST ONLY — preloaded next to fakeTokenVersionStore.js into the backend
// that tests/helpers/testServer.js spawns, and nowhere else. Replaces only
// where Quick Play reads an account's Elo, so the matchmaking tests can give
// made-up accounts a rating without database rows:
//
//   account id 95RRRR → Elo RRRR   (e.g. 951600 → 1600)
//   any other id      → no rating  (matchmaking then uses its default, 1200)
//
// The pairing itself (sockets/matchmakingHandler.js) is the real code.
if (process.env.XIANGBATTLE_FAKE_TOKEN_STORE !== '1') {
  throw new Error('fakeRatingLookup.js is a test helper and must only be preloaded by tests/helpers/testServer.js')
}

const path = require('node:path')
const SERVER_DIR = path.resolve(__dirname, '..', '..')
const { setRatingLookup } = require(path.join(SERVER_DIR, 'sockets', 'matchmakingHandler'))

const FAKE_RATING_BASE = 950000

setRatingLookup(async (userId) => {
  const rating = userId - FAKE_RATING_BASE
  return userId > FAKE_RATING_BASE && rating < 10000 ? rating : null
})
console.log('[test] Quick Play ratings from account ids (fakeRatingLookup.js)')
