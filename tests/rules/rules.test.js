// The existing rule engine (src/features/game) — the one the player, the
// server referee and the bot all rely on.
//  - Correctness: perft (number of legal move sequences from the start
//    position) must match the published Xiangqi values.
//  - Immutability: generating moves must never modify the board it reads
//    (the board is deep-frozen; any write would throw in an ES module).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { movePiece, otherTurn } from '../../src/features/game/gameLogic.js'
import { getAllLegalMoves } from '../../src/features/game/utils/moveUtils.js'
import { INITIAL_PIECES } from '../../src/features/game/initialPosition.js'
import { deepFreeze } from '../helpers/board.js'

function perft(pieces, side, depth) {
  const moves = getAllLegalMoves(pieces, side)
  if (depth === 1) return moves.length
  let total = 0
  for (const m of moves) total += perft(deepFreeze(movePiece(pieces, m.pieceId, m.col, m.row)), otherTurn(side), depth - 1)
  return total
}

const start = deepFreeze(INITIAL_PIECES)

for (const [depth, expected] of [
  [1, 44],
  [2, 1920],
  [3, 79666],
]) {
  test(`perft(${depth}) from the start position = ${expected}`, () => {
    assert.equal(perft(start, 'red', depth), expected)
  })
}

test('move generation never modifies the board it reads', () => {
  const before = JSON.stringify(start)
  // Reaching here without a TypeError from the frozen objects already proves
  // nothing tried to write; also compare the content.
  perft(start, 'red', 2)
  assert.equal(JSON.stringify(start), before)
})
