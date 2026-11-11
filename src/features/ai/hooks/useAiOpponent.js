import { useEffect, useMemo, useRef } from 'react'
import { INITIAL_PIECES } from '../../game/initialPosition.js'
import { isFullyLegalMove } from '../../game/utils/moveUtils.js'
import { createMoveEntry } from '../../game/utils/moveEntry.js'
import { chooseMove } from '../engine/search.js'
import { AI_LEVELS } from '../engine/levels.js'
import { generateLegalMoves } from '../engine/moveGen.js'

// The bot never answers faster than this, so its move is visible as a move
// (not a flicker) and the "thinking" state actually shows.
const MIN_THINK_MS = 600

// Plays the bot's side of a local game. Whenever it's the bot's turn on the
// live position (not while the player is browsing history, not once the
// game is over), the position is sent to the worker; the answer is checked
// against the same rules the player's clicks go through (isFullyLegalMove)
// and applied with `onMove` — the same path an opponent's move takes.
//
// `thinking` isn't separate state: the bot is thinking exactly while it's
// its turn on the live board — the moment its move lands, it's the player's
// turn again. Any change of position (undo, restart, unmount) cancels the
// request in flight, so a stale answer can never be played.
export function useAiOpponent({ enabled, botColor, levelId, pieces, turn, moveHistory, isGameOver, isViewingHistory, onMove }) {
  const thinking = Boolean(enabled && turn === botColor && !isGameOver && !isViewingHistory)
  const workerRef = useRef(null)

  // Positions already played this game (before the current one), so the
  // bot's search applies the repetition rule (perpetual check / chase) to
  // the real game, not just to its own lines.
  const history = useMemo(
    () =>
      moveHistory.map((move, index) => ({
        pieces: index === 0 ? INITIAL_PIECES : moveHistory[index - 1].piecesAfter,
        side: move.turn,
      })),
    [moveHistory]
  )

  useEffect(() => {
    if (!thinking) return undefined

    const startedAt = performance.now()
    const ply = moveHistory.length + 1
    let finished = false
    let applyTimer = null

    // Second line of defence: the bot's move must pass the exact rule check
    // a human move does. If it somehow doesn't, play the first legal move
    // instead of an illegal one.
    function apply(move) {
      finished = true
      let piece = move && pieces.find((p) => p.id === move.pieceId)
      let target = move
      if (!piece || !isFullyLegalMove(piece, move.col, move.row, pieces)) {
        console.error('[ai] rejected an illegal bot move', move)
        const fallback = generateLegalMoves(pieces, botColor)[0]
        if (!fallback) return
        piece = fallback.piece
        target = fallback
      }
      const delay = Math.max(0, MIN_THINK_MS - (performance.now() - startedAt))
      applyTimer = setTimeout(() => onMove(createMoveEntry(pieces, piece, target.col, target.row, ply)), delay)
    }

    // Main-thread fallback if workers are unavailable or the worker crashes —
    // shorter budget since it blocks the page while it runs.
    function thinkHere() {
      applyTimer = setTimeout(() => {
        const level = AI_LEVELS[levelId] ?? AI_LEVELS.medium
        const result = chooseMove(pieces, botColor, { ...level, timeMs: Math.min(level.timeMs, 700), history })
        apply(result?.move)
      }, 0)
    }

    let worker = workerRef.current
    if (!worker && typeof Worker !== 'undefined') {
      try {
        worker = new Worker(new URL('../aiWorker.js', import.meta.url), { type: 'module' })
        workerRef.current = worker
      } catch {
        worker = null
      }
    }

    if (!worker) {
      thinkHere()
    } else {
      const id = `${Date.now()}-${Math.random()}`
      worker.onmessage = (event) => {
        if (event.data.id !== id || finished) return
        if (event.data.error) {
          console.error('[ai] worker error:', event.data.error)
          thinkHere()
          return
        }
        apply(event.data.result?.move)
      }
      worker.onerror = (event) => {
        console.error('[ai] worker crashed:', event.message)
        event.preventDefault()
        worker.terminate()
        workerRef.current = null
        if (!finished) thinkHere()
      }
      worker.postMessage({ id, pieces, side: botColor, levelId, history })
    }

    return () => {
      clearTimeout(applyTimer)
      // Still computing an answer nobody wants anymore: stop it outright
      // rather than let it delay the next request.
      if (!finished && workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [thinking, pieces, botColor, levelId, history, moveHistory.length, onMove])

  useEffect(
    () => () => {
      workerRef.current?.terminate()
      workerRef.current = null
    },
    []
  )

  return { thinking }
}
