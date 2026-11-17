// Phân tích ván: the bot (features/ai, at its "Khó" strength) scores every
// position of a finished game, then each move is graded by how much it gave
// away compared with the best move the bot found.
//
// Pure functions only — the slow part (analyzePosition, one search per
// position) runs in analysisWorker.js; grading and summarising are instant
// and run wherever the results are shown.
//
// Scores are in the bot's own points: a pawn ≈ 100, horse 400, cannon 450,
// rook 900 (ai/engine/evaluate.js), always from RED's point of view
// (+ = red is better).
import { INITIAL_PIECES } from '../game/initialPosition.js'
import { otherTurn } from '../game/gameLogic.js'
import { createMoveEntry } from '../game/utils/moveEntry.js'
import { analyzeMoves, MATE } from '../ai/engine/search.js'

// Bump when the settings or the grading change, so analyses saved in the
// browser with the old ones are redone instead of shown.
export const ANALYSIS_VERSION = 1

// Per position: the "Khó" level's depth, with a little less time (a game has
// dozens of positions to get through).
export const ANALYSIS_SETTINGS = { maxDepth: 6, timeMs: 900 }

// How much a move may give away (in points) before it is flagged.
export const THRESHOLDS = { inaccuracy: 50, mistake: 150, blunder: 300 }

// Scores beyond this count as "won" — losing 400 points while still a rook
// and more ahead is not a mistake worth flagging.
const SCORE_CAP = 1000
const MATE_ZONE = MATE - 1000

export const GRADES = {
  inaccuracy: { symbol: '?!', label: 'Không chính xác' },
  mistake: { symbol: '?', label: 'Sai lầm' },
  blunder: { symbol: '??', label: 'Nước hớ' },
}

// The positions of a game: [0] the start, [i] after moveHistory[i - 1].
// Each is { pieces, side } with `side` the side to move.
export function gamePositions(moveHistory) {
  return [
    { pieces: INITIAL_PIECES, side: 'red' },
    ...moveHistory.map((move) => ({ pieces: move.piecesAfter, side: otherTurn(move.turn) })),
  ]
}

// Mate distance (in moves) behind a score, red's point of view: > 0 red
// mates, < 0 black mates, null when the score isn't a forced mate.
function mateOf(redScore) {
  if (Math.abs(redScore) < MATE_ZONE) return null
  return Math.sign(redScore) * Math.max(1, Math.ceil((MATE - Math.abs(redScore)) / 2))
}

// The bot's verdict on positions[index], together with the move that was
// actually played there (`played`, a moveHistory entry, or null for the
// game's last position) — both searched to the same depth (analyzeMoves):
//   { score, mate, best, depth, played }
//   score  — red's point of view; a forced mate is ±MATE-ish
//   mate   — null, or moves until mate: > 0 red mates, < 0 black mates;
//            0 = the side to move has no move (checkmated / stalemated)
//   best   — { pieceId, col, row } the bot would play, or null if none
//   played — { score, mate } for the move played (red's point of view),
//            or null
// The positions before it are passed as history so the repetition rule
// (perpetual check / chase) is judged on the real game.
export function analyzePosition(positions, index, played, settings = ANALYSIS_SETTINGS) {
  const { pieces, side } = positions[index]
  const sign = side === 'red' ? 1 : -1
  const playedMove = played ? { pieceId: played.piece.id, col: played.to.col, row: played.to.row } : null
  const result = analyzeMoves(pieces, side, playedMove, { ...settings, history: positions.slice(0, index) })
  if (!result) {
    // No legal move: in Xiangqi that loses (checkmate or stalemate).
    return { score: -sign * MATE, mate: 0, best: null, depth: 0, played: null }
  }
  const score = sign * result.score
  const playedScore = result.playedScore === null ? null : sign * result.playedScore
  return {
    score,
    mate: mateOf(score),
    best: result.move,
    depth: result.depth,
    played: playedScore === null ? null : { score: playedScore, mate: mateOf(playedScore) },
  }
}

const capped = (score) => Math.max(-SCORE_CAP, Math.min(SCORE_CAP, score))
const forSide = (value, side) => (side === 'red' ? value : -value)
const sameMove = (best, move) =>
  Boolean(best) && best.pieceId === move.piece.id && best.col === move.to.col && best.row === move.to.row

// Grades moveHistory[i] from the analysis of the position it was played in
// (evals[i]): how much worse the move played scored than the bot's best,
// at the same depth. Returns
//   { loss, grade, missedMate, allowedMate, best, bestNotation }
// grade is null (fine), 'inaccuracy', 'mistake' or 'blunder'; best /
// bestNotation is the bot's preferred move instead (null when the move
// played was that move). `positions` is gamePositions(moveHistory), passed in
// when the caller already has it.
export function gradeMove(moveHistory, evals, i, positions = gamePositions(moveHistory)) {
  const move = moveHistory[i]
  const evaluation = evals[i]
  if (!evaluation || !evaluation.played) return null
  const mover = move.turn
  const playedBest = sameMove(evaluation.best, move)
  const bestFor = forSide(evaluation.score, mover)
  const playedFor = forSide(evaluation.played.score, mover)
  const loss = playedBest ? 0 : Math.max(0, capped(bestFor) - capped(playedFor))

  const matesFor = (mate) => mate !== null && forSide(mate, mover) > 0
  const matedFor = (mate) => mate !== null && forSide(mate, mover) < 0
  const missedMate = !playedBest && matesFor(evaluation.mate) && !matesFor(evaluation.played.mate)
  const allowedMate = !playedBest && !matedFor(evaluation.mate) && matedFor(evaluation.played.mate)

  let grade = null
  if (loss >= THRESHOLDS.blunder || allowedMate) grade = 'blunder'
  else if (loss >= THRESHOLDS.mistake || missedMate) grade = 'mistake'
  else if (loss >= THRESHOLDS.inaccuracy) grade = 'inaccuracy'

  let best = null
  let bestNotation = null
  if (!playedBest && evaluation.best) {
    const { pieces } = positions[i]
    const piece = pieces.find((p) => p.id === evaluation.best.pieceId)
    if (piece) {
      best = { from: { col: piece.col, row: piece.row }, to: { col: evaluation.best.col, row: evaluation.best.row } }
      bestNotation = createMoveEntry(pieces, piece, evaluation.best.col, evaluation.best.row, i + 1).notation
    }
  }
  return { loss, grade, missedMate, allowedMate, best, bestNotation }
}

// The bot's preferred move in positions[index] as { from, to, notation },
// for the arrow on the board — null when there is none or it's not known yet.
export function bestMoveAt(positions, evals, index) {
  const evaluation = evals[index]
  if (!evaluation || !evaluation.best) return null
  const { pieces } = positions[index]
  const piece = pieces.find((p) => p.id === evaluation.best.pieceId)
  if (!piece) return null
  const entry = createMoveEntry(pieces, piece, evaluation.best.col, evaluation.best.row, index + 1)
  return { from: entry.from, to: entry.to, notation: entry.notation }
}

// Grades for every move (null where not analysed yet).
export function gradeGame(moveHistory, evals) {
  const positions = gamePositions(moveHistory)
  return moveHistory.map((_, i) => gradeMove(moveHistory, evals, i, positions))
}

// { red: { inaccuracy, mistake, blunder }, black: { … } }
export function summarize(moveHistory, grades) {
  const counts = () => ({ inaccuracy: 0, mistake: 0, blunder: 0 })
  const summary = { red: counts(), black: counts() }
  grades.forEach((grade, i) => {
    if (grade && grade.grade) summary[moveHistory[i].turn][grade.grade] += 1
  })
  return summary
}

// "+80", "−450", "0" — points from red's side; or "Chiếu bí sau 3 nước" /
// "Đã bị chiếu bí" for a forced mate.
export function formatScore(evaluation) {
  if (!evaluation) return ''
  if (evaluation.mate === 0) return `${evaluation.score > 0 ? 'Đỏ' : 'Đen'} thắng`
  if (evaluation.mate !== null) {
    const winner = evaluation.mate > 0 ? 'Đỏ' : 'Đen'
    return `${winner} chiếu bí sau ${Math.abs(evaluation.mate)} nước`
  }
  const rounded = Math.round(evaluation.score / 10) * 10
  if (rounded === 0) return '0'
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`
}

// Red's share of the evaluation bar, 0..1 (0.5 = level). Smooth, so a
// one-pawn edge shows a little and a rook's a lot, never quite all.
export function barShare(evaluation) {
  if (!evaluation) return 0.5
  if (evaluation.mate !== null) {
    if (evaluation.mate === 0) return evaluation.score > 0 ? 1 : 0
    return evaluation.mate > 0 ? 1 : 0
  }
  return 1 / (1 + Math.exp(-evaluation.score / 400))
}
