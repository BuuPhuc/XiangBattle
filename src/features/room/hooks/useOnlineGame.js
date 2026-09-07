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
  // null | 'outgoing' (this client offered, waiting on the opponent) |
  // 'incoming' (the opponent offered, waiting on this client). Purely a
  // live UI signal — the server is what actually decides/records DRAW; this
  // only tracks which confirm prompt (if any) MatchActions should show.
  const [drawOffer, setDrawOffer] = useState(null)

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
      // Covers both the accepted-draw case and any other way the match
      // could end while an offer was somehow still showing locally — the
      // server already cleared its own drawOfferBy the instant any result
      // was recorded (see room.recordMatchResult), this just keeps the UI
      // in sync with that.
      setDrawOffer(null)
      onGameOver?.(payload)
    }

    function handleRoomError(payload) {
      setError(payload.message)
    }

    // Ack to the offering client only: flips its own button to a "waiting
    // for response" state.
    function handleDrawOfferSent() {
      setDrawOffer('outgoing')
    }

    // Sent to the other player only: opens the "Đối thủ đề nghị hòa" prompt.
    function handleDrawOffered() {
      setError(null)
      setDrawOffer('incoming')
    }

    // Broadcast to the room when the offer is declined. Only the offerer
    // gets a notice out of it — the decliner already knows, they just
    // clicked it.
    function handleDrawOfferDeclined() {
      setDrawOffer((current) => {
        if (current === 'outgoing') setError('Đối thủ đã từ chối lời đề nghị hòa.')
        return null
      })
    }

    socket.on('move_made', handleMoveMade)
    socket.on('move_rejected', handleMoveRejected)
    socket.on('game_over', handleGameOver)
    socket.on('room_error', handleRoomError)
    socket.on('draw_offer_sent', handleDrawOfferSent)
    socket.on('draw_offered', handleDrawOffered)
    socket.on('draw_offer_declined', handleDrawOfferDeclined)

    return () => {
      socket.off('move_made', handleMoveMade)
      socket.off('move_rejected', handleMoveRejected)
      socket.off('game_over', handleGameOver)
      socket.off('room_error', handleRoomError)
      socket.off('draw_offer_sent', handleDrawOfferSent)
      socket.off('draw_offered', handleDrawOffered)
      socket.off('draw_offer_declined', handleDrawOfferDeclined)
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

  // Concedes the match outright. The server is the sole authority on the
  // resulting winner/loser (derived from room membership, never trusted
  // from the client) — this only asks it to record that; the actual
  // game_over broadcast comes back through handleGameOver like any other
  // server-declared result (forfeit, timeout report).
  const resign = useCallback(() => {
    socket.emit('resign')
  }, [])

  // Proposes a draw. The server rejects a second offer while one is
  // already pending (either side), so this never needs to guard that
  // itself — MatchActions just disables the button once `drawOffer` flips
  // to 'outgoing'.
  const offerDraw = useCallback(() => {
    socket.emit('offer_draw')
  }, [])

  // The opponent's answer to a pending incoming offer. Clears the local
  // prompt immediately (optimistic — no need to wait for a round trip to
  // hide it) regardless of accept/decline; the actual outcome (DRAW result
  // or a plain continue) always comes from the server, never decided here.
  const respondDraw = useCallback((accept) => {
    setDrawOffer(null)
    socket.emit('respond_draw', { accept })
  }, [])

  return { sendMove, error, reportGameOver, playAgain, resign, drawOffer, offerDraw, respondDraw }
}

export default useOnlineGame
