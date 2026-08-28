import { useCallback, useEffect, useRef, useState } from 'react'
import socket from '../../../socket/socket'
import { getPlayerId, getSavedRoomId, saveRoomId, clearSavedRoomId } from '../roomSession'

// Thin state layer over the shared socket connection for the Room + online
// match handshake, including reconnect: a refresh always wipes this hook's
// state, but sessionStorage (roomSession.js) survives it, so on every
// (re)connect this hook asks the server to resume whatever room/match it
// was last in — never to create a new one. One listener registration for
// the whole hook lifetime (cleaned up on unmount) — nothing here opens its
// own socket connection.
export function useRoom() {
  const [room, setRoom] = useState(null) // { roomId, status, players } | null
  const [you, setYou] = useState(null) // { playerNumber, color } | null — color is null until game_started
  const [opponent, setOpponent] = useState(null) // { playerNumber, color, connected } | null — only known once playing
  const [currentTurn, setCurrentTurn] = useState(null) // 'red' | 'black' | null
  const [moveHistory, setMoveHistory] = useState([]) // authoritative history from the server, for seeding/restoring useGame
  const [matchResult, setMatchResult] = useState(null) // { status, winner, loser } | null — only for server-declared outcomes (e.g. opponent-left)
  const [timerState, setTimerState] = useState(null) // { red: {moveTime,gameTime}, black: {...} } | null — for seeding/restoring useTimer
  const [opponentConnected, setOpponentConnected] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null) // one-off info message, e.g. "opponent left mid-game"
  const [pending, setPending] = useState(false)
  const [rejoining, setRejoining] = useState(false) // true while an auto-rejoin attempt is in flight

  // Bumped on every event that hands down a full, authoritative game
  // snapshot (game_started, a successful reconnect, or a server-declared
  // result) — a consumer renders <ChessGame key={restoreVersion}> so
  // useGame/useTimer always mount fresh from these exact values instead of
  // trying to patch a possibly-stale already-running instance.
  const [restoreVersion, setRestoreVersion] = useState(0)

  // Tracks the room's status as of the *previous* update, purely so
  // room_left can tell "the match just got interrupted" apart from "the
  // room was already idle" without needing a value from outside the effect.
  const wasPlayingRef = useRef(false)

  // Mirrors `matchResult` for the unmount-cleanup effect below, which can't
  // put `matchResult` itself in its dependency array (it must only ever
  // run its cleanup on true unmount, not on every result change).
  const matchResultRef = useRef(null)
  useEffect(() => {
    matchResultRef.current = matchResult
  }, [matchResult])

  // The other half of what makes "refresh resumes a finished game (Test 6)
  // but navigating away and starting a new Room doesn't (Test 3)" work: a
  // hard refresh tears down the whole page before React ever gets to run
  // this cleanup, so it never fires then — sessionStorage's saved roomId
  // survives, and the next connect's rejoin_room faithfully restores
  // whatever state the room is actually in, finished or not. But a genuine
  // in-app navigation away from this page *does* unmount cleanly — if the
  // match here had already concluded, there's nothing left to resume, so
  // this tells the server this player is leaving for good and clears the
  // saved reference, so the next time this page mounts (e.g. after
  // choosing "Chơi cờ" to start a new Room) it won't try to rejoin a dead
  // match. A still-active match is left completely alone here — its
  // session is only ever cleared by leaveRoom() or a failed rejoin.
  useEffect(() => {
    return () => {
      if (matchResultRef.current) {
        socket.emit('leave_room')
        clearSavedRoomId()
      }
    }
  }, [])

  useEffect(() => {
    function applySnapshot(payload) {
      setYou(payload.you)
      setOpponent(payload.opponent)
      setCurrentTurn(payload.currentTurn)
      setMoveHistory(payload.moveHistory ?? [])
      setMatchResult(payload.matchResult ?? null)
      setTimerState(payload.timerState ?? null)
      setOpponentConnected(payload.opponent ? payload.opponent.connected !== false : true)
      setRoom({ roomId: payload.roomId, status: payload.status, players: payload.players })
      setRestoreVersion((v) => v + 1)
      wasPlayingRef.current = payload.status === 'playing'
    }

    function handleRoomCreated(payload) {
      setPending(false)
      setError(null)
      setNotice(null)
      setYou(payload.you)
      setOpponent(null)
      setCurrentTurn(null)
      setMoveHistory([])
      setMatchResult(null)
      setTimerState(null)
      setRoom({ roomId: payload.roomId, status: payload.status, players: payload.players })
      saveRoomId(payload.roomId)
      wasPlayingRef.current = false
    }

    function handleRoomJoined(payload) {
      setPending(false)
      setError(null)
      setNotice(null)
      setYou(payload.you)
      setRoom({ roomId: payload.roomId, status: payload.status, players: payload.players })
      saveRoomId(payload.roomId)
    }

    // The room now has both seats filled: server has assigned red/black and
    // red moves first. Both players receive this, each with their own
    // `you`/`opponent` — this is what flips the UI from waiting to the board.
    function handleGameStarted(payload) {
      setError(null)
      setNotice(null)
      saveRoomId(payload.roomId)
      applySnapshot(payload)
    }

    // Response to a successful rejoin_room: the full current match state,
    // exactly like game_started but possibly with moves/timer/result
    // already in progress. Never resets anything — just restores it.
    function handleGameState(payload) {
      setRejoining(false)
      setError(null)
      saveRoomId(payload.roomId)
      applySnapshot(payload)
    }

    function handleRejoinFailed(payload) {
      setRejoining(false)
      clearSavedRoomId()
      setError(payload.message)
    }

    // Sent to whichever player remains after the other one leaves for good
    // (explicit leave, or their reconnect grace period expired without a
    // forfeit having already been declared — see handleGameOver).
    function handleRoomLeft(payload) {
      setNotice(wasPlayingRef.current ? 'Đối thủ đã rời trận.' : null)
      setOpponent(null)
      setCurrentTurn(null)
      setMoveHistory([])
      setMatchResult(null)
      setTimerState(null)
      setRoom((current) => (current ? { ...current, status: payload.status, players: payload.players } : current))
      wasPlayingRef.current = false
    }

    function handleOpponentDisconnected() {
      setOpponentConnected(false)
    }

    function handleOpponentReconnected() {
      setOpponentConnected(true)
    }

    // The match concluded — either the opponent didn't reconnect within
    // the grace period (server-declared), or a client reported a
    // checkmate/timeout it derived locally (see ChessGame's
    // report_game_over). Either way this only needs recording here for
    // bookkeeping (it's what tells the unmount-cleanup below and a later
    // reconnect that this match is actually finished) — applying it to the
    // live board is ChessGame's own onGameOver -> endGameByTimeout, which
    // never needs a remount since it doesn't touch moveHistory.
    function handleGameOver(payload) {
      setMatchResult(payload)
    }

    function handleRoomError(payload) {
      setPending(false)
      setError(payload.message)
    }

    // Ask the server to resume whatever room/match this identity was last
    // in. Runs immediately if already connected, and again on every future
    // (re)connect — that one listener covers both a hard refresh (brand
    // new socket) and Socket.IO's own automatic reconnect after a brief
    // network drop (same socket instance, new id).
    function attemptRejoin() {
      const savedRoomId = getSavedRoomId()
      if (!savedRoomId) return
      setRejoining(true)
      socket.emit('rejoin_room', { roomId: savedRoomId, playerId: getPlayerId() })
    }

    if (socket.connected) attemptRejoin()
    socket.on('connect', attemptRejoin)

    socket.on('room_created', handleRoomCreated)
    socket.on('room_joined', handleRoomJoined)
    socket.on('game_started', handleGameStarted)
    socket.on('game_state', handleGameState)
    socket.on('rejoin_failed', handleRejoinFailed)
    socket.on('room_left', handleRoomLeft)
    socket.on('opponent_disconnected', handleOpponentDisconnected)
    socket.on('opponent_reconnected', handleOpponentReconnected)
    socket.on('game_over', handleGameOver)
    socket.on('room_error', handleRoomError)

    return () => {
      socket.off('connect', attemptRejoin)
      socket.off('room_created', handleRoomCreated)
      socket.off('room_joined', handleRoomJoined)
      socket.off('game_started', handleGameStarted)
      socket.off('game_state', handleGameState)
      socket.off('rejoin_failed', handleRejoinFailed)
      socket.off('room_left', handleRoomLeft)
      socket.off('opponent_disconnected', handleOpponentDisconnected)
      socket.off('opponent_reconnected', handleOpponentReconnected)
      socket.off('game_over', handleGameOver)
      socket.off('room_error', handleRoomError)
    }
  }, [])

  const createRoom = useCallback(() => {
    setError(null)
    setPending(true)
    socket.emit('create_room', { playerId: getPlayerId() })
  }, [])

  const joinRoom = useCallback((roomId) => {
    setError(null)
    setPending(true)
    socket.emit('join_room', { roomId, playerId: getPlayerId() })
  }, [])

  // No room_left confirmation is sent back to the player who left (only to
  // whoever remains), so the local view clears itself right away.
  const leaveRoom = useCallback(() => {
    if (!room) return
    socket.emit('leave_room')
    clearSavedRoomId()
    setRoom(null)
    setYou(null)
    setOpponent(null)
    setCurrentTurn(null)
    setMoveHistory([])
    setMatchResult(null)
    setTimerState(null)
    setPending(false)
    setError(null)
    setNotice(null)
    wasPlayingRef.current = false
  }, [room])

  return {
    room,
    you,
    opponent,
    currentTurn,
    moveHistory,
    matchResult,
    timerState,
    opponentConnected,
    error,
    notice,
    pending,
    rejoining,
    restoreVersion,
    createRoom,
    joinRoom,
    leaveRoom,
  }
}

export default useRoom
