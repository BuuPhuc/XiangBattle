import { useCallback, useEffect, useRef, useState } from 'react'
import { GAME_STATUS } from '../gameLogic.js'
import { DEFAULT_TIME_CONTROL } from '../utils/timeUtils.js'

// Drives the two Xiangqi-style clocks (per-move + per-game) for both sides.
//
// Accuracy note: remaining time is never decremented by a fixed step on a
// tick (that compounds drift, and double-subtracts if a tick reads a base
// that a previous tick already reduced). Instead `committedRef` holds each
// side's remaining time as of the last "boundary" — turn switch, timeout,
// freeze on game over, or reset — and every tick (and every render, via the
// `times` state a tick writes) recomputes the active side's live remaining
// time as `committed - (Date.now() - anchor)`, always measured from that
// same fixed boundary. `committedRef` itself is only ever written at a
// boundary, never per tick, so nothing compounds. All of that math happens
// inside effects/callbacks, never during render — render only reads `times`.
export function useTimer({ turn, isGameOver, onTimeUp, timeControl = DEFAULT_TIME_CONTROL }) {
  const { moveTimeMs, gameTimeMs } = timeControl

  const makeFreshTimes = useCallback(
    () => ({
      red: { moveTime: moveTimeMs, gameTime: gameTimeMs },
      black: { moveTime: moveTimeMs, gameTime: gameTimeMs },
    }),
    [moveTimeMs, gameTimeMs]
  )

  const [times, setTimes] = useState(makeFreshTimes)

  const committedRef = useRef(makeFreshTimes()) // remaining time as of the last boundary
  const anchorRef = useRef(null) // wall-clock ms of that boundary; set on mount below
  const activeTurnRef = useRef(null) // whose clocks are currently anchored/running
  const expiredRef = useRef(false) // guards onTimeUp from firing more than once per game

  const liveDisplay = useCallback((activeSide, elapsed) => ({
    red:
      activeSide === 'red'
        ? {
            moveTime: Math.max(0, committedRef.current.red.moveTime - elapsed),
            gameTime: Math.max(0, committedRef.current.red.gameTime - elapsed),
          }
        : committedRef.current.red,
    black:
      activeSide === 'black'
        ? {
            moveTime: Math.max(0, committedRef.current.black.moveTime - elapsed),
            gameTime: Math.max(0, committedRef.current.black.gameTime - elapsed),
          }
        : committedRef.current.black,
  }), [])

  // Whenever the side to move changes — a real move, or an undo/redo that
  // hands the move to the other side — bank the real time the previous side
  // spent thinking into committedRef, then reset the move clock for the
  // side coming on. Time is only ever subtracted here, and only for the
  // side whose turn just ended, which is what keeps undo/redo from ever
  // refunding spent time. Also runs once on mount, to anchor the first turn.
  useEffect(() => {
    if (isGameOver) return
    const now = Date.now()
    const prevTurn = activeTurnRef.current

    if (prevTurn !== null && prevTurn !== turn) {
      const elapsed = Math.max(0, now - anchorRef.current)
      committedRef.current = {
        ...committedRef.current,
        // moveTime only ever means something for the side currently to
        // move; once a side's turn ends its move clock has no meaning
        // until it's reset again for their next turn, so it snaps straight
        // to moveTimeMs rather than lingering on whatever it last ticked to.
        [prevTurn]: { moveTime: moveTimeMs, gameTime: Math.max(0, committedRef.current[prevTurn].gameTime - elapsed) },
        [turn]: { moveTime: moveTimeMs, gameTime: committedRef.current[turn].gameTime },
      }
      expiredRef.current = false
      setTimes(committedRef.current)
    }

    activeTurnRef.current = turn
    anchorRef.current = now
  }, [turn, isGameOver, moveTimeMs])

  // Game over for any reason (checkmate included, not just a timeout this
  // hook itself reported): bank whatever time had elapsed on the active
  // side, so the frozen display reflects the real final moment instead of
  // stopping at the previous turn switch.
  useEffect(() => {
    if (!isGameOver || activeTurnRef.current === null) return
    const now = Date.now()
    const elapsed = Math.max(0, now - anchorRef.current)
    anchorRef.current = now
    if (elapsed <= 0) return
    const side = activeTurnRef.current
    committedRef.current = {
      ...committedRef.current,
      [side]: {
        moveTime: Math.max(0, committedRef.current[side].moveTime - elapsed),
        gameTime: Math.max(0, committedRef.current[side].gameTime - elapsed),
      },
    }
    setTimes(committedRef.current)
  }, [isGameOver])

  // The ticking interval: recomputes the active side's live remaining time
  // every 100ms from `committedRef` and the real elapsed wall-clock time —
  // committedRef itself is untouched by this, so nothing compounds tick
  // over tick. Only depends on turn/isGameOver, so it is stopped and
  // restarted (never stacked, never duplicated) exactly on a turn switch or
  // game end — one interval alive at a time, one clock per player.
  useEffect(() => {
    if (isGameOver) return

    const intervalId = setInterval(() => {
      const now = Date.now()
      const elapsed = Math.max(0, now - anchorRef.current)
      const moveTimeLeft = committedRef.current[turn].moveTime - elapsed
      const gameTimeLeft = committedRef.current[turn].gameTime - elapsed

      if (!expiredRef.current && (moveTimeLeft <= 0 || gameTimeLeft <= 0)) {
        expiredRef.current = true
        anchorRef.current = now
        committedRef.current = {
          ...committedRef.current,
          [turn]: { moveTime: Math.max(0, moveTimeLeft), gameTime: Math.max(0, gameTimeLeft) },
        }
        setTimes(committedRef.current)
        const reason = gameTimeLeft <= 0 ? GAME_STATUS.TIMEOUT_GAME : GAME_STATUS.TIMEOUT_MOVE
        onTimeUp(turn, reason)
        return
      }

      setTimes(liveDisplay(turn, elapsed))
    }, 100)

    return () => clearInterval(intervalId)
  }, [turn, isGameOver, onTimeUp, liveDisplay])

  const resetTimer = useCallback(() => {
    const fresh = makeFreshTimes()
    committedRef.current = fresh
    anchorRef.current = Date.now()
    activeTurnRef.current = 'red' // resetGame() always hands the move back to red
    expiredRef.current = false
    setTimes(fresh)
  }, [makeFreshTimes])

  return {
    red: times.red,
    black: times.black,
    resetTimer,
  }
}

export default useTimer
