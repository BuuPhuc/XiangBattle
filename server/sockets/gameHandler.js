const { ROOM_STATUS } = require('../rooms/room')

function moveError(code, message) {
  return { code, message }
}

// Sends every player in the room their own game_started payload (each gets
// a different `you`/`opponent`, so this can't be a single io.to().emit()).
// Used both for a brand new match (join_room, in socketHandler.js) and for
// a same-room rematch (play_again, below) — a fresh match is a fresh match
// either way, and both cases hand down the exact same shape.
function broadcastGameStarted(io, room) {
  room.players.forEach((player) => {
    io.to(player.socketId).emit('game_started', room.toGameStarted(player.socketId))
  })
}

// Registers the realtime move-sync and game-lifecycle events for one
// socket. The server is only the authority for *turn order and
// sequencing* here — room membership, whose color the sender is, and
// whose turn it is. It never re-validates chess legality (that already ran
// on the mover's client, using the same rule engine local play uses);
// this just relays the already-computed move to the other player in the
// room, in order. Game-over itself works the same way: a client that
// locally derives checkmate/timeout reports it here so the server has an
// authoritative record (needed so reconnect can tell "finished" from
// "still playing" — see room.matchResult), it never decides that itself.
function registerGameHandlers(io, socket, roomManager) {
  socket.on('make_move', (payload) => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('move_rejected', moveError('NOT_IN_ROOM', 'Bạn không ở trong phòng nào.'))
      return
    }

    if (room.status !== ROOM_STATUS.PLAYING || room.matchResult) {
      socket.emit('move_rejected', moveError('GAME_NOT_PLAYING', 'Trận đấu chưa bắt đầu hoặc đã kết thúc.'))
      return
    }

    const player = room.getPlayer(socket.id)
    if (!player || !player.color) {
      socket.emit('move_rejected', moveError('NOT_A_PLAYER', 'Bạn không phải người chơi trong trận này.'))
      return
    }

    if (player.color !== room.currentTurn) {
      socket.emit('move_rejected', moveError('NOT_YOUR_TURN', 'Chưa đến lượt của bạn.'))
      return
    }

    const move = payload && payload.move
    if (!move || !move.piece || !move.to || !move.piecesAfter) {
      socket.emit('move_rejected', moveError('INVALID_MOVE_PAYLOAD', 'Dữ liệu nước đi không hợp lệ.'))
      return
    }

    const entry = room.recordMove(move)
    console.log(`[game] ${room.roomId} move #${entry.ply} (${entry.piece.char}) by ${player.color}`)

    // The mover already applied this move to their own board optimistically
    // (same as local play) — only the opponent needs it relayed.
    socket.to(room.roomId).emit('move_made', { roomId: room.roomId, move: entry, currentTurn: room.currentTurn })
  })

  // A client just derived checkmate or a clock timeout locally (the server
  // never re-derives chess rules) and is reporting the result so it
  // becomes part of the room's authoritative state — this is what lets a
  // later reconnect (or the opponent, who may not have derived it yet in
  // the timeout case) know the match is actually over. Idempotent: the
  // first report to arrive wins, matching the disconnect-forfeit path.
  socket.on('report_game_over', (payload) => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room || room.status !== ROOM_STATUS.PLAYING) return
    const player = room.getPlayer(socket.id)
    if (!player) return

    const { status, winner } = payload || {}
    if (!status || (winner !== 'red' && winner !== 'black')) return

    const result = room.recordMatchResult(status, winner)
    console.log(`[game] ${room.roomId} reported over (${status}) — ${result.winner} wins`)
    io.to(room.roomId).emit('game_over', result)
  })

  // Either player asking for a rematch in the same room, once the current
  // match has actually concluded. Reuses startGame() — a rematch is just a
  // fresh match started on a room that already has both seats filled,
  // same colors as before, board/history/timer/result all reset exactly
  // like a brand new game_started.
  socket.on('play_again', () => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('room_error', { code: 'NOT_IN_ROOM', message: 'Bạn không ở trong phòng nào.' })
      return
    }
    if (!room.matchResult) {
      socket.emit('room_error', { code: 'GAME_STILL_PLAYING', message: 'Trận đấu hiện tại chưa kết thúc.' })
      return
    }
    if (!room.isFull() || !room.players.every((player) => player.connected)) {
      socket.emit('room_error', { code: 'OPPONENT_UNAVAILABLE', message: 'Đối thủ hiện không có mặt để chơi lại.' })
      return
    }

    room.startGame()
    console.log(`[game] ${room.roomId} rematch started`)
    broadcastGameStarted(io, room)
  })
}

module.exports = { registerGameHandlers, broadcastGameStarted }
