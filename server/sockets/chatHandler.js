const { COLORS } = require('../rooms/room')

const MAX_MESSAGE_LENGTH = 200
const RATE_LIMIT_WINDOW_MS = 10_000
const RATE_LIMIT_MAX_MESSAGES = 10

function chatError(code, message) {
  return { code, message }
}

// The name shown next to a message — no auth/profile system exists, so the
// closest stable, meaningful label the server can give is the seat's color
// once assigned (matches how the rest of the UI already refers to players
// during a match), falling back to the seat number before colors exist.
function displayName(player) {
  if (player.color === COLORS.RED) return 'Đỏ'
  if (player.color === COLORS.BLACK) return 'Đen'
  return `Người chơi ${player.playerNumber}`
}

// Realtime chat between the two players of one room, layered onto the
// existing Socket.IO connection and Room system — no new connection, no new
// room concept, no database. Messages live only in room.messages (see
// room.js) for as long as the room exists; the server is the sole authority
// on who sent a message and when, the client only ever sends the raw text.
function registerChatHandlers(io, socket, roomManager) {
  socket.on('chat:send', (payload) => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('room_error', chatError('NOT_IN_ROOM', 'Bạn không ở trong phòng nào.'))
      return
    }

    const player = room.getPlayer(socket.id)
    if (!player) {
      socket.emit('room_error', chatError('NOT_A_PLAYER', 'Bạn không phải người chơi trong phòng này.'))
      return
    }

    const rawMessage = payload && typeof payload.message === 'string' ? payload.message : ''
    const message = rawMessage.trim()
    if (!message) {
      socket.emit('room_error', chatError('INVALID_MESSAGE', 'Tin nhắn không được để trống.'))
      return
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      socket.emit('room_error', chatError('MESSAGE_TOO_LONG', `Tin nhắn tối đa ${MAX_MESSAGE_LENGTH} ký tự.`))
      return
    }

    // Simple sliding-window rate limit, tracked per player (not per socket,
    // so it survives a reconnect mid-window). No moderation system, just
    // enough to stop a client from flooding the room.
    const now = Date.now()
    player.messageTimestamps = (player.messageTimestamps || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
    if (player.messageTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
      socket.emit('room_error', chatError('CHAT_RATE_LIMIT', 'Bạn đang gửi tin nhắn quá nhanh, vui lòng chờ một chút.'))
      return
    }
    player.messageTimestamps.push(now)

    const entry = room.addMessage(player.playerId, displayName(player), message)
    io.to(room.roomId).emit('chat:message', entry)
  })
}

module.exports = { registerChatHandlers }
