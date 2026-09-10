const { ROOM_STATUS, GAME_STATUS } = require('../rooms/room')
const { finishGameRecord } = require('../services/gameHistoryService')

// How long a mid-match disconnect is given to come back before the match is
// forfeited to the other player. A plain refresh reconnects in well under a
// second; this is sized for "phone dropped wifi for a bit", not for a
// vanished player.
const DISCONNECT_GRACE_PERIOD_MS = 45_000

// playerId -> pending forfeit timeout handle. Module-level (not per-room)
// since a player's identity, not their room, is what a reconnect looks up
// by — and it needs to be reachable from both the disconnect path and the
// reconnect path without threading extra state through Room/RoomManager.
const pendingForfeits = new Map()

function cancelDisconnectForfeit(playerId) {
  const handle = pendingForfeits.get(playerId)
  if (handle) {
    clearTimeout(handle)
    pendingForfeits.delete(playerId)
  }
}

// Starts (or restarts) the grace-period countdown for a player who just
// disconnected mid-match. If they don't reconnect in time, the opponent
// wins by forfeit — this never touches the chess clocks, which keep
// running on their own independent timestamp math regardless.
function scheduleDisconnectForfeit(io, roomManager, roomId, playerId) {
  cancelDisconnectForfeit(playerId) // never let two timers stack for the same player

  const handle = setTimeout(() => {
    pendingForfeits.delete(playerId)

    const room = roomManager.getRoom(roomId)
    if (!room) return // room is gone for some unrelated reason already

    const player = room.getPlayerByPlayerId(playerId)
    if (!player || player.connected) return // they made it back in time after all
    if (room.status !== ROOM_STATUS.PLAYING || room.matchResult) return // nothing in-progress left to forfeit

    const winner = player.color === 'red' ? 'black' : 'red'
    const result = room.recordMatchResult(GAME_STATUS.OPPONENT_LEFT, winner)
    console.log(`[reconnect] ${playerId} did not reconnect in time — ${winner} wins ${room.roomId} by forfeit`)
    io.to(room.roomId).emit('game_over', result)
    finishGameRecord(room, GAME_STATUS.OPPONENT_LEFT, winner)
  }, DISCONNECT_GRACE_PERIOD_MS)

  pendingForfeits.set(playerId, handle)
}

function normalizeRoomId(rawRoomId) {
  return typeof rawRoomId === 'string' ? rawRoomId.trim().toUpperCase() : ''
}

// Shared tail end of any successful reconnect, regardless of which event
// triggered it (rejoin_room below, or join_room in socketHandler.js
// recognizing a retyped room code as an existing player): attach the new
// socket to the room's Socket.IO channel, cancel any forfeit countdown
// that was ticking, and hand the reconnecting client the full current
// match snapshot (board/turn/history/timer/result) instead of a "you
// joined a fresh room" payload — this is what lets the client resume
// exactly where it left off instead of resetting anything.
function completeRejoin(io, socket, room, playerId) {
  socket.join(room.roomId)
  cancelDisconnectForfeit(playerId)

  const player = room.getPlayerByPlayerId(playerId)
  console.log(`[reconnect] ${playerId} reconnected to ${room.roomId} as ${socket.id}`)

  socket.emit('game_state', { ...room.toGameStarted(socket.id), dbGameId: room.dbGameId || null })

  if (room.status === ROOM_STATUS.PLAYING) {
    socket.to(room.roomId).emit('opponent_reconnected', { playerNumber: player.playerNumber })
  }

  return player
}

// Registers the reconnect handshake for one socket: a client that already
// has a { roomId, playerId } from a previous session (kept in
// localStorage across refreshes/closed tabs) sends it here to resume —
// never to create a new room or player, only to reattach to what's
// already there.
function registerReconnectHandlers(io, socket, roomManager) {
  socket.on('rejoin_room', (payload) => {
    const roomId = normalizeRoomId(payload && payload.roomId)
    const playerId = payload && payload.playerId

    if (!roomId || !playerId) {
      socket.emit('rejoin_failed', { code: 'INVALID_REQUEST', message: 'Thiếu thông tin để khôi phục phòng.' })
      return
    }

    let room
    try {
      room = roomManager.reconnect(roomId, playerId, socket.id)
    } catch (error) {
      socket.emit('rejoin_failed', { code: error.code || 'REJOIN_FAILED', message: error.message })
      return
    }

    completeRejoin(io, socket, room, playerId)
  })
}

module.exports = {
  registerReconnectHandlers,
  completeRejoin,
  scheduleDisconnectForfeit,
  cancelDisconnectForfeit,
  DISCONNECT_GRACE_PERIOD_MS,
}
