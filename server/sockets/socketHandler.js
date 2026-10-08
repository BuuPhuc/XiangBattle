const RoomManager = require('../rooms/roomManager')
const { ROOM_STATUS } = require('../rooms/room')
const { registerGameHandlers, broadcastGameStarted } = require('./gameHandler')
const {
  registerReconnectHandlers,
  completeRejoin,
  scheduleDisconnectForfeit,
  cancelDisconnectForfeit,
} = require('./reconnectHandler')
const { registerMatchmakingHandlers, removeFromQuickPlayQueue } = require('./matchmakingHandler')
const { registerChatHandlers } = require('./chatHandler')
const { registerChallengeHandlers } = require('./challengeHandler')
const { verifyAccessToken } = require('../utils/token')
const { createGameRecord, attachPlayerRatings, parseUserId } = require('../services/gameHistoryService')
const rematchInvites = require('../services/rematchInviteService')
const presenceService = require('../services/presenceService')

// Best-effort identity attach: a client that connected with a valid JWT
// (see src/socket/socket.js's `auth.token`) gets `socket.user = { id,
// username }`; anyone else (not logged in, or an expired/invalid token)
// still connects as a guest with `socket.user = null` — the whole Room /
// matchmaking system keeps working off the client-supplied playerId either
// way, so auth is purely additive here, never a requirement to connect.
function attachSocketUser(socket, next) {
  const token = socket.handshake.auth && socket.handshake.auth.token
  if (!token) {
    socket.user = null
    return next()
  }
  try {
    const payload = verifyAccessToken(token)
    socket.user = { id: payload.userId, username: payload.username }
  } catch {
    socket.user = null
  }
  return next()
}

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
  if (player) {
    cancelDisconnectForfeit(player.playerId)
    // A rematch invite is "come back into my room" — it ends when the
    // inviter leaves that room. (The invitee leaving does not end it; they
    // can still answer from the notification.)
    const userId = parseUserId(player.playerId)
    if (userId) rematchInvites.removeFromInviter(roomId, userId)
  }
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

  io.use(attachSocketUser)

  io.on('connection', (socket) => {
    const who = socket.user ? `${socket.user.username} (user ${socket.user.id})` : 'guest'
    console.log(`[socket] client connected: ${socket.id} (${socket.handshake.address}) — ${who}`)

    // Friend-presence tracking (see presenceService.js) piggybacks on the
    // same auth attach as everything else here — a guest socket (no
    // socket.user) simply never joins its personal room and is never
    // counted online, same "additive, never required" stance as auth
    // itself. Joining `user:<id>` is what lets friend-request acceptance
    // and presence broadcasts reach every tab/device a user has open.
    if (socket.user) {
      socket.join(presenceService.userRoom(socket.user.id))
      if (presenceService.addSocket(socket.user.id, socket.id)) {
        presenceService.broadcastPresenceChange(io, socket.user.id, true)
      }
    }

    registerGameHandlers(io, socket, roomManager)
    registerReconnectHandlers(io, socket, roomManager)
    registerMatchmakingHandlers(io, socket, roomManager)
    registerChatHandlers(io, socket, roomManager)
    registerChallengeHandlers(io, socket, roomManager)

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

      const { room, reconnected, justStarted } = result

      // roomManager recognized this playerId as already seated in the room
      // (e.g. a reopened tab that retyped the room code instead of relying
      // on the silent auto-rejoin) — resume them exactly like rejoin_room
      // would, never treat it as a brand new seat.
      if (reconnected) {
        console.log(`[reconnect] ${playerId} rejoined ${room.roomId} via join_room as ${socket.id}`)
        completeRejoin(io, socket, room, playerId)
        return
      }

      const { player } = result
      socket.join(room.roomId)
      console.log(`[room] ${room.roomId} joined by ${socket.id}`)
      socket.emit('room_joined', { ...room.toPublic(), you: { playerNumber: player.playerNumber, color: player.color } })

      if (room.status === ROOM_STATUS.PLAYING) {
        console.log(`[room] ${room.roomId} game started (red=${room.players[0].socketId})`)
        if (justStarted) {
          createGameRecord(io, room)
          attachPlayerRatings(io, room)
        }
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
      removeFromQuickPlayQueue(socket.id)
      const room = roomManager.getRoomBySocket(socket.id)
      if (isActiveMatch(room)) {
        handleMidMatchDisconnect(io, roomManager, socket, room)
      } else {
        roomManager.markDisconnected(socket.id)
      }

      // Mirrors the connect-side bookkeeping above — only flips offline
      // (and only then tells friends) once this was the user's last open
      // socket, so closing one of several tabs never falsely reports them
      // offline.
      if (socket.user && presenceService.removeSocket(socket.user.id, socket.id)) {
        presenceService.broadcastPresenceChange(io, socket.user.id, false)
      }
    })
  })
}

module.exports = registerSocketHandlers
