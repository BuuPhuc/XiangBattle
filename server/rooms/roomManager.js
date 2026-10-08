const { Room, ROOM_STATUS } = require('./room')

// Excludes 0/O/1/I so a spoken-aloud or handwritten code stays unambiguous.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 6

function generateRoomCode() {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

function roomError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

// In-memory registry of every active room, shared by the whole socket layer
// (one instance is created in sockets/socketHandler.js). Nothing here is
// persisted — a server restart clears all rooms, which is acceptable at
// this stage since nothing here needs to survive a server restart, only a
// client refresh.
class RoomManager {
  constructor() {
    this.rooms = new Map() // roomId -> Room
    this.socketToRoom = new Map() // socketId -> roomId, so "already in a room?" is O(1) — rebound on every reconnect
    this.playerIdToRoom = new Map() // playerId -> roomId, stable across a socket change — this is what makes reconnect possible
  }

  hasRoom(roomId) {
    return this.rooms.has(roomId)
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null
  }

  getRoomBySocket(socketId) {
    const roomId = this.socketToRoom.get(socketId)
    return roomId ? this.rooms.get(roomId) || null : null
  }

  // Looked up by the stable player identity rather than a socket — finds a
  // player's room even while they are disconnected from it.
  getRoomByPlayerId(playerId) {
    const roomId = this.playerIdToRoom.get(playerId)
    return roomId ? this.rooms.get(roomId) || null : null
  }

  isSocketInRoom(socketId) {
    return this.socketToRoom.has(socketId)
  }

  isPlayerIdInRoom(playerId) {
    return this.playerIdToRoom.has(playerId)
  }

  createRoom(hostSocketId, hostPlayerId) {
    if (this.isSocketInRoom(hostSocketId) || this.isPlayerIdInRoom(hostPlayerId)) {
      throw roomError('ALREADY_IN_ROOM', 'Bạn đang ở trong một phòng khác.')
    }

    let roomId = generateRoomCode()
    while (this.rooms.has(roomId)) {
      roomId = generateRoomCode()
    }

    const room = new Room(roomId, hostSocketId, hostPlayerId)
    this.rooms.set(roomId, room)
    this.socketToRoom.set(hostSocketId, roomId)
    this.playerIdToRoom.set(hostPlayerId, roomId)
    return room
  }

  joinRoom(roomId, socketId, playerId) {
    const room = this.rooms.get(roomId)
    if (!room) {
      throw roomError('ROOM_NOT_FOUND', 'Phòng không tồn tại.')
    }

    // This exact player identity is already seated in this room — a
    // reopened tab whose silent auto-rejoin lost its saved roomId (fresh
    // localStorage tab, or the save simply raced a disconnect), so they
    // fell back to retyping the room code and hit the plain join form
    // instead of rejoin_room. Always resume them here rather than letting
    // the ALREADY_IN_ROOM/ROOM_FULL checks below reject their own seat.
    if (room.getPlayerByPlayerId(playerId)) {
      return { room: this.reconnect(roomId, playerId, socketId), reconnected: true }
    }

    if (this.isSocketInRoom(socketId) || this.isPlayerIdInRoom(playerId)) {
      throw roomError('ALREADY_IN_ROOM', 'Bạn đang ở trong một phòng khác.')
    }
    if (room.status !== ROOM_STATUS.WAITING) {
      throw roomError('ROOM_NOT_JOINABLE', 'Phòng hiện không thể tham gia.')
    }
    if (room.isFull()) {
      throw roomError('ROOM_FULL', 'Phòng đã đủ người chơi.')
    }

    const player = room.addPlayer(socketId, playerId)
    this.socketToRoom.set(socketId, roomId)
    this.playerIdToRoom.set(playerId, roomId)

    // Filling the last seat starts the match immediately — there is no
    // separate "ready, waiting to start" step at this stage. `justStarted`
    // tells callers this exact call is what began it (vs. an already-playing
    // room), which is what gameHistoryService.createGameRecord uses to
    // avoid persisting a Game more than once per match.
    let justStarted = false
    if (room.isFull()) {
      room.startGame()
      justStarted = true
    }

    return { room, player, reconnected: false, justStarted }
  }

  // Reattaches a fresh socket (after a refresh, or Socket.IO's own
  // automatic reconnect) to the player identity it claims to be. Never
  // creates a room or a player — only reuses what's already there, and
  // fails loudly (via a thrown error) if there's nothing valid to resume.
  reconnect(roomId, playerId, newSocketId) {
    const room = this.rooms.get(roomId)
    if (!room) {
      throw roomError('ROOM_NOT_FOUND', 'Phòng không còn tồn tại.')
    }
    const player = room.getPlayerByPlayerId(playerId)
    if (!player) {
      throw roomError('PLAYER_NOT_FOUND', 'Không tìm thấy bạn trong phòng này.')
    }

    // The old socketId (now dead, or about to be) no longer maps anywhere
    // useful — only the new one should from here on.
    this.socketToRoom.delete(player.socketId)
    room.reconnectPlayer(playerId, newSocketId)
    this.socketToRoom.set(newSocketId, roomId)
    return room
  }

  // Marks whichever player owns this socket as disconnected, WITHOUT
  // removing them or touching any match state — used when a disconnect
  // happens mid-match, so there's something for a later rejoin to resume.
  // The (now-dead) socketId->room mapping is dropped immediately, but
  // playerIdToRoom is left alone on purpose — that's what a reconnect
  // looks the player back up by.
  markDisconnected(socketId) {
    const roomId = this.socketToRoom.get(socketId)
    if (!roomId) return null
    const room = this.rooms.get(roomId)
    this.socketToRoom.delete(socketId)
    if (!room) return null
    const player = room.markDisconnected(socketId)
    return player ? { room, player } : null
  }

  // Removes whichever room the socket is in (if any). Returns null if the
  // socket wasn't in a room, otherwise { room, deleted } — `room` still
  // reflects the remaining players so the caller can notify them, `deleted`
  // says whether it was removed from the registry for being empty.
  leaveRoom(socketId) {
    const roomId = this.socketToRoom.get(socketId)
    if (!roomId) return null

    const room = this.rooms.get(roomId)
    this.socketToRoom.delete(socketId)
    if (!room) return null

    const player = room.getPlayer(socketId)
    if (player) this.playerIdToRoom.delete(player.playerId)

    room.removePlayer(socketId)

    if (room.isEmpty()) {
      this.rooms.delete(roomId)
      return { room, deleted: true }
    }
    return { room, deleted: false }
  }

  deleteRoom(roomId) {
    const room = this.rooms.get(roomId)
    if (!room) return
    room.players.forEach((player) => {
      this.socketToRoom.delete(player.socketId)
      this.playerIdToRoom.delete(player.playerId)
    })
    this.rooms.delete(roomId)
  }
}

module.exports = RoomManager
