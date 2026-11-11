// The bot must never modify the real board while thinking. The board is
// deep-frozen, so any write anywhere in the search throws in an ES module.
// Kept in its own file (= its own process): frozen objects slow V8 down for
// everything that runs after them, which would skew bot.test.js's timings.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INITIAL_PIECES } from '../../src/features/game/initialPosition.js'
import { chooseMove } from '../../src/features/ai/engine/search.js'
import { AI_LEVELS } from '../../src/features/ai/engine/levels.js'
import { deepFreeze } from '../helpers/board.js'

test('bot thinking never writes to the board it is given', () => {
  const board = deepFreeze(INITIAL_PIECES)
  const before = JSON.stringify(board)
  assert.doesNotThrow(() => chooseMove(board, 'red', { ...AI_LEVELS.medium, timeMs: 5000 }))
  assert.equal(JSON.stringify(board), before)
})
