// Phân tích ván (src/features/analysis): the bot's verdict per position, the
// grading of each move against the best one at the same depth, and what is
// kept in the browser. Searches here are depth-limited with no time limit,
// so they're deterministic.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { P, clone } from '../helpers/board.js'
import { createMoveEntry } from '../../src/features/game/utils/moveEntry.js'
import { INITIAL_PIECES } from '../../src/features/game/initialPosition.js'
import { analyzeMoves } from '../../src/features/ai/engine/search.js'
import {
  gamePositions,
  analyzePosition,
  gradeMove,
  gradeGame,
  summarize,
  bestMoveAt,
  formatScore,
  barShare,
  ANALYSIS_VERSION,
} from '../../src/features/analysis/analysis.js'

const SETTINGS = { maxDepth: 3, timeMs: Infinity }
const move = (pieces, id, col, row, ply = 1) => createMoveEntry(pieces, pieces.find((p) => p.id === id), col, row, ply)

// One position (red to move) and the move played in it, analysed and graded.
function gradeOne(pieces, played) {
  const positions = [{ pieces, side: played.turn }]
  const evaluation = analyzePosition(positions, 0, played, SETTINGS)
  return { evaluation, grade: gradeMove([played], [evaluation], 0, positions) }
}

test('the positions of a game: the start, then one after every move', () => {
  const m1 = move(INITIAL_PIECES, 'r-c2', 4, 7)
  const m2 = move(m1.piecesAfter, 'b-h1', 2, 2, 2)
  const positions = gamePositions([m1, m2])
  assert.equal(positions.length, 3)
  assert.deepEqual(
    positions.map((p) => p.side),
    ['red', 'black', 'red']
  )
  assert.equal(positions[2].pieces, m2.piecesAfter)
})

test('the best move and the move played are scored at the same depth', () => {
  const pieces = clone(INITIAL_PIECES)
  const best = analyzeMoves(pieces, 'red', null, SETTINGS)
  const same = analyzeMoves(pieces, 'red', best.move, SETTINGS)
  assert.equal(same.playedScore, same.score, 'playing the best move loses nothing')
  assert.equal(best.playedScore, null, 'no played move, no played score')
  assert.ok(same.depth === 3)
})

test('leaving a free horse en prise to take is a blunder, with the capture as the better move', () => {
  // Generals on different files, out of the rook's reach: no checks to play.
  const pieces = [
    P('r-g', 'red', 'general', 3, 9),
    P('b-g', 'black', 'general', 5, 0),
    P('r-r', 'red', 'rook', 0, 9),
    P('b-h', 'black', 'horse', 0, 4),
  ]
  const { evaluation, grade } = gradeOne(pieces, move(pieces, 'r-r', 0, 8))
  assert.deepEqual(evaluation.best, { pieceId: 'r-r', col: 0, row: 4 })
  assert.ok(grade.loss >= 300, `loss ${grade.loss}`)
  assert.equal(grade.grade, 'blunder')
  assert.deepEqual(grade.best, { from: { col: 0, row: 9 }, to: { col: 0, row: 4 } })
  assert.ok(grade.bestNotation, 'names the better move')

  // Taking it instead: the best move, nothing to flag.
  const taken = gradeOne(pieces, move(pieces, 'r-r', 0, 4)).grade
  assert.equal(taken.loss, 0)
  assert.equal(taken.grade, null)
  assert.equal(taken.best, null)
})

test('a move that lets the opponent mate is a blunder even when material says otherwise', () => {
  // Black threatens R(8,4)-(8,9) mate; red's rook on (8,7) blocks it. Sent
  // off to (1,7) it can no longer get between in time.
  const pieces = [
    P('r-g', 'red', 'general', 3, 9),
    P('b-g', 'black', 'general', 4, 0),
    P('b-r1', 'black', 'rook', 0, 8),
    P('b-r2', 'black', 'rook', 8, 4),
    P('r-r', 'red', 'rook', 8, 7),
  ]
  const { evaluation, grade } = gradeOne(pieces, move(pieces, 'r-r', 1, 7))
  assert.ok(evaluation.played.mate < 0, `black mates after it (mate ${evaluation.played.mate})`)
  assert.equal(grade.allowedMate, true)
  assert.equal(grade.grade, 'blunder')
})

test('a forced mate is reported as one, and the mated position as a win', () => {
  const pieces = [
    P('b-g', 'black', 'general', 3, 0),
    P('r-g', 'red', 'general', 4, 9),
    P('r-r1', 'red', 'rook', 0, 1),
    P('r-r2', 'red', 'rook', 8, 5),
  ]
  const mating = move(pieces, 'r-r2', 8, 0)
  const positions = [
    { pieces, side: 'red' },
    { pieces: mating.piecesAfter, side: 'black' },
  ]
  const before = analyzePosition(positions, 0, mating, SETTINGS)
  assert.equal(before.mate, 1, 'mate in one (R8-9 here, and another rook move mates too)')
  assert.equal(formatScore(before), 'Đỏ chiếu bí sau 1 nước')
  assert.equal(barShare(before), 1)

  const after = analyzePosition(positions, 1, null, SETTINGS)
  assert.equal(after.mate, 0)
  assert.equal(after.best, null)
  assert.ok(after.score > 0, 'red won')
  assert.equal(formatScore(after), 'Đỏ thắng')
  assert.equal(bestMoveAt(positions, [before, after], 1), null)
  assert.ok(bestMoveAt(positions, [before, after], 0).notation)
})

test('a whole short game: every move graded, the counts add up', () => {
  const history = []
  let pieces = INITIAL_PIECES
  const play = (id, col, row) => {
    const entry = move(pieces, id, col, row, history.length + 1)
    history.push(entry)
    pieces = entry.piecesAfter
  }
  play('r-c2', 4, 7) // P2-5
  play('b-h1', 2, 2)
  play('r-c2', 4, 3) // cannon takes the centre pawn…
  play('b-h1', 4, 3) // …and is taken back: red gave a cannon for a pawn
  const positions = gamePositions(history)
  const evals = positions.map((_, i) => analyzePosition(positions, i, history[i] ?? null, SETTINGS))
  const grades = gradeGame(history, evals)
  assert.equal(grades.length, 4)
  grades.forEach((g) => assert.ok(g && Number.isFinite(g.loss)))
  assert.ok(grades[2].grade === 'blunder', `the cannon sacrifice: ${JSON.stringify(grades[2])}`)
  const summary = summarize(history, grades)
  const flagged = grades.filter((g) => g.grade).length
  const counted = ['red', 'black'].reduce((n, side) => n + Object.values(summary[side]).reduce((a, b) => a + b, 0), 0)
  assert.equal(counted, flagged)
  assert.ok(summary.red.blunder >= 1)
})

test('score labels and the bar', () => {
  assert.equal(formatScore({ score: 84, mate: null }), '+80')
  assert.equal(formatScore({ score: -456, mate: null }), '−460')
  assert.equal(formatScore({ score: 3, mate: null }), '0')
  assert.equal(formatScore({ score: -99990, mate: -3 }), 'Đen chiếu bí sau 3 nước')
  assert.equal(barShare(undefined), 0.5)
  assert.equal(barShare({ score: 0, mate: null }), 0.5)
  assert.ok(barShare({ score: 400, mate: null }) > 0.7)
  assert.ok(barShare({ score: -900, mate: null }) < 0.1)
})

test('saved analyses: only the current version is loaded, the oldest beyond 20 are dropped', async () => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  }
  const { loadAnalyses, saveAnalyses } = await import('../../src/features/analysis/analysisStorage.js')
  const evaluation = { score: 10, mate: null, best: null, depth: 3, played: null }
  saveAnalyses({
    1: { version: ANALYSIS_VERSION, savedAt: 1, evals: [evaluation] },
    2: { version: ANALYSIS_VERSION - 1, savedAt: 2, evals: [evaluation] },
    3: { version: ANALYSIS_VERSION, savedAt: 3, evals: [{ nope: true }] },
  })
  assert.deepEqual(Object.keys(loadAnalyses()), ['1'])
  store.set('xiangbattle_game_analysis', '{not json')
  assert.deepEqual(loadAnalyses(), {})

  const { default: reducer, saveGameAnalysis } = await import('../../src/store/slices/analysisSlice.js')
  let state = { byGameId: {} }
  for (let id = 1; id <= 22; id++) state = reducer(state, saveGameAnalysis({ gameId: id, evals: [evaluation], savedAt: id }))
  const ids = Object.keys(state.byGameId).map(Number).sort((a, b) => a - b)
  assert.equal(ids.length, 20)
  assert.deepEqual(ids.slice(0, 2), [3, 4], 'games 1 and 2 (oldest) dropped')
  delete globalThis.localStorage
})
