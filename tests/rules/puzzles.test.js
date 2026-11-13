// Cờ thế: the solver and every puzzle.
//
// The key promise: a move is accepted only if EVERY legal defence still
// loses within the moves left. To make sure no optimisation in the real
// solver (cache, move ordering, early exits) ever skips a defence, a second,
// deliberately naive solver below re-decides every first move of every
// puzzle, and the two must agree.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { movePiece, otherTurn } from '../../src/features/game/gameLogic.js'
import { isInCheck, generalsFacingEachOther } from '../../src/features/game/utils/checkUtils.js'
import { getAllLegalMoves, hasAnyLegalMove } from '../../src/features/game/utils/moveUtils.js'
import {
  createSolver,
  judgeMove,
  solutionLine,
  findHintMove,
  applyMove,
  MOVE_VERDICT,
} from '../../src/features/puzzles/engine/solver.js'
import { PUZZLES, PUZZLE_LEVELS, getPuzzle, nextPuzzleId } from '../../src/features/puzzles/data/puzzles.js'
import { buildPuzzlePieces } from '../../src/features/puzzles/engine/puzzle.js'

const P = (side, type, col, row) => ({ id: `${side}-${type}-${col}${row}`, side, type, char: '?', col, row })

// --- the naive reference: plain recursion over the game's own (slow,
// 90-square) legal-move list, no cache, no ordering.
function naiveAttackerWins(pieces, attacker, n) {
  if (n <= 0) return false
  for (const m of getAllLegalMoves(pieces, attacker)) {
    if (naiveDefenderLoses(movePiece(pieces, m.pieceId, m.col, m.row), attacker, n - 1)) return true
  }
  return false
}
function naiveDefenderLoses(pieces, attacker, remaining) {
  const defender = otherTurn(attacker)
  const replies = getAllLegalMoves(pieces, defender)
  if (replies.length === 0) return true
  if (remaining <= 0) return false
  return replies.every((r) => naiveAttackerWins(movePiece(pieces, r.pieceId, r.col, r.row), attacker, remaining))
}

// --- solver basics on hand-made positions
test('solver: a mate in 1, a wrong move, and a position with no mate', () => {
  const twoRooks = [P('black', 'general', 4, 0), P('red', 'general', 3, 9), P('red', 'rook', 0, 1), P('red', 'rook', 8, 5)]
  assert.equal(createSolver().mateDistance(twoRooks, 'red', 3), 1)
  assert.equal(judgeMove(twoRooks, 'red', { from: [8, 5], to: [8, 0] }, 1).verdict, MOVE_VERDICT.WIN)
  assert.equal(judgeMove(twoRooks, 'red', { from: [8, 5], to: [7, 5] }, 1).verdict, MOVE_VERDICT.WRONG)
  // Not a legal move at all (rook can't jump / move diagonally).
  assert.equal(judgeMove(twoRooks, 'red', { from: [8, 5], to: [7, 4] }, 1).verdict, MOVE_VERDICT.WRONG)
  // Not the attacker's piece.
  assert.equal(judgeMove(twoRooks, 'red', { from: [4, 0], to: [4, 1] }, 1).verdict, MOVE_VERDICT.WRONG)

  const bare = [P('black', 'general', 4, 0), P('red', 'general', 3, 9), P('red', 'pawn', 0, 4)]
  assert.equal(createSolver().mateDistance(bare, 'red', 3), null)
  assert.equal(findHintMove(bare, 'red', 3), null)
  assert.equal(solutionLine(bare, 'red', 3), null)
})

test('solver: a check that one defence escapes is rejected, even if other defences lose', () => {
  // Red rook checks on the back rank; the general can step up — that one
  // defence escapes, so the check is WRONG for a mate in 1 and in 2.
  const pos = [P('black', 'general', 4, 0), P('red', 'general', 3, 9), P('red', 'rook', 8, 5)]
  const check = { from: [8, 5], to: [8, 0] }
  assert.equal(judgeMove(pos, 'red', check, 1).verdict, MOVE_VERDICT.WRONG)
  const after = applyMove(pos, check)
  assert.ok(getAllLegalMoves(after, 'black').length > 0)
  assert.equal(naiveDefenderLoses(after, 'red', 1), false)
  assert.equal(judgeMove(pos, 'red', check, 2).verdict, MOVE_VERDICT.WRONG)
})

// --- the puzzle set
test('puzzle set: 24 unique ids, 8 per level, 3 of each 8 with Black to move', () => {
  assert.equal(PUZZLES.length, 24)
  assert.equal(new Set(PUZZLES.map((p) => p.id)).size, 24)
  for (const level of PUZZLE_LEVELS) {
    const list = PUZZLES.filter((p) => p.moves === level.moves)
    assert.equal(list.length, 8, `level ${level.moves}`)
    assert.equal(list.filter((p) => p.toMove === 'black').length, 3, `level ${level.moves} black-to-move`)
  }
  assert.equal(getPuzzle('m1-1').id, 'm1-1')
  assert.equal(getPuzzle('nope'), null)
  assert.equal(nextPuzzleId(PUZZLES.at(-1).id), PUZZLES[0].id)
})

const MAX = { general: 1, advisor: 2, elephant: 2, horse: 2, rook: 2, cannon: 2, pawn: 5 }
function legalSquare({ side, type, col, row }) {
  const own = side === 'red' ? (r) => r >= 5 : (r) => r <= 4
  const mirror = (r) => (side === 'red' ? r : 9 - r) // red-relative row
  const r = mirror(row)
  switch (type) {
    case 'general':
      return col >= 3 && col <= 5 && r >= 7
    case 'advisor':
      return [[3, 9], [5, 9], [4, 8], [3, 7], [5, 7]].some(([c, rr]) => c === col && rr === r)
    case 'elephant':
      return own(row) && [[2, 9], [6, 9], [0, 7], [4, 7], [8, 7], [2, 5], [6, 5]].some(([c, rr]) => c === col && rr === r)
    case 'pawn':
      // Before the river a pawn can only be on its file's start / one-step squares.
      return r <= 4 || ((r === 5 || r === 6) && col % 2 === 0)
    default:
      return true
  }
}

for (const puzzle of PUZZLES) {
  test(`${puzzle.id} (${puzzle.title}, ${puzzle.toMove} mates in ${puzzle.moves}): legal and exact`, () => {
    const pieces = buildPuzzlePieces(puzzle)
    const attacker = puzzle.toMove
    const defender = otherTurn(attacker)

    // A position that could arise in a real game.
    const squares = new Set(pieces.map((p) => `${p.col},${p.row}`))
    assert.equal(squares.size, pieces.length, 'two pieces on one square')
    for (const side of ['red', 'black']) {
      for (const [type, max] of Object.entries(MAX)) {
        const count = pieces.filter((p) => p.side === side && p.type === type).length
        assert.ok(count <= max, `${count} ${side} ${type}`)
      }
      assert.equal(pieces.filter((p) => p.side === side && p.type === 'general').length, 1, `${side} general`)
    }
    for (const p of pieces) assert.ok(legalSquare(p), `${p.side} ${p.type} can't stand on ${p.col},${p.row}`)
    assert.equal(generalsFacingEachOther(pieces), false, 'generals face each other')
    assert.equal(isInCheck(pieces, defender), false, 'the side NOT to move is in check')
    assert.equal(isInCheck(pieces, attacker), false, 'the side to move starts in check')

    // Exactly N, nothing faster, one key move, and the line ends in real mate.
    const solver = createSolver()
    assert.equal(solver.mateDistance(pieces, attacker, puzzle.moves), puzzle.moves)
    const keys = solver.winningMoves(pieces, attacker, puzzle.moves)
    assert.equal(keys.length, 1, `key moves: ${JSON.stringify(keys)}`)
    const line = solutionLine(pieces, attacker, puzzle.moves, solver)
    assert.equal(line.length, 2 * puzzle.moves - 1)
    let board = pieces
    for (const move of line) board = applyMove(board, move)
    assert.ok(isInCheck(board, defender) && !hasAnyLegalMove(board, defender), 'solution does not end in checkmate')

    // Walking the solution through judgeMove: correct at every step, the
    // computer's reply is the one played, and the last move wins.
    board = pieces
    for (let i = 0; i < line.length; i += 2) {
      const remaining = puzzle.moves - i / 2
      const verdict = judgeMove(board, attacker, line[i], remaining, solver)
      const isLast = i === line.length - 1
      assert.equal(verdict.verdict, isLast ? MOVE_VERDICT.WIN : MOVE_VERDICT.CORRECT, `step ${i / 2 + 1}`)
      board = applyMove(board, line[i])
      if (!isLast) {
        assert.deepEqual(verdict.reply, line[i + 1])
        board = applyMove(board, line[i + 1])
      }
    }
  })

  test(`${puzzle.id}: every first move judged exactly like the naive check of ALL defences`, (t) => {
    const pieces = buildPuzzlePieces(puzzle)
    const attacker = puzzle.toMove
    const solver = createSolver()
    let accepted = 0
    let slowest = 0
    for (const m of getAllLegalMoves(pieces, attacker)) {
      const from = pieces.find((p) => p.id === m.pieceId)
      const move = { from: [from.col, from.row], to: [m.col, m.row] }
      const started = performance.now()
      const { verdict } = judgeMove(pieces, attacker, move, puzzle.moves, createSolver())
      slowest = Math.max(slowest, performance.now() - started)
      const naive = naiveDefenderLoses(movePiece(pieces, m.pieceId, m.col, m.row), attacker, puzzle.moves - 1)
      assert.equal(verdict !== MOVE_VERDICT.WRONG, naive, `${JSON.stringify(move)}: solver ${verdict}, naive ${naive}`)
      if (naive) accepted++
    }
    assert.equal(accepted, 1, 'exactly the key move should be accepted')
    t.diagnostic(`slowest judgement: ${slowest.toFixed(0)} ms`)
    // Fresh solver per judgement = the worst case the page can meet.
    assert.ok(slowest < 2000, `judging a move took ${slowest.toFixed(0)} ms`)
    void solver
  })
}
