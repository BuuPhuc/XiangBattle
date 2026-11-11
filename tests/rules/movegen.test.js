// The bot's fast move generator (src/features/ai/engine/moveGen.js) must
// produce exactly the same legal moves as the existing rules.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { movePiece, otherTurn } from '../../src/features/game/gameLogic.js'
import { getAllLegalMoves } from '../../src/features/game/utils/moveUtils.js'
import { INITIAL_PIECES } from '../../src/features/game/initialPosition.js'
import { generateLegalMoves } from '../../src/features/ai/engine/moveGen.js'
import { clone, seededRandom } from '../helpers/board.js'

const key = (m) => `${m.pieceId}@${m.col},${m.row}`

function perft(pieces, side, depth) {
  const moves = generateLegalMoves(pieces, side)
  if (depth === 1) return moves.length
  let n = 0
  for (const m of moves) n += perft(movePiece(pieces, m.pieceId, m.col, m.row), otherTurn(side), depth - 1)
  return n
}

for (const [depth, expected] of [
  [1, 44],
  [2, 1920],
  [3, 79666],
]) {
  test(`fast generator perft(${depth}) = ${expected}`, () => {
    assert.equal(perft(clone(INITIAL_PIECES), 'red', depth), expected)
  })
}

test('fast generator matches getAllLegalMoves on thousands of random positions', () => {
  const random = seededRandom(12345)
  let positions = 0
  for (let game = 0; game < 60; game++) {
    let pieces = clone(INITIAL_PIECES)
    let side = 'red'
    for (let ply = 0; ply < 150; ply++) {
      const slow = getAllLegalMoves(pieces, side).map(key).sort()
      const fast = generateLegalMoves(pieces, side).map(key).sort()
      positions++
      assert.deepEqual(fast, slow, `game ${game}, ply ${ply}`)
      if (fast.length === 0) break
      const moves = generateLegalMoves(pieces, side)
      const m = moves[Math.floor(random() * moves.length)]
      pieces = movePiece(pieces, m.pieceId, m.col, m.row)
      side = otherTurn(side)
    }
  }
  assert.ok(positions > 5000, `only ${positions} positions checked`)
})
