import { useCallback, useEffect, useState } from 'react'
import socket from '../../../socket/socket'

// Wires the shared socket connection to an in-progress online match: sends
// this client's own moves/game-over reports/rematch requests to the server
// and forwards the opponent's moves and the server's game-over verdicts
// back into the local game state via the callbacks passed in. The server
// is only the authority for turn order/room membership/sequencing here —
// move legality (and checkmate detection) is decided entirely by the
// existing chess logic in useGame, exactly as in local play; this hook
// never re-implements or second-guesses it, it only relays already-derived
// results so the room's server-side record (and therefore reconnect) stays
// accurate.
export function useOnlineGame({ enabled, onOpponentMove, onMoveRejected, onGameOver }) {
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) return

    function handleMoveMade(payload) {
      setError(null)
      onOpponentMove(payload.move)
    }

    function handleMoveRejected(payload) {
      setError(payload.message)
      onMoveRejected?.()
    }

    function handleGameOver(payload) {
      onGameOver?.(payload)
    }

    function handleRoomError(payload) {
      setError(payload.message)
    }

    socket.on('move_made', handleMoveMade)
    socket.on('move_rejected', handleMoveRejected)
    socket.on('game_over', handleGameOver)
    socket.on('room_error', handleRoomError)

    return () => {
      socket.off('move_made', handleMoveMade)
      socket.off('move_rejected', handleMoveRejected)
      socket.off('game_over', handleGameOver)
      socket.off('room_error', handleRoomError)
    }
  }, [enabled, onOpponentMove, onMoveRejected, onGameOver])

  const sendMove = useCallback((move) => {
    socket.emit('make_move', { move })
  }, [])

  // Reports a game-over result this client just derived locally
  // (checkmate or a clock timeout — never a disconnect forfeit, the server
  // already knows about that on its own) so the room's authoritative
  // record reflects it too, which is what lets a later reconnect restore
  // the correct finished state instead of quietly resuming a "live" game.
  const reportGameOver = useCallback((status, winner) => {
    socket.emit('report_game_over', { status, winner })
  }, [])

  const playAgain = useCallback(() => {
    socket.emit('play_again')
  }, [])

  return { sendMove, error, reportGameOver, playAgain }
}

export default useOnlineGame
