import { useCallback, useState } from 'react'
import { findPieceAt, isOwnPiece, movePiece, otherTurn } from '../gameLogic.js'
import { isInCheck } from '../utils/checkUtils.js'
import { isFullyLegalMove } from '../utils/moveUtils.js'
import { isCheckmate } from '../utils/checkmateUtils.js'
import { formatMoveNotation } from '../utils/notationUtils.js'
import { getPiecesAtIndex, getTurnAtIndex } from '../utils/historyUtils.js'

export function useGame() {
  const [moveHistory, setMoveHistory] = useState([])
  // -1 = initial position (before any move). Otherwise an index into
  // moveHistory: the board as it stood right after that move.
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1)
  const [selectedId, setSelectedId] = useState(null)

  // The board is always DERIVED from (moveHistory, currentMoveIndex) rather
  // than tracked as its own state — that's what lets "browse an old move"
  // and "the live game" share one code path with no sync bugs between them.
  const pieces = getPiecesAtIndex(moveHistory, currentMoveIndex)
  const turn = getTurnAtIndex(moveHistory, currentMoveIndex)
  const isViewingHistory = currentMoveIndex !== moveHistory.length - 1

  const selectedPiece = pieces.find((piece) => piece.id === selectedId) ?? null
  const inCheck = isInCheck(pieces, turn)
  // Checkmate is evaluated against whatever position is currently displayed,
  // not "the game" in the abstract — so browsing back to a position before
  // the mate happened correctly reads as playable again.
  const isGameOver = isCheckmate(pieces, turn)
  const winner = isGameOver ? otherTurn(turn) : null

  const selectSquare = useCallback(
    (col, row) => {
      if (isGameOver) return

      const target = findPieceAt(pieces, col, row)

      // Nothing selected yet: only a piece belonging to the current turn can be picked up.
      if (!selectedPiece) {
        if (target && isOwnPiece(target, turn)) {
          setSelectedId(target.id)
        }
        return
      }

      // Clicking the selected piece again deselects it.
      if (target && target.id === selectedPiece.id) {
        setSelectedId(null)
        return
      }

      // Clicking another one of your own pieces switches the selection instead of moving.
      if (target && isOwnPiece(target, turn)) {
        setSelectedId(target.id)
        return
      }

      // Otherwise: attempt a move there, capturing an enemy piece if one occupies the
      // square. Rejected if it's not shape-legal, or if it would leave (or place) your
      // own general in check — an illegal destination leaves the piece selected and
      // does nothing.
      if (!isFullyLegalMove(selectedPiece, col, row, pieces)) return

      const from = { col: selectedPiece.col, row: selectedPiece.row }
      const to = { col, row }
      const captured = target
      const piecesAfter = movePiece(pieces, selectedPiece.id, col, row)

      const move = {
        ply: currentMoveIndex + 2,
        turn,
        piece: { id: selectedPiece.id, type: selectedPiece.type, side: selectedPiece.side, char: selectedPiece.char },
        from,
        to,
        captured: captured ? { id: captured.id, type: captured.type, side: captured.side, char: captured.char } : null,
        piecesAfter,
      }
      move.notation = formatMoveNotation(move)

      // Playing a move while looking at an earlier position starts a new line
      // from here: everything after the position being viewed is replaced —
      // the same "branch from here" behavior most chess sites use, rather
      // than silently discarding the move or corrupting the old history.
      setMoveHistory((current) => [...current.slice(0, currentMoveIndex + 1), move])
      setCurrentMoveIndex((current) => current + 1)
      setSelectedId(null)
    },
    [pieces, turn, selectedPiece, currentMoveIndex, isGameOver]
  )

  // Jump to viewing the board right after moveHistory[index] (or -1 for the
  // initial position). Pure navigation — never touches moveHistory itself.
  const goToMove = useCallback(
    (index) => {
      setCurrentMoveIndex(Math.max(-1, Math.min(index, moveHistory.length - 1)))
      setSelectedId(null)
    },
    [moveHistory.length]
  )

  const resetGame = useCallback(() => {
    setMoveHistory([])
    setCurrentMoveIndex(-1)
    setSelectedId(null)
  }, [])

  return {
    pieces,
    selectedId,
    selectedPiece,
    turn,
    inCheck,
    status: isGameOver ? 'checkmate' : 'playing',
    winner,
    moveHistory,
    currentMoveIndex,
    isViewingHistory,
    selectSquare,
    goToMove,
    resetGame,
  }
}

export default useGame
