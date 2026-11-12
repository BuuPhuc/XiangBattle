import { useCallback, useMemo, useState } from 'react'
import { findPieceAt, isOwnPiece, otherTurn, GAME_STATUS } from '../gameLogic.js'
import { isInCheck } from '../utils/checkUtils.js'
import { isFullyLegalMove } from '../utils/moveUtils.js'
import { isCheckmate, isStalemate } from '../utils/checkmateUtils.js'
import { createMoveEntry } from '../utils/moveEntry.js'
import { judgeRepetition } from '../utils/repetitionUtils.js'
import { getPiecesAtIndex, getTurnAtIndex } from '../utils/historyUtils.js'

// `initialMoveHistory`/`initialMatchResult` let a caller seed the hook from
// a server-restored snapshot (reconnect) instead of always starting a
// brand new game — they're only ever read once, as lazy useState
// initializers, so the caller is expected to force a remount (e.g. a
// React `key` change) if it needs to re-seed an already-mounted instance.
// Omitting them (the offline/local-play default) behaves exactly as before.
export function useGame({ initialMoveHistory, initialMatchResult } = {}) {
  const [moveHistory, setMoveHistory] = useState(() => initialMoveHistory ?? [])
  // -1 = initial position (before any move). Otherwise an index into
  // moveHistory: the board as it stood right after that move.
  const [currentMoveIndex, setCurrentMoveIndex] = useState(() =>
    initialMoveHistory && initialMoveHistory.length > 0 ? initialMoveHistory.length - 1 : -1
  )
  const [selectedId, setSelectedId] = useState(null)
  // A clock running out ends the game from outside the board state, so unlike
  // checkmate it must NOT be derived from (moveHistory, currentMoveIndex) —
  // otherwise browsing history with undo/redo after a timeout would "undo"
  // the loss. { side, reason: GAME_STATUS.TIMEOUT_MOVE | TIMEOUT_GAME } | null
  const [timeoutResult, setTimeoutResult] = useState(() =>
    initialMatchResult ? { side: initialMatchResult.loser, reason: initialMatchResult.status } : null
  )
  // The most recently committed move that originated from *this* client's
  // own selectSquare (never set by applyRemoteMove) — a side-channel an
  // online-play layer can watch to know when to relay a move to the
  // server, without this hook needing to know Socket.IO exists at all.
  const [lastLocalMove, setLastLocalMove] = useState(null)

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
  // the mate happened correctly reads as playable again. A timeout loss has
  // no such position to browse back to, so it stays true regardless of
  // currentMoveIndex until the next resetGame().
  // Stalemate (no legal move, not in check) is a loss too in Xiangqi, so it
  // ends the game the same way and is browsable the same way.
  const isCheckmateNow = isCheckmate(pieces, turn)
  const isStalemateNow = !isCheckmateNow && isStalemate(pieces, turn)
  const noMovesLeft = isCheckmateNow || isStalemateNow

  // Repetition (perpetual check / chase, or draw by repetition) — the same
  // shared rule the server applies to online games, judged on the line that
  // led to the displayed position, so like checkmate it un-shows when you
  // browse back before it. Derived, never stored: it can't fire twice.
  // (Checkmate/stalemate takes precedence over a repetition verdict.)
  const repetitionVerdict = useMemo(() => {
    const positions = [{ pieces: getPiecesAtIndex(moveHistory, -1), side: getTurnAtIndex(moveHistory, -1) }]
    for (let i = 0; i <= currentMoveIndex; i++) {
      positions.push({ pieces: moveHistory[i].piecesAfter, side: otherTurn(moveHistory[i].turn) })
    }
    return judgeRepetition(positions)
  }, [moveHistory, currentMoveIndex])
  const repetition = noMovesLeft ? null : repetitionVerdict

  const isGameOver = noMovesLeft || repetition !== null || timeoutResult !== null

  const status = timeoutResult
    ? timeoutResult.reason
    : isCheckmateNow
      ? GAME_STATUS.CHECKMATE
      : isStalemateNow
        ? GAME_STATUS.STALEMATE
        : repetition
          ? repetition.status
          : GAME_STATUS.PLAYING
  // A draw (timeoutResult.side === null, from a server-recorded
  // GAME_STATUS.DRAW, or a repetition draw) has no winning side — winner
  // stays null, same as "game still in progress".
  const winner = timeoutResult
    ? timeoutResult.side
      ? otherTurn(timeoutResult.side)
      : null
    : noMovesLeft
      ? otherTurn(turn)
      : repetition
        ? repetition.winner
        : null

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

      const move = createMoveEntry(pieces, selectedPiece, col, row, currentMoveIndex + 2)

      // Playing a move while looking at an earlier position starts a new line
      // from here: everything after the position being viewed is replaced —
      // the same "branch from here" behavior most chess sites use, rather
      // than silently discarding the move or corrupting the old history.
      setMoveHistory((current) => [...current.slice(0, currentMoveIndex + 1), move])
      setCurrentMoveIndex((current) => current + 1)
      setSelectedId(null)
      setLastLocalMove(move)
    },
    [pieces, turn, selectedPiece, currentMoveIndex, isGameOver]
  )

  // Applies a move that came from the opponent via the server, rather than
  // from this client's own selectSquare — same move-entry shape, but always
  // appended at the true end of history regardless of where this client's
  // view currently is (e.g. mid-undo/browsing an older position), since an
  // incoming move is authoritative and must snap the view back to live.
  // Never touches lastLocalMove, so it can't be echoed back to the server.
  const applyRemoteMove = useCallback(
    (move) => {
      const nextHistory = [...moveHistory, move]
      setMoveHistory(nextHistory)
      setCurrentMoveIndex(nextHistory.length - 1)
      setSelectedId(null)
    },
    [moveHistory]
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

  // Undo/redo are just navigation one step back/forward through moveHistory —
  // they never mutate it, so redo always restores exactly what undo hid,
  // as long as no new (branching) move was made in between.
  const canUndo = currentMoveIndex > -1
  const canRedo = currentMoveIndex < moveHistory.length - 1
  const undo = useCallback(() => goToMove(currentMoveIndex - 1), [goToMove, currentMoveIndex])
  const redo = useCallback(() => goToMove(currentMoveIndex + 1), [goToMove, currentMoveIndex])

  // Called by the timer when a clock reaches zero. First timeout to arrive
  // wins the race (e.g. against a checkmate landing the same instant) —
  // once set it can only be cleared by starting a new game.
  const endGameByTimeout = useCallback((side, reason) => {
    setTimeoutResult((current) => current ?? { side, reason })
  }, [])

  // Starts a brand new match from scratch, fully independent of the old one:
  // clearing moveHistory and resetting currentMoveIndex to -1 is enough,
  // because pieces/turn/inCheck/status/winner are all derived from those two
  // — nothing else needs to be reset by hand, aside from the timeout result
  // (the one piece of state that isn't derived from move history).
  const resetGame = useCallback(() => {
    setMoveHistory([])
    setCurrentMoveIndex(-1)
    setSelectedId(null)
    setTimeoutResult(null)
    setLastLocalMove(null)
  }, [])

  return {
    pieces,
    selectedId,
    selectedPiece,
    turn,
    inCheck,
    status,
    winner,
    isGameOver,
    moveHistory,
    currentMoveIndex,
    isViewingHistory,
    selectSquare,
    goToMove,
    canUndo,
    canRedo,
    undo,
    redo,
    endGameByTimeout,
    resetGame,
    lastLocalMove,
    applyRemoteMove,
    // The result that doesn't come from the board (timeout, resignation,
    // accepted draw, opponent left, or a server-announced end) — null while
    // there is none. Read-only; useGameSounds uses it to play the game-end
    // sound for an ending no move caused.
    externalResult: timeoutResult,
  }
}

export default useGame
