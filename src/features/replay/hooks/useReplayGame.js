import { useCallback, useEffect, useState } from 'react'
import gameService from '../../../services/gameService'
import { getPiecesAtIndex, getTurnAtIndex } from '../../game/utils/historyUtils.js'
import { reconstructMoveHistory } from '../utils/reconstructMoveHistory.js'

// Loads one finished match's persisted moves and lets the caller browse
// through it by index — a read-only counterpart to useGame's live state,
// reusing the exact same board-at-index derivation (historyUtils.js) so the
// same ChessBoard/MoveHistoryPanel components render it unchanged. Unlike
// useGame, the whole moveHistory is known up front (nothing arrives live),
// so it's reconstructed once on load rather than grown move by move.
export function useReplayGame(gameId) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)
  const [game, setGame] = useState(null)
  const [moveHistory, setMoveHistory] = useState([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1)
  // Bumped by reload() to re-run the fetch effect below for the same
  // gameId (e.g. the "Thử lại" button after a failed load).
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    gameService
      .getGame(gameId)
      .then((data) => {
        if (cancelled) return
        const reconstructed = reconstructMoveHistory(data.moves || [])
        setGame(data)
        setMoveHistory(reconstructed)
        setCurrentMoveIndex(reconstructed.length - 1)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError((err.response && err.response.data && err.response.data.message) || 'Không thể tải lại ván đấu.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [gameId, reloadToken])

  // Event-handler-triggered (never called from the effect above itself) —
  // safe to reset status/error synchronously here, unlike inside an effect.
  const reload = useCallback(() => {
    setStatus('loading')
    setError(null)
    setReloadToken((token) => token + 1)
  }, [])

  const pieces = getPiecesAtIndex(moveHistory, currentMoveIndex)
  const turn = getTurnAtIndex(moveHistory, currentMoveIndex)

  const goToMove = useCallback(
    (index) => setCurrentMoveIndex(Math.max(-1, Math.min(index, moveHistory.length - 1))),
    [moveHistory.length]
  )
  const goToStart = useCallback(() => setCurrentMoveIndex(-1), [])
  const goToEnd = useCallback(() => setCurrentMoveIndex(moveHistory.length - 1), [moveHistory.length])
  const goPrev = useCallback(() => goToMove(currentMoveIndex - 1), [goToMove, currentMoveIndex])
  const goNext = useCallback(() => goToMove(currentMoveIndex + 1), [goToMove, currentMoveIndex])

  return {
    status,
    error,
    game,
    moveHistory,
    currentMoveIndex,
    pieces,
    turn,
    goToMove,
    goToStart,
    goToEnd,
    goPrev,
    goNext,
    canGoPrev: currentMoveIndex > -1,
    canGoNext: currentMoveIndex < moveHistory.length - 1,
    reload,
  }
}

export default useReplayGame
