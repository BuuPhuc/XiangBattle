// Shared helpers for the Cờ thế dev tool (puzzle-tool.mjs). Dev-only: never
// imported by the app. Uses the app's own rules and solver, so a position
// that passes here is judged exactly the same way on the site.
import { otherTurn } from '../../src/features/game/gameLogic.js'
import { isInCheck, generalsFacingEachOther } from '../../src/features/game/utils/checkUtils.js'
import { hasAnyLegalMove } from '../../src/features/game/utils/moveUtils.js'
import { createMoveEntry } from '../../src/features/game/utils/moveEntry.js'
import { createSolver, solutionLine, applyMove } from '../../src/features/puzzles/engine/solver.js'
import { PIECE_CHARS } from '../../src/features/academy/constants.js'

export const NAME = { rook: 'Xe', horse: 'Mã', cannon: 'Pháo', pawn: 'Tốt', advisor: 'Sĩ', elephant: 'Tượng', general: 'Tướng' }
export const ACTIVE = new Set(['rook', 'horse', 'cannon', 'pawn'])
const MAX = { general: 1, advisor: 2, elephant: 2, horse: 2, rook: 2, cannon: 2, pawn: 5 }

export function toPieces(list) {
  return list.map((p, i) => ({ ...p, id: `${p.side}-${p.type}-${i}`, char: PIECE_CHARS[p.side][p.type] }))
}

// Could this piece stand here in a real game? (palace, elephant points on
// its own side, an uncrossed pawn only on its file's start / one-step square)
export function legalSquare({ side, type, col, row }) {
  const r = side === 'red' ? row : 9 - row // red-relative row
  switch (type) {
    case 'general':
      return col >= 3 && col <= 5 && r >= 7
    case 'advisor':
      return [[3, 9], [5, 9], [4, 8], [3, 7], [5, 7]].some(([c, rr]) => c === col && rr === r)
    case 'elephant':
      return [[2, 9], [6, 9], [0, 7], [4, 7], [8, 7], [2, 5], [6, 5]].some(([c, rr]) => c === col && rr === r)
    case 'pawn':
      return r <= 4 || ((r === 5 || r === 6) && col % 2 === 0)
    default:
      return true
  }
}

// The hard requirements — the same ones tests/rules/puzzles.test.js
// enforces. Returns a list of problems (empty = valid puzzle).
export function validate(pieces, attacker, moves) {
  const problems = []
  const defender = otherTurn(attacker)
  if (new Set(pieces.map((p) => `${p.col},${p.row}`)).size !== pieces.length) problems.push('two pieces on one square')
  for (const side of ['red', 'black']) {
    for (const [type, max] of Object.entries(MAX)) {
      const n = pieces.filter((p) => p.side === side && p.type === type).length
      if (n > max) problems.push(`${n} ${side} ${type}`)
    }
    if (pieces.filter((p) => p.side === side && p.type === 'general').length !== 1) problems.push(`${side} needs one general`)
  }
  for (const p of pieces) if (!legalSquare(p)) problems.push(`${p.side} ${p.type} can't stand on ${p.col},${p.row}`)
  if (problems.length) return { problems }
  if (generalsFacingEachOther(pieces)) problems.push('generals face each other')
  if (isInCheck(pieces, defender)) problems.push('side not to move is in check')
  if (isInCheck(pieces, attacker)) problems.push('side to move starts in check')
  if (problems.length) return { problems }

  const solver = createSolver()
  const distance = solver.mateDistance(pieces, attacker, moves)
  if (distance !== moves) return { problems: [distance === null ? `no forced mate in ${moves}` : `mate already in ${distance}`] }
  const keys = solver.winningMoves(pieces, attacker, moves)
  if (keys.length !== 1) problems.push(`${keys.length} key moves (need exactly 1)`)
  const line = solutionLine(pieces, attacker, moves, solver)
  let end = pieces
  for (const m of line) end = applyMove(end, m)
  if (!(isInCheck(end, defender) && !hasAnyLegalMove(end, defender))) problems.push('solution does not end in checkmate')
  return { problems, line, solver }
}

// Soft quality signals (what the visual review looked at), not hard rules:
//   superfluousAttackers — the attacker's active pieces that could be removed
//     with the puzzle still a mate in exactly N (the title would overstate)
//   idleDefenders — defending rooks/horses/cannons/pawns that change nothing
//     (advisors / elephants on their home squares are natural, not counted)
//   backRankPawns — pawns sitting on the far back rank
//   keyIsCheck — the first move gives check (quiet keys are usually prettier)
export function quality(pieces, attacker, moves) {
  const defender = otherTurn(attacker)
  const stillSame = (rest) => {
    if (isInCheck(rest, defender) || isInCheck(rest, attacker)) return false
    const s = createSolver()
    return s.mateDistance(rest, attacker, moves) === moves && s.winningMoves(rest, attacker, moves).length === 1
  }
  const superfluousAttackers = []
  const idleDefenders = []
  for (const p of pieces) {
    if (!ACTIVE.has(p.type)) continue
    const rest = pieces.filter((x) => x !== p)
    if (p.side === attacker && stillSame(rest)) superfluousAttackers.push(p)
    if (p.side === defender && stillSame(rest)) idleDefenders.push(p)
  }
  const backRankPawns = pieces.filter((p) => p.type === 'pawn' && ((p.side === 'red' && p.row === 0) || (p.side === 'black' && p.row === 9)))
  const solver = createSolver()
  const line = solutionLine(pieces, attacker, moves, solver)
  const keyIsCheck = line ? isInCheck(applyMove(pieces, line[0]), defender) : false
  return { superfluousAttackers, idleDefenders, backRankPawns, keyIsCheck }
}

// Notation of a line, e.g. "M3.2+ Tg6.1 P9-4+".
export function notate(pieces, line) {
  let board = pieces
  return line
    .map((m, i) => {
      const piece = board.find((p) => p.col === m.from[0] && p.row === m.from[1])
      const entry = createMoveEntry(board, piece, m.to[0], m.to[1], i + 1)
      board = entry.piecesAfter
      return entry.notation + (isInCheck(board, otherTurn(piece.side)) ? '+' : '')
    })
    .join(' ')
}

export function titleFor(pieces, attacker) {
  const counts = {}
  for (const p of pieces) if (p.side === attacker && ACTIVE.has(p.type)) counts[NAME[p.type]] = (counts[NAME[p.type]] ?? 0) + 1
  return Object.entries(counts)
    .map(([name, c]) => (c === 2 ? `Song ${name}` : c === 3 ? `Tam ${name}` : name))
    .join(' – ')
}

// 180° turn with colours swapped: a Red-to-move puzzle becomes the same
// puzzle with Black to move (the rules are symmetric).
export function mirror(list) {
  return list.map(({ side, type, col, row }) => ({ side: side === 'red' ? 'black' : 'red', type, col: 8 - col, row: 9 - row }))
}

export function asDataLine(id, moves, toMove, list) {
  const pieces = list.map(({ side, type, col, row }) => `${side}('${type}', ${col}, ${row})`).join(', ')
  return `  { id: '${id}', moves: ${moves}, toMove: '${toMove}', title: '${titleFor(toPieces(list), toMove)}', pieces: [${pieces}] },`
}

export function asciiBoard(list, flipped = false) {
  const CH = { general: 'K', advisor: 'A', elephant: 'E', horse: 'H', rook: 'R', cannon: 'C', pawn: 'P' }
  const grid = Array.from({ length: 10 }, () => Array(9).fill('.'))
  for (const { side, type, col, row } of list) {
    const c = flipped ? 8 - col : col
    const r = flipped ? 9 - row : row
    grid[r][c] = side === 'red' ? CH[type] : CH[type].toLowerCase()
  }
  return grid.map((r) => '    ' + r.join(' ')).join('\n')
}
