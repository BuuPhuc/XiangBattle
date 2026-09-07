// Quick Play: a lightweight waiting-queue layered on top of the existing
// Room system, never a parallel one — once two players are matched this
// hands off entirely to roomManager.createRoom/joinRoom (the exact same
// calls the manual Create Room / Join Room flow already makes), so
// everything downstream (color assignment, startGame, reconnect, resign,
// draw, game_over) keeps working unmodified.
//
// playerId -> { socketId, playerId }, in the order players started
// waiting. Module-level (like reconnectHandler's pendingForfeits) since a
// player waiting to be matched isn't in any Room yet — there's nowhere on
// roomManager to hang this state.
const waitingQueue = new Map()

function registerMatchmakingHandlers(io, socket, roomManager) {
  socket.on('quick_play', (payload) => {
    const playerId = payload && payload.playerId
    if (!playerId) {
      socket.emit('room_error', { code: 'INVALID_PLAYER_ID', message: 'Thiếu thông tin định danh người chơi.' })
      return
    }
    if (roomManager.isSocketInRoom(socket.id) || roomManager.isPlayerIdInRoom(playerId)) {
      socket.emit('room_error', { code: 'ALREADY_IN_ROOM', message: 'Bạn đang ở trong một phòng khác.' })
      return
    }

    const existing = waitingQueue.get(playerId)
    if (existing) {
      // Same identity clicking Quick Play again (double click, or a
      // reopened tab re-sending it) — never let them occupy two slots,
      // just make sure match_found would reach this current socket.
      existing.socketId = socket.id
      socket.emit('quick_play_queued')
      return
    }

    // Longest-waiting opponent with a socket that's still actually
    // connected, self-healing past any stale entry a disconnect somehow
    // didn't clean up (see removeFromQuickPlayQueue below). Everything
    // still in the queue at this point is necessarily someone else — this
    // player's own identity was already handled by the `existing` check
    // above, so it can never end up matched against itself.
    let opponentEntry = null
    for (const entry of waitingQueue.values()) {
      if (io.sockets.sockets.has(entry.socketId)) {
        opponentEntry = entry
        break
      }
      waitingQueue.delete(entry.playerId)
    }

    if (!opponentEntry) {
      waitingQueue.set(playerId, { socketId: socket.id, playerId })
      socket.emit('quick_play_queued')
      console.log(`[matchmaking] ${playerId} joined the queue`)
      return
    }

    waitingQueue.delete(opponentEntry.playerId)

    let room
    try {
      const created = roomManager.createRoom(opponentEntry.socketId, opponentEntry.playerId)
      room = roomManager.joinRoom(created.roomId, socket.id, playerId).room
    } catch (error) {
      // Narrow race (e.g. one identity got into a room some other way
      // between being dequeued and matched) — don't strand the caller,
      // queue them instead of failing silently.
      console.log(`[matchmaking] match attempt failed (${error.message}), re-queueing ${playerId}`)
      waitingQueue.set(playerId, { socketId: socket.id, playerId })
      socket.emit('quick_play_queued')
      return
    }

    const opponentSocket = io.sockets.sockets.get(opponentEntry.socketId)
    opponentSocket.join(room.roomId)
    socket.join(room.roomId)

    console.log(`[matchmaking] matched ${opponentEntry.playerId} vs ${playerId} into room ${room.roomId}`)

    // Same per-recipient shape as game_started/game_state (you/opponent
    // differ per socket) — the frontend treats this identically to a
    // manual join_room that immediately filled the last seat.
    room.players.forEach((player) => {
      io.to(player.socketId).emit('match_found', room.toGameStarted(player.socketId))
    })
  })

  socket.on('cancel_quick_play', (payload) => {
    const playerId = payload && payload.playerId
    if (!playerId) return
    if (waitingQueue.delete(playerId)) {
      console.log(`[matchmaking] ${playerId} left the queue`)
    }
  })
}

// Called from socketHandler.js's disconnect handler — a player who closes
// their tab while still waiting for a match must never linger in the
// queue and get matched against a socket that's no longer there.
function removeFromQuickPlayQueue(socketId) {
  for (const [playerId, entry] of waitingQueue) {
    if (entry.socketId === socketId) {
      waitingQueue.delete(playerId)
      console.log(`[matchmaking] ${playerId} removed from queue (disconnected)`)
      return
    }
  }
}

module.exports = { registerMatchmakingHandlers, removeFromQuickPlayQueue }
