import { useCallback, useState } from 'react'
import { findPieceAt } from '../../game/gameLogic.js'
import {
  MOVE_RESULT,
  buildPieces,
  evaluateMove,
  getHintMove,
  getMoveMarkers,
  getPlayerSide,
} from '../engine/challengeEngine.js'

export const MAX_HINT_LEVEL = 3

// Hint levels reveal a little more each time: which piece, then where to,
// then the move itself as an arrow.
const HINT_TEXT = {
  1: 'Hãy chọn quân cờ đang được khoanh vàng.',
  2: 'Ô cần đi tới đã được đánh dấu.',
  3: 'Hãy đi theo mũi tên.',
}

// Board state for one Academy challenge — the "academy" counterpart of
// useGame (live match) and useReplayGame (replay). Entirely local: it never
// touches the socket, a room, a clock or the match history, so nothing done
// here can reach an online game. Mount it under a `key` of the challenge id
// (see AcademyChallenge.jsx) so each challenge starts from a fresh state.
//
// `onSolved(moves)` fires once, when the last step is played correctly, with
// the moves as the player made them.
export function useAcademyChallenge(challenge, { onSolved } = {}) {
  const playerSide = getPlayerSide(challenge)

  const [pieces, setPieces] = useState(() => buildPieces(challenge))
  const [stepIndex, setStepIndex] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [playedMoves, setPlayedMoves] = useState([])
  const [solved, setSolved] = useState(false)
  // { type: 'success' | 'progress' | 'error', message } | null
  const [feedback, setFeedback] = useState(null)
  const [hintLevel, setHintLevel] = useState(0)
  // The square of the last rejected move, flashed on the board. `attempt`
  // makes each rejection a new marker so the flash replays on a repeat.
  const [wrongSquare, setWrongSquare] = useState(null)

  const selectedPiece = pieces.find((piece) => piece.id === selectedId) ?? null

  const selectSquare = useCallback(
    (col, row) => {
      if (solved) return

      const clicked = findPieceAt(pieces, col, row)
      const selected = pieces.find((piece) => piece.id === selectedId) ?? null

      if (!selected) {
        if (clicked && clicked.side === playerSide) setSelectedId(clicked.id)
        return
      }
      if (clicked && clicked.id === selected.id) {
        setSelectedId(null)
        return
      }
      if (clicked && clicked.side === playerSide) {
        setSelectedId(clicked.id)
        return
      }

      const outcome = evaluateMove(challenge, stepIndex, pieces, selected, col, row)

      if (outcome.result !== MOVE_RESULT.CORRECT) {
        // The piece stays where it is and stays selected — a wrong try costs
        // nothing, the player just tries again.
        setFeedback({ type: 'error', message: outcome.message })
        setWrongSquare((previous) => ({ col, row, attempt: (previous?.attempt ?? 0) + 1 }))
        return
      }

      const moves = [...playedMoves, { from: [selected.col, selected.row], to: [col, row] }]
      setPieces(outcome.pieces)
      setPlayedMoves(moves)
      setSelectedId(null)
      setWrongSquare(null)
      setHintLevel(0)

      if (outcome.solved) {
        setSolved(true)
        setFeedback({ type: 'success', message: outcome.message })
        if (onSolved) onSolved(moves)
      } else {
        setStepIndex(stepIndex + 1)
        setFeedback({ type: 'progress', message: outcome.message })
      }
    },
    [challenge, onSolved, pieces, playedMoves, playerSide, selectedId, solved, stepIndex],
  )

  const requestHint = useCallback(() => {
    setHintLevel((level) => Math.min(MAX_HINT_LEVEL, level + 1))
  }, [])

  const step = challenge.steps[stepIndex]
  const hintMove = !solved && hintLevel > 0 ? getHintMove(challenge, stepIndex, pieces) : null

  return {
    pieces,
    selectedId,
    solved,
    feedback,
    stepIndex,
    stepCount: challenge.steps.length,
    selectSquare,
    // Legal-move dots only where the challenge asks for them — most
    // challenges are about finding the move yourself.
    moveMarkers: challenge.showMoves && selectedPiece && !solved ? getMoveMarkers(selectedPiece, pieces) : [],
    targetSquare: !solved && step?.target ? { col: step.target[0], row: step.target[1] } : null,
    wrongSquare: solved ? null : wrongSquare,
    hintLevel,
    canHint: !solved && hintLevel < MAX_HINT_LEVEL,
    requestHint,
    hint: hintMove
      ? {
          level: hintLevel,
          // The lesson's own tip leads; the generic line says what the board
          // is now showing.
          tip: challenge.hint ?? null,
          text: HINT_TEXT[hintLevel],
          from: { col: hintMove.from[0], row: hintMove.from[1] },
          to: hintLevel >= 2 ? { col: hintMove.to[0], row: hintMove.to[1] } : null,
          showArrow: hintLevel >= 3,
        }
      : null,
  }
}

export default useAcademyChallenge
