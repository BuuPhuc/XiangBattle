import { useCallback, useEffect, useState } from 'react'
import socket from '../../socket/socket'
import { getPlayerId } from '../room/roomSession'
import { MAX_MESSAGE_LENGTH } from '../chat/chatUtils'

// Watching one room ("Xem ván đang diễn ra"). Asks the server to watch
// `roomId` on mount and on every (re)connect, and keeps what it sends:
//  - `snapshot`: the full picture (spectate:state) — on watch, and again
//    whenever a new match starts in the room (a rematch). `version` bumps
//    with each, so the board can remount fresh from it (same pattern as
//    useRoom's restoreVersion);
//  - `moves`: moves played since that snapshot, in order. Kept here (not in
//    the board) so none can slip by between a snapshot and the board
//    mounting;
//  - result, players, who's watching, the spectators' chat, connection
//    drops, and the room closing.
// All spectator events are `spectate:*` (plus spectators_update), so none
// of this can clash with the player hooks.

const tagMine = (entry) => ({ ...entry, mine: entry.playerId === getPlayerId() })

function connectionFrom(players) {
  const connection = { red: true, black: true }
  ;(players || []).forEach((player) => {
    if (player.color) connection[player.color] = player.connected !== false
  })
  return connection
}

export function useSpectate(roomId) {
  const [snapshot, setSnapshot] = useState(null)
  const [version, setVersion] = useState(0)
  const [moves, setMoves] = useState([])
  const [result, setResult] = useState(null)
  const [players, setPlayers] = useState([])
  const [spectators, setSpectators] = useState(null)
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [dbGameId, setDbGameId] = useState(null)
  const [ratingUpdate, setRatingUpdate] = useState(null)
  const [connection, setConnection] = useState({ red: true, black: true })
  const [playerLeft, setPlayerLeft] = useState(null) // color of a player who left the room
  const [closed, setClosed] = useState(false) // the room is gone (both players left)
  const [notFound, setNotFound] = useState(null) // { code, message } when the room can't be watched
  const [chatError, setChatError] = useState(null)

  useEffect(() => {
    if (!roomId) return undefined

    function watch() {
      socket.emit('watch_room', { roomId, playerId: getPlayerId() })
    }

    function handleState(payload) {
      setSnapshot(payload)
      setVersion((v) => v + 1)
      setMoves([])
      setResult(payload.matchResult ?? null)
      setPlayers(payload.players ?? [])
      setSpectators(payload.spectators ?? null)
      setMessages((payload.messages ?? []).map(tagMine))
      setDbGameId(payload.dbGameId ?? null)
      setRatingUpdate(null)
      setConnection(connectionFrom(payload.players))
      setPlayerLeft(null)
      setClosed(false)
      setNotFound(null)
    }
    const handleMove = (payload) => setMoves((current) => [...current, payload.move])
    const handleGameOver = (payload) => setResult(payload)
    const handlePlayers = (payload) => setPlayers(payload.players ?? [])
    const handlePersisted = (payload) => setDbGameId(payload.gameId)
    const handleRatingUpdated = (payload) => setRatingUpdate(payload)
    const handleConnection = (payload) =>
      setConnection((current) => (payload.color ? { ...current, [payload.color]: payload.connected } : current))
    const handlePlayerLeft = (payload) => setPlayerLeft(payload.color ?? 'unknown')
    const handleClosed = () => setClosed(true)
    const handleSpectators = (payload) => setSpectators(payload)
    function handleChatMessage(entry) {
      setMessages((current) => [...current, tagMine(entry)])
      setUnreadCount((count) => count + 1)
    }
    function handleError(payload) {
      if (payload.code === 'ROOM_NOT_FOUND' || payload.code === 'YOU_ARE_PLAYING' || payload.code === 'INVALID_ROOM_ID') {
        setNotFound(payload)
      } else {
        setChatError(payload.message)
      }
    }

    socket.on('spectate:state', handleState)
    socket.on('spectate:move', handleMove)
    socket.on('spectate:game_over', handleGameOver)
    socket.on('spectate:players', handlePlayers)
    socket.on('spectate:persisted', handlePersisted)
    socket.on('spectate:rating_updated', handleRatingUpdated)
    socket.on('spectate:connection', handleConnection)
    socket.on('spectate:player_left', handlePlayerLeft)
    socket.on('spectate:closed', handleClosed)
    socket.on('spectate:chat_message', handleChatMessage)
    socket.on('spectate:error', handleError)
    socket.on('spectators_update', handleSpectators)
    socket.on('connect', watch)
    if (socket.connected) watch()

    return () => {
      socket.emit('unwatch_room')
      socket.off('spectate:state', handleState)
      socket.off('spectate:move', handleMove)
      socket.off('spectate:game_over', handleGameOver)
      socket.off('spectate:players', handlePlayers)
      socket.off('spectate:persisted', handlePersisted)
      socket.off('spectate:rating_updated', handleRatingUpdated)
      socket.off('spectate:connection', handleConnection)
      socket.off('spectate:player_left', handlePlayerLeft)
      socket.off('spectate:closed', handleClosed)
      socket.off('spectate:chat_message', handleChatMessage)
      socket.off('spectate:error', handleError)
      socket.off('spectators_update', handleSpectators)
      socket.off('connect', watch)
    }
  }, [roomId])

  const sendMessage = useCallback((text) => {
    const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!trimmed) return
    setChatError(null)
    socket.emit('spectate:chat_send', { message: trimmed })
  }, [])

  const markRead = useCallback(() => setUnreadCount(0), [])

  return {
    snapshot,
    version,
    moves,
    result,
    players,
    spectators,
    messages,
    unreadCount,
    markRead,
    sendMessage,
    chatError,
    dbGameId,
    ratingUpdate,
    connection,
    playerLeft,
    closed,
    notFound,
  }
}

export default useSpectate
