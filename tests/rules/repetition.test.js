// Repetition rules (src/features/game/utils/repetitionUtils.js): perpetual
// check, perpetual chase (incl. check + chase of the same piece), protected
// targets, the outcome table, and "a 3rd occurrence alone is not a draw".
// Every scripted move is checked to be legal with the existing rules.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findPieceAt, movePiece, otherTurn } from '../../src/features/game/gameLogic.js'
import { isFullyLegalMove } from '../../src/features/game/utils/moveUtils.js'
import {
  REPETITION_STATUS,
  classifyMove,
  decideOutcome,
  judgeRepetition,
  sideVerdict,
} from '../../src/features/game/utils/repetitionUtils.js'
import { P } from '../helpers/board.js'

// Plays `moves` ([fromCol, fromRow, toCol, toRow]) from `pieces` with `side`
// to move; returns every position, asserting each move is legal.
function play(pieces, side, moves) {
  const positions = [{ pieces, side }]
  let current = pieces
  let turn = side
  moves.forEach(([fc, fr, tc, tr], i) => {
    const piece = findPieceAt(current, fc, fr)
    assert.ok(piece && piece.side === turn, `move ${i + 1}: no ${turn} piece on (${fc},${fr})`)
    assert.ok(isFullyLegalMove(piece, tc, tr, current), `move ${i + 1}: (${fc},${fr})→(${tc},${tr}) is illegal`)
    current = movePiece(current, piece.id, tc, tr)
    turn = otherTurn(turn)
    positions.push({ pieces: current, side: turn })
  })
  return positions
}

const repeat = (cycle, times) => Array.from({ length: times }, () => cycle).flat()

// Judge after every move, the way the game does; returns the first verdict
// and the move number it came at.
function firstVerdict(positions) {
  for (let n = 2; n <= positions.length; n++) {
    const verdict = judgeRepetition(positions.slice(0, n))
    if (verdict) return { ...verdict, atMove: n - 1 }
  }
  return null
}

// --- Perpetual check: red rook keeps checking along rows 0/1, the black
// general shuffles between (4,0) and (4,1).
const CHECK_START = [
  P('b-g', 'black', 'general', 4, 0),
  P('r-g', 'red', 'general', 3, 9),
  P('r-r', 'red', 'rook', 8, 1),
  P('r-p', 'red', 'pawn', 0, 6),
  P('b-p', 'black', 'pawn', 8, 3),
]
const CHECK_CYCLE = [
  [8, 1, 8, 0], // red: check on row 0
  [4, 0, 4, 1], // black: general steps up
  [8, 0, 8, 1], // red: check on row 1
  [4, 1, 4, 0], // black: general steps back
]

test('perpetual check: the checking side loses at the 3rd occurrence', () => {
  const positions = play(CHECK_START, 'red', repeat(CHECK_CYCLE, 2))
  const verdict = firstVerdict(positions)
  assert.deepEqual(
    { status: verdict?.status, loser: verdict?.loser, winner: verdict?.winner, atMove: verdict?.atMove },
    { status: REPETITION_STATUS.PERPETUAL_CHECK, loser: 'red', winner: 'black', atMove: 8 }
  )
})

test('nothing is judged before the 3rd occurrence', () => {
  const positions = play(CHECK_START, 'red', CHECK_CYCLE) // start position occurs twice only
  assert.equal(firstVerdict(positions), null)
})

// --- Perpetual chase: a red rook keeps threatening the same unprotected
// black cannon, which keeps stepping off the attacked row.
const CHASE_START = [
  P('b-g', 'black', 'general', 4, 0),
  P('b-c', 'black', 'cannon', 0, 4),
  P('r-g', 'red', 'general', 3, 9),
  P('r-r', 'red', 'rook', 8, 5),
]
const CHASE_CYCLE = [
  [8, 5, 8, 4], // red: rook to row 4, threatens the cannon on (0,4)
  [0, 4, 0, 5], // black: cannon escapes to row 5
  [8, 4, 8, 5], // red: rook to row 5, threatens it again
  [0, 5, 0, 4], // black: cannon escapes back
]

test('perpetual chase of the same unprotected piece: the chasing side loses', () => {
  const positions = play(CHASE_START, 'red', repeat(CHASE_CYCLE, 2))
  const verdict = firstVerdict(positions)
  assert.equal(verdict?.status, REPETITION_STATUS.PERPETUAL_CHASE)
  assert.equal(verdict?.loser, 'red')
})

test('threatening a protected piece is not a chase → draw by repetition', () => {
  // A black rook on (0,0) guards the cannon on both of its squares.
  const start = [...CHASE_START, P('b-r', 'black', 'rook', 0, 0)]
  const positions = play(start, 'red', repeat(CHASE_CYCLE, 2))
  const chaseMove = classifyMove(positions[0].pieces, positions[1].pieces, 'red')
  assert.deepEqual(chaseMove.chased, [], 'protected cannon was counted as chased')
  const verdict = firstVerdict(positions)
  assert.equal(verdict?.status, REPETITION_STATUS.DRAW)
  assert.equal(verdict?.loser, null)
})

test('a horse threatening a protected rook still counts as a chase', () => {
  // Red horse jumps to attack a black rook that is protected by another rook.
  const before = [
    P('b-g', 'black', 'general', 4, 0),
    P('b-r1', 'black', 'rook', 2, 2),
    P('b-r2', 'black', 'rook', 2, 0),
    P('r-g', 'red', 'general', 3, 9),
    P('r-h', 'red', 'horse', 2, 6),
  ]
  const [, after] = play(before, 'red', [[2, 6, 3, 4]]) // horse (2,6)→(3,4) attacks (2,2)
  assert.deepEqual(classifyMove(before, after.pieces, 'red').chased, ['b-r1'])
})

// --- Check and chase of the same piece, alternating (one check, one chase).
const MIXED_START = [
  P('b-g', 'black', 'general', 4, 0),
  P('b-c', 'black', 'cannon', 0, 4),
  P('r-g', 'red', 'general', 3, 9),
  P('r-r1', 'red', 'rook', 8, 1),
  P('r-r2', 'red', 'rook', 8, 5),
]
const MIXED_CYCLE = [
  [8, 1, 8, 0], // red: check
  [4, 0, 4, 1], // black: general
  [8, 5, 8, 4], // red: chase the cannon
  [0, 4, 0, 5], // black: cannon escapes
  [8, 0, 8, 1], // red: check
  [4, 1, 4, 0], // black: general
  [8, 4, 8, 5], // red: chase the same cannon
  [0, 5, 0, 4], // black: cannon escapes
]

test('alternating check and chase of the SAME piece is perpetual attack → loses', () => {
  const positions = play(MIXED_START, 'red', repeat(MIXED_CYCLE, 2))
  const verdict = firstVerdict(positions)
  assert.equal(verdict?.status, REPETITION_STATUS.PERPETUAL_CHASE)
  assert.equal(verdict?.loser, 'red')
})

test('check + chase of DIFFERENT pieces is not counted as perpetual chase (leans to draw)', () => {
  const moves = [
    { check: true, chased: [] },
    { check: false, chased: ['b-h1'] },
    { check: true, chased: [] },
    { check: false, chased: ['b-c2'] },
  ]
  assert.equal(sideVerdict(moves), 'none')
  assert.equal(sideVerdict(moves.map((m, i) => (i === 3 ? { ...m, chased: ['b-h1'] } : m))), 'chase')
})

test('a single ordinary move in the span clears the side', () => {
  assert.equal(sideVerdict([{ check: true, chased: [] }, { check: false, chased: [] }]), 'none')
  assert.equal(sideVerdict([{ check: true, chased: [] }, { check: true, chased: [] }]), 'check')
})

test('outcome table', () => {
  const D = REPETITION_STATUS
  const cases = [
    ['check', 'none', D.PERPETUAL_CHECK, 'red'],
    ['none', 'check', D.PERPETUAL_CHECK, 'black'],
    ['chase', 'none', D.PERPETUAL_CHASE, 'red'],
    ['none', 'chase', D.PERPETUAL_CHASE, 'black'],
    ['check', 'chase', D.PERPETUAL_CHECK, 'red'], // check vs chase: checker loses
    ['chase', 'check', D.PERPETUAL_CHECK, 'black'],
    ['check', 'check', D.DRAW, null],
    ['chase', 'chase', D.DRAW, null],
    ['none', 'none', D.DRAW, null],
  ]
  for (const [red, black, status, loser] of cases) {
    assert.deepEqual(decideOutcome(red, black), { status, loser }, `${red} vs ${black}`)
  }
})
