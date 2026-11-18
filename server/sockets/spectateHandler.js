const { resolvePlayerId } = require('../utils/playerIdentity')
const { watchChannel, toWatchers, broadcastSpectators } = require('./spectatorEvents')

// "Xem ván đang diễn ra": anyone — signed in or not — may watch any room.
// Watching is read-only by construction: a spectator is never seated, so
// every player event (make_move, resign, offer_draw, chat:send…) finds no
// room for their socket and is refused. What they do get is listed in
// spectatorEvents.js.
//
// Spectators have a chat of their own ("Khán giả"); only signed-in viewers
// may write in it, guests read along. The players never see it.

const MAX_LIVE_GAMES = 50
const MAX_MESSAGE_LENGTH = 200
const RATE_LIMIT_WINDOW_MS = 10_000
const RATE_LIMIT_MAX_MESSAGES = 10

function normalizeRoomId(rawRoomId) {
  return typeof rawRoomId === 'string' ? rawRoomId.trim().toUpperCase() : ''
}

function spectateError(socket, code, message) {
  socket.emit('spectate:error', { code, message })
}

// Best-effort avatar for a signed-in viewer, for the list behind the eye.
// Never blocks watching; a failed lookup just leaves the initial letter.
async function loadViewerAvatar(io, room, viewer) {
  try {
    const { db } = require('../prisma/db')
    const row = await db.orm.public.User.select('id', 'avatarUrl').first({ id: viewer.userId })
    if (!row || !row.avatarUrl || viewer.avatarUrl === row.avatarUrl) return
    viewer.avatarUrl = row.avatarUrl
    if (room.spectators.get(viewer.key) === viewer) broadcastSpectators(io, room)
  } catch (error) {
    console.error(`[spectate] avatar lookup for user ${viewer.userId} failed:`, error.message)
  }
}

// Stops `socket` watching whatever it watches, and tells the rest of that
// audience (and the players) the new count.
function stopWatching(io, socket, roomManager) {
  const room = roomManager.unwatchRoom(socket.id)
  if (!room) return
  socket.leave(watchChannel(room.roomId))
  broadcastSpectators(io, room)
}

function registerSpectateHandlers(io, socket, roomManager) {
  socket.on('watch_room', (payload) => {
    const roomId = normalizeRoomId(payload && payload.roomId)
    if (!roomId) {
      spectateError(socket, 'INVALID_ROOM_ID', 'Mã phòng không hợp lệ.')
      return
    }
    // The same identity the viewer would play under (account id from the
    // JWT, or the guest's own id) — one person in two tabs counts once, and
    // a player can't watch their own match. A socket with no usable id
    // still watches, as itself.
    const key = resolvePlayerId(socket, payload && payload.playerId) || `s:${socket.id}`
    const viewer = {
      key,
      userId: socket.user ? socket.user.id : null,
      username: socket.user ? socket.user.username : null,
    }

    let result
    try {
      result = roomManager.watchRoom(roomId, socket.id, viewer)
    } catch (error) {
      spectateError(socket, error.code || 'WATCH_FAILED', error.message)
      return
    }
    const { room, previousRoom } = result
    if (previousRoom) {
      socket.leave(watchChannel(previousRoom.roomId))
      broadcastSpectators(io, previousRoom)
    }

    socket.join(watchChannel(room.roomId))
    console.log(`[spectate] ${socket.id} (${viewer.username || 'guest'}) watching ${room.roomId}`)
    socket.emit('spectate:state', room.toSpectatorState())
    broadcastSpectators(io, room)

    const entry = room.spectators.get(key)
    if (entry && entry.userId && !entry.avatarUrl) loadViewerAvatar(io, room, entry)
  })

  socket.on('unwatch_room', () => {
    stopWatching(io, socket, roomManager)
  })

  socket.on('spectate:chat_send', (payload) => {
    const room = roomManager.getWatchedRoom(socket.id)
    const viewer = room ? room.getSpectatorBySocket(socket.id) : null
    if (!room || !viewer) {
      spectateError(socket, 'NOT_WATCHING', 'Bạn không xem ván đấu nào.')
      return
    }
    // The account behind the socket's verified JWT — a guest (or anything
    // the client claims) can't write here.
    if (!socket.user) {
      spectateError(socket, 'LOGIN_REQUIRED', 'Đăng nhập để trò chuyện cùng khán giả.')
      return
    }

    const message = payload && typeof payload.message === 'string' ? payload.message.trim() : ''
    if (!message) {
      spectateError(socket, 'INVALID_MESSAGE', 'Tin nhắn không được để trống.')
      return
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      spectateError(socket, 'MESSAGE_TOO_LONG', `Tin nhắn tối đa ${MAX_MESSAGE_LENGTH} ký tự.`)
      return
    }

    // Same sliding-window limit as the players' chat, per viewer.
    const now = Date.now()
    viewer.messageTimestamps = viewer.messageTimestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
    if (viewer.messageTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
      spectateError(socket, 'CHAT_RATE_LIMIT', 'Bạn đang gửi tin nhắn quá nhanh, vui lòng chờ một chút.')
      return
    }
    viewer.messageTimestamps.push(now)

    const entry = room.addSpectatorMessage(`u:${socket.user.id}`, socket.user.username, message)
    toWatchers(io, room.roomId, 'chat_message', entry)
  })

  // The "Ván đang diễn ra" list, on request (the page polls). Answered via
  // the ack, newest-watched first.
  socket.on('list_live_games', (_payload, ack) => {
    if (typeof ack !== 'function') return
    const games = roomManager
      .listLiveRooms()
      .map((room) => room.toLiveSummary())
      .sort((a, b) => b.spectatorCount - a.spectatorCount || (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, MAX_LIVE_GAMES)
    ack({ games })
  })

  socket.on('disconnect', () => {
    stopWatching(io, socket, roomManager)
  })
}

module.exports = { registerSpectateHandlers }
