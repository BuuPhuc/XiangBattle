// The bot's engine (src/features/ai/engine): plays legal moves only, sees
// immediate wins and free material, respects its think-time budgets, and a
// stronger level beats a weaker one. Every bot move is re-checked with the
// existing rules (isFullyLegalMove), exactly as the game does.
//
// Self-play length: BOT_SELFPLAY_GAMES (default 2) games, RNG seeded so the
// result is repeatable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { movePiece, otherTurn } from '../../src/features/game/gameLogic.js'
import { isFullyLegalMove, hasAnyLegalMove } from '../../src/features/game/utils/moveUtils.js'
import { isInCheck } from '../../src/features/game/utils/checkUtils.js'
import { INITIAL_PIECES } from '../../src/features/game/initialPosition.js'
import { chooseMove } from '../../src/features/ai/engine/search.js'
import { judgeRepetition } from '../../src/features/game/utils/repetitionUtils.js'
import { AI_LEVELS } from '../../src/features/ai/engine/levels.js'
import { P, clone, seededRandom } from '../helpers/board.js'

const SELFPLAY_GAMES = Number(process.env.BOT_SELFPLAY_GAMES ?? 2)
const TIME_SLACK_MS = 300

const isLegal = (pieces, m) => {
  const piece = pieces.find((p) => p.id === m.pieceId)
  return Boolean(piece) && isFullyLegalMove(piece, m.col, m.row, pieces)
}

test('every level wins in one move when it can', () => {
  // Black general boxed in: either Xe(8,5)→(8,0) (checkmate) or
  // Xe(0,1)→(4,1) (no legal move left = loss in Xiangqi) ends the game.
  const pieces = [
    P('b-g', 'black', 'general', 3, 0),
    P('r-g', 'red', 'general', 4, 9),
    P('r-r1', 'red', 'rook', 0, 1),
    P('r-r2', 'red', 'rook', 8, 5),
  ]
  for (const level of Object.values(AI_LEVELS)) {
    const { move } = chooseMove(clone(pieces), 'red', level)
    assert.ok(isLegal(pieces, move), `${level.label}: illegal move`)
    const after = movePiece(pieces, move.pieceId, move.col, move.row)
    assert.equal(hasAnyLegalMove(after, 'black'), false, `${level.label} missed the win: ${JSON.stringify(move)}`)
  }
})

test('Trung bình takes an undefended rook', () => {
  const pieces = [
    P('b-g', 'black', 'general', 4, 0),
    P('b-r', 'black', 'rook', 0, 4),
    P('r-g', 'red', 'general', 3, 9),
    P('r-r', 'red', 'rook', 0, 8),
  ]
  const { move } = chooseMove(pieces, 'red', AI_LEVELS.medium)
  assert.deepEqual(move, { pieceId: 'r-r', col: 0, row: 4 })
})

for (const level of Object.values(AI_LEVELS)) {
  test(`${level.label}: legal opening move within its ${level.timeMs} ms budget`, () => {
    const board = clone(INITIAL_PIECES)
    const before = JSON.stringify(board)
    const started = performance.now()
    const result = chooseMove(board, 'red', level)
    const ms = performance.now() - started
    assert.ok(isLegal(board, result.move), 'illegal move')
    assert.ok(ms < level.timeMs + TIME_SLACK_MS, `took ${ms.toFixed(0)} ms`)
    assert.equal(JSON.stringify(board), before, 'board was modified')
  })
}

// Plays a full game with the same end rules as the real game: no legal move
// (checkmate/stalemate) or a repetition verdict.
function playGame(redLevel, blackLevel, random, maxPlies = 200) {
  let pieces = clone(INITIAL_PIECES)
  let side = 'red'
  const positions = [{ pieces, side }]
  for (let ply = 0; ply < maxPlies; ply++) {
    if (!hasAnyLegalMove(pieces, side)) {
      return { winner: otherTurn(side), plies: ply, reason: isInCheck(pieces, side) ? 'checkmate' : 'stalemate' }
    }
    const level = side === 'red' ? redLevel : blackLevel
    const history = positions.slice(0, -1)
    const { move } = chooseMove(pieces, side, { ...level, timeMs: Math.min(level.timeMs, 400), history, random })
    assert.ok(isLegal(pieces, move), `illegal bot move at ply ${ply}: ${JSON.stringify(move)}`)
    pieces = movePiece(pieces, move.pieceId, move.col, move.row)
    side = otherTurn(side)
    positions.push({ pieces, side })
    const repetition = judgeRepetition(positions)
    if (repetition) return { winner: repetition.winner, plies: ply + 1, reason: repetition.status }
  }
  return { winner: null, plies: maxPlies, reason: 'max plies' }
}

test('bot avoids a perpetual check it would be ruled to lose', () => {
  // Red rook has checked on rows 0/1 while the black general shuffled; one
  // full cycle is already in the game history. Repeating the check now
  // would be the cycle the rule punishes (red at fault).
  const start = [
    P('b-g', 'black', 'general', 4, 0),
    P('r-g', 'red', 'general', 3, 9),
    P('r-r', 'red', 'rook', 8, 1),
    P('r-p', 'red', 'pawn', 0, 6),
    P('b-p', 'black', 'pawn', 8, 3),
  ]
  const cycle = [
    ['r-r', 8, 0],
    ['b-g', 4, 1],
    ['r-r', 8, 1],
    ['b-g', 4, 0],
    ['r-r', 8, 0],
    ['b-g', 4, 1],
  ]
  const positions = [{ pieces: start, side: 'red' }]
  for (const [id, col, row] of cycle) {
    const last = positions[positions.length - 1]
    positions.push({ pieces: movePiece(last.pieces, id, col, row), side: otherTurn(last.side) })
  }
  const root = positions[positions.length - 1]
  assert.equal(root.side, 'red')

  for (const level of Object.values(AI_LEVELS)) {
    const { move } = chooseMove(clone(root.pieces), 'red', { ...level, history: positions.slice(0, -1) })
    const after = movePiece(root.pieces, move.pieceId, move.col, move.row)
    const verdict = judgeRepetition([...positions, { pieces: after, side: 'black' }])
    assert.notEqual(verdict?.loser, 'red', `${level.label} walked into a perpetual-check loss with ${JSON.stringify(move)}`)
    assert.notDeepEqual(move, { pieceId: 'r-r', col: 8, row: 1 }, `${level.label} repeated the perpetual check`)
  }
})

test(`self-play: Trung bình beats Dễ (${SELFPLAY_GAMES} games, all moves legal)`, { timeout: 600_000 }, (t) => {
  const random = seededRandom(2024)
  let strongWins = 0
  let weakWins = 0
  for (let g = 0; g < SELFPLAY_GAMES; g++) {
    const strongColor = g % 2 === 0 ? 'red' : 'black'
    const res = strongColor === 'red' ? playGame(AI_LEVELS.medium, AI_LEVELS.easy, random) : playGame(AI_LEVELS.easy, AI_LEVELS.medium, random)
    t.diagnostic(`game ${g + 1}: Trung bình as ${strongColor} → ${res.winner ?? 'no result'} (${res.reason}, ${res.plies} plies)`)
    if (res.winner === strongColor) strongWins++
    else if (res.winner) weakWins++
  }
  assert.ok(strongWins > weakWins, `Trung bình ${strongWins} – Dễ ${weakWins}`)
})
