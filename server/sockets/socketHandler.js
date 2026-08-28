const RoomManager = require('../rooms/roomManager')
const { ROOM_STATUS } = require('../rooms/room')
const { registerGameHandlers, broadcastGameStarted } = require('./gameHandler')
const { registerReconnectHandlers, scheduleDisconnectForfeit, cancelDisconnectForfeit } = require('./reconnectHandler')

function normalizeRoomId(rawRoomId) {
  return typeof rawRoomId === 'string' ? rawRoomId.trim().toUpperCase() : ''
}

// A match is only "active" — worth a reconnect grace period, worth
// notifying the other player about — while it's actually still being
// played. Once matchResult is set (checkmate/timeout reported by a
// client, or an earlier forfeit), the room is done even though its status
// field still says PLAYING; nothing here should keep treating it as live.
function isActiveMatch(room) {
  return Boolean(room) && room.status === ROOM_STATUS.PLAYING && !room.matchResult
}

// Removes the socket's player from whatever room it's in (if any) for
// good, and tells whoever remains — unless the match had already
// concluded before this leave, in which case the remaining player's own
// (already final) Game Over view has nothing new to learn and shouldn't
// be disturbed by the room quietly reverting to "waiting". This is *only*
// ever called for an explicit leave_room — a plain disconnect (see
// handleDisconnect below) never removes a player on its own anymore, so
// that a refresh always has something to reconnect back into regardless
// of whether the room was still waiting, mid-match, or already finished.
function leaveCurrentRoom(io, socket, roomManager) {
  const room = roomManager.getRoomBySocket(socket.id)
  if (!room) return

  const player = room.getPlayer(socket.id)
  const roomId = room.roomId
  const wasFinished = Boolean(room.matchResult)
  const result = roomManager.leaveRoom(socket.id)
  socket.leave(roomId)
  if (player) cancelDisconnectForfeit(player.playerId)
  if (!result) return

  if (result.deleted) {
    console.log(`[room] ${roomId} deleted (empty)`)
    return
  }

  console.log(`[room] ${socket.id} left ${roomId}`)
  if (!wasFinished) {
    io.to(roomId).emit('room_left', result.room.toPublic())
  }
}

// A disconnect while a match is actively in progress doesn't tear anything
// down — it starts a reconnect grace period instead, so a refresh or a
// brief network drop doesn't cost the player their game. Only once that
// window expires without a rejoin does reconnectHandler declare a forfeit.
function handleMidMatchDisconnect(io, roomManager, socket, room) {
  const result = roomManager.markDisconnected(socket.id)
  if (!result) return
  const { player } = result
  console.log(`[reconnect] ${player.playerId} disconnected from ${room.roomId} — grace period started`)
  io.to(room.roomId).emit('opponent_disconnected', { playerNumber: player.playerNumber })
  scheduleDisconnectForfeit(io, roomManager, room.roomId, player.playerId)
}

// Registers the base Socket.IO connection lifecycle plus the Room system's
// events (create/join/leave/game_started), realtime move sync, and
// reconnect handling. The server only assigns seats, colors, whose turn it
// is, and (via reconnect) which socket a player identity currently owns —
// it never validates moves, that stays entirely in the existing frontend
// game logic on whichever client is moving.
function registerSocketHandlers(io) {
  const roomManager = new RoomManager()

  io.on('connection', (socket) => {
    console.log(`[socket] client connected: ${socket.id} (${socket.handshake.address})`)

    registerGameHandlers(io, socket, roomManager)
    registerReconnectHandlers(io, socket, roomManager)

    socket.on('create_room', (payload) => {
      const playerId = payload && payload.playerId
      if (!playerId) {
        socket.emit('room_error', { code: 'INVALID_PLAYER_ID', message: 'Thiếu thông tin định danh người chơi.' })
        return
      }

      let room
      try {
        room = roomManager.createRoom(socket.id, playerId)
      } catch (error) {
        socket.emit('room_error', { code: error.code || 'CREATE_FAILED', message: error.message })
        return
      }

      socket.join(room.roomId)
      console.log(`[room] ${room.roomId} created by ${socket.id}`)
      socket.emit('room_created', { ...room.toPublic(), you: { playerNumber: 1, color: null } })
    })

    socket.on('join_room', (payload) => {
      const roomId = normalizeRoomId(payload && payload.roomId)
      const playerId = payload && payload.playerId
      if (!roomId) {
        socket.emit('room_error', { code: 'INVALID_ROOM_ID', message: 'Mã phòng không hợp lệ.' })
        return
      }
      if (!playerId) {
        socket.emit('room_error', { code: 'INVALID_PLAYER_ID', message: 'Thiếu thông tin định danh người chơi.' })
        return
      }

      let result
      try {
        result = roomManager.joinRoom(roomId, socket.id, playerId)
      } catch (error) {
        socket.emit('room_error', { code: error.code || 'JOIN_FAILED', message: error.message })
        return
      }

      const { room, player } = result
      socket.join(room.roomId)
      console.log(`[room] ${room.roomId} joined by ${socket.id}`)
      socket.emit('room_joined', { ...room.toPublic(), you: { playerNumber: player.playerNumber, color: player.color } })

      if (room.status === ROOM_STATUS.PLAYING) {
        console.log(`[room] ${room.roomId} game started (red=${room.players[0].socketId})`)
        broadcastGameStarted(io, room)
      }
    })

    socket.on('leave_room', () => {
      leaveCurrentRoom(io, socket, roomManager)
    })

    // A disconnect never immediately removes a player from a room — it
    // only marks them disconnected, so a refresh (or a brief network
    // drop) always has a room to reconnect back into, whether it was
    // still waiting for an opponent, mid-match, or already finished. The
    // one case with real time pressure is an *active* match: there, an
    // opponent is actually waiting on this player, so a grace period
    // starts, and reconnectHandler declares a forfeit if it expires.
    // Removing a player for good only ever happens via an explicit
    // leave_room (Hủy phòng / Rời phòng, or useRoom's unmount-cleanup
    // after a finished match).
    socket.on('disconnect', (reason) => {
      console.log(`[socket] client disconnected: ${socket.id} (${reason})`)
      const room = roomManager.getRoomBySocket(socket.id)
      if (isActiveMatch(room)) {
        handleMidMatchDisconnect(io, roomManager, socket, room)
      } else {
        roomManager.markDisconnected(socket.id)
      }
    })
  })
}

module.exports = registerSocketHandlers
