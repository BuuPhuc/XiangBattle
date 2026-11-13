// Cờ thế solver — exact, not heuristic. Answers "can the attacker FORCE a
// win within n moves?" by trying every attacker move and, after it, EVERY
// legal defence: a move only counts if no defence at all escapes. (The
// bot's search can't do this: it is time-limited and scores positions, so
// it never proves anything.)
//
// Rules are never re-implemented: legal moves come from the bot's fast
// generator, which yields exactly the game's own legal-move set (shape,
// blocking, cannon screens, palace, river, flying general, no self-check —
// see ai/engine/moveGen.js and its perft / cross-check tests).
//
// "Win" = the side to move has no legal move: checkmate, or stalemate,
// which in Xiangqi is a loss too (same as the game itself — useGame /
// server referee). Repetition can't arise within a puzzle's few moves.
//
// Pure functions, no React / browser APIs: runs in the puzzle Web Worker and
// in node tests. Moves are { from: [col, row], to: [col, row] }.
import { movePiece, otherTurn } from '../../game/gameLogic.js'
import { isInCheck } from '../../game/utils/checkUtils.js'
import { isFullyLegalMove } from '../../game/utils/moveUtils.js'
import { generateLegalMoves, generatePseudoLegalMoves } from '../../ai/engine/moveGen.js'

function positionKey(pieces, side) {
  const cells = pieces.map((p) => `${p.side[0]}${p.type[0]}${p.type === 'cannon' ? 'n' : ''}${p.col}${p.row}`)
  cells.sort()
  return `${side}:${cells.join('')}`
}

function hasAnyLegalMove(pieces, side) {
  for (const m of generatePseudoLegalMoves(pieces, side)) {
    if (isFullyLegalMove(m.piece, m.col, m.row, pieces)) return true
  }
  return false
}

const toMove = (m) => ({ from: [m.piece.col, m.piece.row], to: [m.col, m.row] })

// Checking moves first, then captures: mates are almost always found among
// them, which makes the OR-search stop early. Order never changes results.
function orderAttackerMoves(pieces, attacker, moves) {
  const defender = otherTurn(attacker)
  const scored = moves.map((m) => {
    const next = movePiece(pieces, m.pieceId, m.col, m.row)
    return { m, next, score: (isInCheck(next, defender) ? 2 : 0) + (m.captured ? 1 : 0) }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored
}

export function createSolver() {
  // attacker-to-move positions → can force a win within n (by key|n)
  const cache = new Map()
  let nodes = 0

  // Attacker to move: is there a move that wins within n attacker moves?
  function attackerWins(pieces, attacker, n) {
    if (n <= 0) return false
    const key = `${positionKey(pieces, attacker)}|${n}`
    const known = cache.get(key)
    if (known !== undefined) return known
    nodes++

    const defender = otherTurn(attacker)
    let result = false
    for (const { next } of orderAttackerMoves(pieces, attacker, generateLegalMoves(pieces, attacker))) {
      if (defenderLoses(next, defender, attacker, n - 1)) {
        result = true
        break
      }
    }
    cache.set(key, result)
    return result
  }

  // Defender to move, attacker then has `remaining` moves: does EVERY
  // defence lose? (No defence at all = already lost.)
  function defenderLoses(pieces, defender, attacker, remaining) {
    if (remaining <= 0) return !hasAnyLegalMove(pieces, defender)
    const replies = generateLegalMoves(pieces, defender)
    if (replies.length === 0) return true
    for (const r of replies) {
      if (!attackerWins(movePiece(pieces, r.pieceId, r.col, r.row), attacker, remaining)) return false
    }
    return true
  }

  // Smallest n ≤ maxMoves within which the attacker (to move) forces a win,
  // or null if there is none.
  function mateDistance(pieces, attacker, maxMoves) {
    for (let n = 1; n <= maxMoves; n++) if (attackerWins(pieces, attacker, n)) return n
    return null
  }

  // Every attacker move that still forces a win within `remaining` moves
  // (the move itself counts as one).
  function winningMoves(pieces, attacker, remaining) {
    const defender = otherTurn(attacker)
    return generateLegalMoves(pieces, attacker)
      .filter((m) => defenderLoses(movePiece(pieces, m.pieceId, m.col, m.row), defender, attacker, remaining - 1))
      .map(toMove)
  }

  // The defence that holds out longest (defender to move; the attacker has
  // `remaining` moves left). Among equally long ones, the first in the
  // generator's fixed order — so the reply is deterministic.
  function bestDefence(pieces, defender, attacker, remaining) {
    let best = null
    let bestDistance = -1
    for (const r of generateLegalMoves(pieces, defender)) {
      const next = movePiece(pieces, r.pieceId, r.col, r.row)
      const distance = mateDistance(next, attacker, remaining) ?? Number.POSITIVE_INFINITY
      if (distance > bestDistance) {
        best = r
        bestDistance = distance
      }
    }
    return best ? toMove(best) : null
  }

  return {
    attackerWins,
    defenderLoses,
    mateDistance,
    winningMoves,
    bestDefence,
    get nodes() {
      return nodes
    },
  }
}

export const MOVE_VERDICT = {
  // The move ends the game: the defender has no legal move left.
  WIN: 'win',
  // Still wins by force; `reply` is the defender's best answer.
  CORRECT: 'correct',
  // Some defence escapes (or the move isn't legal at all).
  WRONG: 'wrong',
}

function pieceAt(pieces, [col, row]) {
  return pieces.find((p) => p.col === col && p.row === row) ?? null
}

function applyMove(pieces, move) {
  const piece = pieceAt(pieces, move.from)
  return movePiece(pieces, piece.id, move.to[0], move.to[1])
}

// Judges the attacker's `move` with `remaining` moves left (this one
// included). Accepted only if EVERY legal defence still loses in time —
// never because one particular reply happens to lose.
export function judgeMove(pieces, attacker, move, remaining, solver = createSolver()) {
  const piece = pieceAt(pieces, move.from)
  if (!piece || piece.side !== attacker || !isFullyLegalMove(piece, move.to[0], move.to[1], pieces)) {
    return { verdict: MOVE_VERDICT.WRONG }
  }
  const defender = otherTurn(attacker)
  const next = applyMove(pieces, move)
  if (!hasAnyLegalMove(next, defender)) return { verdict: MOVE_VERDICT.WIN }
  if (remaining <= 1 || !solver.defenderLoses(next, defender, attacker, remaining - 1)) {
    return { verdict: MOVE_VERDICT.WRONG }
  }
  return { verdict: MOVE_VERDICT.CORRECT, reply: solver.bestDefence(next, defender, attacker, remaining - 1) }
}

// A move that wins fastest (for "Gợi ý"), or null.
export function findHintMove(pieces, attacker, remaining, solver = createSolver()) {
  const distance = solver.mateDistance(pieces, attacker, remaining)
  if (distance === null) return null
  return solver.winningMoves(pieces, attacker, distance)[0] ?? null
}

// A full solution line from `pieces` (for "Xem lời giải"): the attacker's
// fastest win, the defender's longest defence, and so on until the end.
export function solutionLine(pieces, attacker, remaining, solver = createSolver()) {
  const defender = otherTurn(attacker)
  const line = []
  let current = pieces
  let left = remaining
  while (left > 0) {
    const move = findHintMove(current, attacker, left, solver)
    if (!move) return null
    line.push(move)
    current = applyMove(current, move)
    left--
    if (!hasAnyLegalMove(current, defender)) return line
    const reply = solver.bestDefence(current, defender, attacker, left)
    line.push(reply)
    current = applyMove(current, reply)
  }
  return null
}

export { applyMove, hasAnyLegalMove }
