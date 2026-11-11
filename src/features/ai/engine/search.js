// The bot's "thinking": alpha-beta search (negamax form) with iterative
// deepening, a quiescence search for capture sequences, and the game's
// repetition rule (perpetual check / chase). Depth is counted in plies (half-moves): depth 4 = bot, player,
// bot, player.
//
// Rules come only from the existing engine (via moveGen.js → moveUtils.js's
// isFullyLegalMove, and gameLogic.js's movePiece), so the bot can never play
// a move a human couldn't. Everything here is pure — the real board passed
// in is never mutated; each explored position is a fresh array.
import { movePiece, otherTurn } from '../../game/gameLogic.js'
import { isInCheck } from '../../game/utils/checkUtils.js'
import { generateLegalMoves, generatePseudoLegalMoves } from './moveGen.js'
import { evaluate, pieceValue } from './evaluate.js'
import { judgeSpan } from '../../game/utils/repetitionUtils.js'

const INFINITY = 1_000_000
const MATE = 100_000
const MAX_QUIESCENCE_PLIES = 6
const MAX_EXTENDED_PLY = 10

class SearchTimeout extends Error {}

// Canonical key for "same position, same side to move". movePiece keeps the
// remaining pieces in their original order, so ids in array order are stable.
export function positionKey(pieces, side) {
  let key = side
  for (const p of pieces) key += `${p.id}${p.col}${p.row}`
  return key
}

// Captures first, most valuable victim / least valuable attacker; then the
// remembered best move of this position (from the previous iteration) on top.
function orderMoves(moves, preferred) {
  const scored = moves.map((m) => {
    let score = m.captured ? 10 * pieceValue(m.captured.type) - pieceValue(m.piece.type) + 10_000 : 0
    if (preferred && m.pieceId === preferred.pieceId && m.col === preferred.col && m.row === preferred.row) {
      score = 1_000_000
    }
    return { m, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.m)
}

// A position judged by the repetition rule: decisive, but always below a
// real mate so the bot still prefers mating to winning on repetition.
const REPETITION_DECISIVE = 50_000

// The game so far plus the line being searched, as one stack of positions,
// with an index to find "this position was already reached" in O(1).
function createLine(historyPositions) {
  const positions = [] // { pieces, side }
  const keys = []
  const indicesByKey = new Map()

  function push(pieces, side, key) {
    positions.push({ pieces, side })
    keys.push(key)
    const indices = indicesByKey.get(key)
    if (indices) indices.push(positions.length - 1)
    else indicesByKey.set(key, [positions.length - 1])
  }
  function pop() {
    const key = keys.pop()
    positions.pop()
    const indices = indicesByKey.get(key)
    indices.pop()
    if (indices.length === 0) indicesByKey.delete(key)
  }
  function lastIndexOf(key) {
    const indices = indicesByKey.get(key)
    return indices ? indices[indices.length - 1] : -1
  }

  historyPositions.forEach((p) => push(p.pieces, p.side, positionKey(p.pieces, p.side)))
  return { positions, keys, push, pop, lastIndexOf }
}

function createSearcher({ deadline, historyPositions }) {
  let nodes = 0
  const bestMoveByKey = new Map() // position key → best move found (move ordering across iterations)
  const line = createLine(historyPositions)
  const repetitionCache = new Map()

  // Reaching a position already on the line (earlier in the game or in this
  // search) closes a cycle. Score it with the SAME rule the game applies
  // (repetitionUtils.js): if the cycle would be judged perpetual check /
  // chase, the side at fault loses; otherwise it's a draw. Judged on one
  // cycle — i.e. one repetition early — so the bot steers clear of a
  // forbidden repetition before the game would actually rule on it.
  function repetitionScore(fromIndex, pieces, side, key) {
    const cacheKey = `${line.keys.slice(fromIndex).join('/')}/${key}`
    let loser = repetitionCache.get(cacheKey)
    if (loser === undefined) {
      loser = judgeSpan([...line.positions.slice(fromIndex), { pieces, side }]).loser
      repetitionCache.set(cacheKey, loser)
    }
    if (!loser) return 0
    return loser === side ? -REPETITION_DECISIVE : REPETITION_DECISIVE
  }

  function tick() {
    nodes++
    if ((nodes & 255) === 0 && performance.now() > deadline) throw new SearchTimeout()
  }

  // Only captures, until the position is quiet — so the search never stops
  // in the middle of an exchange and misjudges a hanging piece.
  function quiesce(pieces, side, alpha, beta, qply) {
    tick()
    const standPat = evaluate(pieces, side)
    if (standPat >= beta) return standPat
    if (standPat > alpha) alpha = standPat
    if (qply >= MAX_QUIESCENCE_PLIES) return alpha

    const captures = orderMoves(generatePseudoLegalMoves(pieces, side, { capturesOnly: true }))
    for (const m of captures) {
      const next = movePiece(pieces, m.pieceId, m.col, m.row)
      if (isInCheck(next, side)) continue // illegal: would leave own general in check
      const score = -quiesce(next, otherTurn(side), -beta, -alpha, qply + 1)
      if (score >= beta) return score
      if (score > alpha) alpha = score
    }
    return alpha
  }

  function negamax(pieces, side, depth, alpha, beta, ply) {
    tick()
    const key = positionKey(pieces, side)

    // Repetition, judged by the game's own rule (see repetitionScore): the
    // bot never loops forever, never walks into a perpetual check/chase it
    // would be punished for, and does steer the opponent into one.
    if (ply > 0) {
      const earlier = line.lastIndexOf(key)
      if (earlier >= 0) return repetitionScore(earlier, pieces, side, key)
    }

    if (depth <= 0) return quiesce(pieces, side, alpha, beta, 0)

    const moves = generatePseudoLegalMoves(pieces, side)

    line.push(pieces, side, key)
    let best = -INFINITY
    let bestMove = null
    let legalCount = 0
    try {
      for (const m of orderMoves(moves, bestMoveByKey.get(key))) {
        const next = movePiece(pieces, m.pieceId, m.col, m.row)
        // The second half of isFullyLegalMove, applied lazily: a move that
        // leaves the mover's own general in check is illegal — skip it.
        if (isInCheck(next, side)) continue
        legalCount++
        // Check extension: don't stop the search with a side in check (so a
        // mate right at the horizon is still seen). Capped so long checking
        // sequences can't run away.
        const extension = depth === 1 && ply < MAX_EXTENDED_PLY && isInCheck(next, otherTurn(side)) ? 1 : 0
        const score = -negamax(next, otherTurn(side), depth - 1 + extension, -beta, -alpha, ply + 1)
        if (score > best) {
          best = score
          bestMove = m
        }
        if (score > alpha) alpha = score
        if (alpha >= beta) break
      }
    } finally {
      line.pop()
    }
    // No legal move = loss in Xiangqi, whether checkmated or stalemated.
    // Prefer the quickest win / slowest loss.
    if (legalCount === 0) return -MATE + ply
    if (bestMove) bestMoveByKey.set(key, bestMove)
    return best
  }

  // Scores every root move. With `noiseMargin` = 0 this is a normal
  // alpha-beta root (only the best move's score is exact). With noise, a
  // move can only be picked if its true score is within 2×noise of the best
  // (noise shifts each score by at most ±noise), so every move is searched
  // exactly down to (best − margin) and anything below is just "too bad" —
  // far cheaper than scoring every move exactly.
  function searchRoot(pieces, side, depth, rootMoves, noiseMargin) {
    const key = positionKey(pieces, side)
    line.push(pieces, side, key)
    const results = []
    let alpha = -INFINITY
    try {
      for (const m of orderMoves(rootMoves, bestMoveByKey.get(key))) {
        const next = movePiece(pieces, m.pieceId, m.col, m.row)
        const lowerBound = alpha === -INFINITY ? -INFINITY : alpha - noiseMargin
        const score = -negamax(next, otherTurn(side), depth - 1, -INFINITY, -lowerBound, 1)
        results.push({ move: m, score })
        if (score > alpha) alpha = score
      }
    } finally {
      line.pop()
    }
    results.sort((a, b) => b.score - a.score)
    bestMoveByKey.set(key, results[0].move)
    return results
  }

  return {
    searchRoot,
    get nodes() {
      return nodes
    },
  }
}

// Picks a move for `side` on `pieces`.
//   maxDepth   — deepest iteration (plies)
//   timeMs     — soft budget; the search stops and keeps the last completed depth
//   noise      — random spread (≈ centipawns) added to root scores; >0 makes
//                weaker levels sometimes pick a worse move, like a human
//   history    — the positions played in this game BEFORE the current one,
//                as [{ pieces, side to move }] (for the repetition rule)
//   random     — injectable RNG (tests)
// Returns { move: { pieceId, col, row }, score, depth, nodes } or null if
// `side` has no legal move.
export function chooseMove(pieces, side, { maxDepth = 3, timeMs = 2000, noise = 0, history = [], random = Math.random } = {}) {
  const rootMoves = generateLegalMoves(pieces, side)
  if (rootMoves.length === 0) return null

  const start = performance.now()
  const searcher = createSearcher({ deadline: start + timeMs, historyPositions: history })
  const noiseMargin = 2 * noise

  let completed = null
  let completedDepth = 0
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      completed = searcher.searchRoot(pieces, side, depth, rootMoves, noiseMargin)
      completedDepth = depth
    } catch (error) {
      if (!(error instanceof SearchTimeout)) throw error
      break // keep the last fully searched depth
    }
    if (Math.abs(completed[0].score) >= MATE - 1000) break // forced mate found
  }

  // Even depth 1 couldn't finish in time (very slow device): fall back to
  // the best-looking capture/first move rather than nothing.
  if (!completed) {
    const fallback = orderMoves(rootMoves)[0]
    return { move: pick(fallback), score: 0, depth: 0, nodes: searcher.nodes }
  }

  let chosen = completed[0]
  if (noise > 0) {
    // Never throw away a forced mate, and never pick a move that walks into one.
    const noisy = completed
      .filter((r) => r.score > -MATE + 1000)
      .map((r) => ({ ...r, noisy: r.score >= MATE - 1000 ? r.score * 10 : r.score + (random() * 2 - 1) * noise }))
    if (noisy.length > 0) {
      noisy.sort((a, b) => b.noisy - a.noisy)
      chosen = noisy[0]
    }
  }

  return { move: pick(chosen.move), score: chosen.score, depth: completedDepth, nodes: searcher.nodes }
}

function pick(m) {
  return { pieceId: m.pieceId, col: m.col, row: m.row }
}
