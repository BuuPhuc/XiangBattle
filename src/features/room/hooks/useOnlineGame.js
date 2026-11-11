import { useCallback, useEffect, useState } from 'react'
import socket from '../../../socket/socket'

// Wires the shared socket connection to an in-progress online match: sends
// this client's own moves/game-over reports/rematch requests to the server
// and forwards the opponent's moves and the server's game-over verdicts
// back into the local game state via the callbacks passed in. useGame still
// checks moves locally for instant feedback, but the server is the referee:
// it re-validates every move with the same rule engine and alone decides
// how (and whether) the match ended.
export function useOnlineGame({ enabled, onOpponentMove, onMoveRejected, onGameOver }) {
  const [error, setError] = useState(null)
  // null | 'outgoing' (this client offered, waiting on the opponent) |
  // 'incoming' (the opponent offered, waiting on this client). Purely a
  // live UI signal — the server is what actually decides/records DRAW; this
  // only tracks which confirm prompt (if any) MatchActions should show.
  const [drawOffer, setDrawOffer] = useState(null)
  // Same null/'outgoing'/'incoming' shape as drawOffer, but for a rematch
  // request once the match has ended — GameOverModal reads this to show
  // "Đang chờ đối thủ..." or an accept/decline prompt instead of starting a
  // new match unilaterally on a single click.
  const [playAgainRequest, setPlayAgainRequest] = useState(null)
  // { gameId, red: { userId, rating: {before,after,change}, wins, losses,
  // draws }, black: {...} } | null — the server's authoritative Elo/stat
  // update for this match, arriving slightly after game_over once the DB
  // transaction in gameHistoryService.js resolves (never before: this is
  // never computed or trusted from the client). Stays null for a
  // non-persisted match (a guest played) or while the update is still in
  // flight. Reset to null on every mount, same as drawOffer/playAgainRequest
  // — ChessGame remounts (key={restoreVersion}) on every fresh match.
  const [ratingUpdate, setRatingUpdate] = useState(null)

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

    // The server's Elo/stats update for the match that (per handleGameOver
    // above) just ended — always arrives after game_over, never instead of
    // it, so this only ever adds rating info to an already-shown result.
    function handleRatingUpdated(payload) {
      setRatingUpdate(payload)
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

    // Ack to the requesting client only: flips its own "Chơi lại" button to
    // a "waiting for response" state.
    function handlePlayAgainRequestSent() {
      setPlayAgainRequest('outgoing')
    }

    // Sent to the other player only: opens the accept/decline prompt in
    // GameOverModal.
    function handlePlayAgainRequested() {
      setError(null)
      setPlayAgainRequest('incoming')
    }

    // Broadcast to the room when the request is declined. Only the
    // requester gets a notice out of it, same as a declined draw offer.
    function handlePlayAgainDeclined() {
      setPlayAgainRequest((current) => {
        if (current === 'outgoing') setError('Đối thủ đã từ chối chơi lại.')
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
    socket.on('play_again_request_sent', handlePlayAgainRequestSent)
    socket.on('play_again_requested', handlePlayAgainRequested)
    socket.on('play_again_declined', handlePlayAgainDeclined)
    socket.on('rating_updated', handleRatingUpdated)

    return () => {
      socket.off('move_made', handleMoveMade)
      socket.off('move_rejected', handleMoveRejected)
      socket.off('game_over', handleGameOver)
      socket.off('room_error', handleRoomError)
      socket.off('draw_offer_sent', handleDrawOfferSent)
      socket.off('draw_offered', handleDrawOffered)
      socket.off('draw_offer_declined', handleDrawOfferDeclined)
      socket.off('play_again_request_sent', handlePlayAgainRequestSent)
      socket.off('play_again_requested', handlePlayAgainRequested)
      socket.off('play_again_declined', handlePlayAgainDeclined)
      socket.off('rating_updated', handleRatingUpdated)
    }
  }, [enabled, onOpponentMove, onMoveRejected, onGameOver])

  // Only the from/to squares are sent: the server validates the move against
  // its own board and computes everything else (board after, capture,
  // notation, game end) itself. If it's rejected, move_rejected rolls the
  // optimistic local move back.
  const sendMove = useCallback((move) => {
    socket.emit('make_move', { move: { from: move.from, to: move.to } })
  }, [])

  // Nudges the server when this client's clock display hits zero, so the
  // timeout lands without waiting on the server's own turn timer. Carries
  // no result: the server decides (checkmate/stalemate in make_move,
  // timeouts from its own clock) and announces it via game_over.
  const reportGameOver = useCallback(() => {
    socket.emit('report_game_over')
  }, [])

  // Asks for a rematch. Never starts one unilaterally — the server only
  // actually restarts the match once the other side agrees too (or had
  // already asked first itself), same handshake as offerDraw/respondDraw.
  const requestPlayAgain = useCallback(() => {
    socket.emit('request_play_again')
  }, [])

  // The opponent's answer to a pending incoming rematch request. Clears the
  // local prompt immediately (optimistic, same as respondDraw below); the
  // actual restart (or staying on the game-over screen) always comes from
  // the server via game_started / play_again_declined.
  const respondPlayAgain = useCallback((accept) => {
    setPlayAgainRequest(null)
    socket.emit('respond_play_again', { accept })
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

  return {
    sendMove,
    error,
    reportGameOver,
    requestPlayAgain,
    respondPlayAgain,
    playAgainRequest,
    resign,
    drawOffer,
    offerDraw,
    respondDraw,
    ratingUpdate,
  }
}

export default useOnlineGame
