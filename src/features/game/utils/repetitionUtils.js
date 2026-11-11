// Repetition rules: perpetual check (chiếu dai), perpetual chase (đuổi dai)
// and draw by repetition. A simplified version of the Asian Xiangqi
// Federation (AXF) rules — see "Known simplifications" at the bottom.
// Pure functions, shared by the server referee (online games), useGame
// (local and bot games) and the bot's search, so every mode judges a
// repetition exactly the same way.
//
// Data: `positions` is the game as a list of { pieces, side } — the board
// and the side to move — from the start position to the current one.
// The move between positions[i] and positions[i + 1] was made by
// positions[i].side.
//
// The rule, as agreed:
//  1. Only when the current position occurs for the 3rd time is anything
//     judged. A 3rd occurrence on its own is NOT a draw.
//  2. Every move each side made since the first of those three occurrences
//     (two full cycles) is classified: check, chase, or ordinary.
//  3. A side is
//       - "perpetual check" if every one of its moves is a check;
//       - "perpetual chase" (đánh dai) if every move is a check or a chase,
//         at least one is a chase, and all its chase moves threaten the
//         SAME opponent piece;
//       - otherwise not at fault.
//  4. Outcome: one side at fault → it loses; both perpetually checking or
//     both chasing → draw; check against chase → the checking side loses;
//     neither at fault → draw by repetition.
// When the rule is unclear the judgement leans to a draw rather than a loss.
import { movePiece, otherTurn } from '../gameLogic.js'
import { isInCheck } from './checkUtils.js'
import { isFullyLegalMove } from './moveUtils.js'

// Values match GAME_STATUS in gameLogic.js and server/rooms/room.js.
export const REPETITION_STATUS = {
  PERPETUAL_CHECK: 'perpetual-check',
  PERPETUAL_CHASE: 'perpetual-chase',
  DRAW: 'repetition-draw',
}

const OCCURRENCES_TO_JUDGE = 3

// "Same position" = same pieces (by side and type, not by id) on the same
// squares, same side to move. Order-independent.
export function repetitionKey(pieces, side) {
  return `${side}|${pieces
    .map((p) => `${p.side[0]}${p.type}${p.col}${p.row}`)
    .sort()
    .join(',')}`
}

function hasCrossedRiver(piece) {
  return piece.side === 'red' ? piece.row <= 4 : piece.row >= 5
}

// After `attacker` captured `target`, could the target's side legally take
// back on that square? Uses the full legality check, so a defender that is
// pinned (or a general that would face the other general) doesn't count.
function isProtected(pieces, attacker, target) {
  const afterCapture = movePiece(pieces, attacker.id, target.col, target.row)
  return afterCapture.some((p) => p.side === target.side && isFullyLegalMove(p, target.col, target.row, afterCapture))
}

// What the move before → after by `mover` does:
//   { check: boolean, chased: string[] } — ids of opponent pieces it chases.
// A chase is a NEW threat to capture (the attacker could not already take
// that piece before the move) that is a real, legal capture, where:
//   - the attacker is not a general or a pawn (both may attack freely);
//   - the target is not the general (that's check) nor a pawn that hasn't
//     crossed the river;
//   - the target is unprotected — except a horse or cannon threatening a
//     rook, which counts even if the rook is protected.
export function classifyMove(before, after, mover) {
  const opponent = otherTurn(mover)
  const check = isInCheck(after, opponent)
  const chased = []

  for (const attacker of after) {
    if (attacker.side !== mover || attacker.type === 'general' || attacker.type === 'pawn') continue
    for (const target of after) {
      if (target.side !== opponent || target.type === 'general') continue
      if (target.type === 'pawn' && !hasCrossedRiver(target)) continue
      if (!isFullyLegalMove(attacker, target.col, target.row, after)) continue

      const attackerBefore = before.find((p) => p.id === attacker.id)
      const targetBefore = before.find((p) => p.id === target.id)
      const alreadyThreatened =
        attackerBefore && targetBefore && isFullyLegalMove(attackerBefore, targetBefore.col, targetBefore.row, before)
      if (alreadyThreatened) continue

      const rookByMinor = target.type === 'rook' && (attacker.type === 'horse' || attacker.type === 'cannon')
      if (!rookByMinor && isProtected(after, attacker, target)) continue

      chased.push(target.id)
    }
  }
  return { check, chased }
}

// 'check' | 'chase' | 'none' for one side's classified moves in the span.
export function sideVerdict(moves) {
  if (moves.length === 0) return 'none'
  if (moves.every((m) => m.check)) return 'check'
  if (!moves.every((m) => m.check || m.chased.length > 0)) return 'none'

  // Every chase move must threaten the same piece. (Whether chasing
  // different pieces in turn also counts is unclear in the rules we follow,
  // so it is treated as no fault → draw, never a loss.)
  const chaseMoves = moves.filter((m) => !m.check)
  let common = new Set(chaseMoves[0].chased)
  for (const m of chaseMoves.slice(1)) common = new Set(m.chased.filter((id) => common.has(id)))
  return common.size > 0 ? 'chase' : 'none'
}

// { status, loser } from both sides' verdicts. loser is null for a draw.
export function decideOutcome(redVerdict, blackVerdict) {
  const redAtFault = redVerdict !== 'none'
  const blackAtFault = blackVerdict !== 'none'

  if (!redAtFault && !blackAtFault) return { status: REPETITION_STATUS.DRAW, loser: null }
  if (redAtFault && blackAtFault) {
    if (redVerdict === blackVerdict) return { status: REPETITION_STATUS.DRAW, loser: null }
    // Perpetual check against perpetual chase: the checking side must change.
    return { status: REPETITION_STATUS.PERPETUAL_CHECK, loser: redVerdict === 'check' ? 'red' : 'black' }
  }
  const loser = redAtFault ? 'red' : 'black'
  const verdict = redAtFault ? redVerdict : blackVerdict
  return { status: verdict === 'check' ? REPETITION_STATUS.PERPETUAL_CHECK : REPETITION_STATUS.PERPETUAL_CHASE, loser }
}

// Judges the moves of a repeating span (positions[0] … positions[last]).
// Also used by the bot on a single cycle to foresee the verdict.
export function judgeSpan(positions) {
  const moves = { red: [], black: [] }
  for (let i = 0; i < positions.length - 1; i++) {
    const mover = positions[i].side
    moves[mover].push(classifyMove(positions[i].pieces, positions[i + 1].pieces, mover))
  }
  return decideOutcome(sideVerdict(moves.red), sideVerdict(moves.black))
}

// The game-level rule: null unless the current (last) position has now
// occurred for the 3rd time; then { status, loser, winner }.
export function judgeRepetition(positions) {
  if (positions.length < 2) return null
  const last = positions[positions.length - 1]
  const key = repetitionKey(last.pieces, last.side)
  const occurrences = []
  positions.forEach((p, i) => {
    if (repetitionKey(p.pieces, p.side) === key) occurrences.push(i)
  })
  if (occurrences.length < OCCURRENCES_TO_JUDGE) return null

  const start = occurrences[occurrences.length - OCCURRENCES_TO_JUDGE]
  const { status, loser } = judgeSpan(positions.slice(start))
  return { status, loser, winner: loser ? otherTurn(loser) : null }
}

// Known simplifications (full AXF rules have many more cases):
//  - a piece chased by several attackers at once, exchange offers (the
//    attacker itself being attacked) and other special chase cases are not
//    distinguished;
//  - only "horse/cannon threatening a rook" is treated as a chase of a
//    protected piece;
//  - repetition is judged at a fixed 3rd occurrence (online-site practice),
//    not by an arbiter.
