const { ROOM_STATUS, GAME_STATUS } = require('../rooms/room')
const { createGameRecord, attachPlayerRatings, saveMoveRecord, finishGameRecord } = require('../services/gameHistoryService')

function moveError(code, message) {
  return { code, message }
}

// Sends every player in the room their own game_started payload (each gets
// a different `you`/`opponent`, so this can't be a single io.to().emit()).
// Used both for a brand new match (join_room, in socketHandler.js) and for
// a same-room rematch (play_again, below) — a fresh match is a fresh match
// either way, and both cases hand down the exact same shape. `dbGameId` is
// null until gameHistoryService's async create resolves (see
// `game_persisted`, emitted separately once it does) — never blocks this.
function broadcastGameStarted(io, room) {
  room.players.forEach((player) => {
    io.to(player.socketId).emit('game_started', { ...room.toGameStarted(player.socketId), dbGameId: room.dbGameId || null })
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
    saveMoveRecord(room, entry, player)

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

    // Unlike resign/offer_draw below, this handler has no earlier
    // matchResult guard — a checkmate report can race a resign/forfeit that
    // already concluded the match, and recordMatchResult's own idempotency
    // only protects the in-memory result, not the DB write.
    const wasFinished = Boolean(room.matchResult)
    const result = room.recordMatchResult(status, winner)
    console.log(`[game] ${room.roomId} reported over (${status}) — ${result.winner} wins`)
    io.to(room.roomId).emit('game_over', result)
    if (!wasFinished) finishGameRecord(io, room, status, winner)
  })

  // A player conceding outright, independent of the board position — the
  // server is the sole authority on the outcome here too, exactly like
  // report_game_over: it never trusts a client-sent winner, it derives the
  // opponent from room membership and records the result itself. Same
  // guards as make_move (must be an active, unfinished match and an actual
  // seated player) so resigning can't fire before the match starts or
  // after it's already over.
  socket.on('resign', () => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('room_error', { code: 'NOT_IN_ROOM', message: 'Bạn không ở trong phòng nào.' })
      return
    }
    if (room.status !== ROOM_STATUS.PLAYING || room.matchResult) {
      socket.emit('room_error', { code: 'GAME_NOT_PLAYING', message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc.' })
      return
    }
    const player = room.getPlayer(socket.id)
    if (!player || !player.color) {
      socket.emit('room_error', { code: 'NOT_A_PLAYER', message: 'Bạn không phải người chơi trong trận này.' })
      return
    }

    const winner = player.color === 'red' ? 'black' : 'red'
    const result = room.recordMatchResult(GAME_STATUS.RESIGN, winner)
    console.log(`[game] ${room.roomId} ${player.color} resigned — ${winner} wins`)
    io.to(room.roomId).emit('game_over', result)
    finishGameRecord(io, room, GAME_STATUS.RESIGN, winner)
  })

  // One player proposing a draw. Same active-match/seated-player guards as
  // resign, plus: never let a second offer stack on top of one already
  // pending (from either side) — the responder has to resolve the existing
  // one first. Only the offering socket gets an ack (draw_offer_sent, so
  // its own UI can flip to "waiting"); only the other player gets the
  // prompt (draw_offered) — never broadcast this one to the whole room.
  socket.on('offer_draw', () => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('room_error', { code: 'NOT_IN_ROOM', message: 'Bạn không ở trong phòng nào.' })
      return
    }
    if (room.status !== ROOM_STATUS.PLAYING || room.matchResult) {
      socket.emit('room_error', { code: 'GAME_NOT_PLAYING', message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc.' })
      return
    }
    const player = room.getPlayer(socket.id)
    if (!player || !player.color) {
      socket.emit('room_error', { code: 'NOT_A_PLAYER', message: 'Bạn không phải người chơi trong trận này.' })
      return
    }
    if (room.drawOfferBy) {
      socket.emit('room_error', { code: 'DRAW_OFFER_PENDING', message: 'Đã có lời đề nghị hòa đang chờ phản hồi.' })
      return
    }

    room.offerDraw(player.color)
    console.log(`[game] ${room.roomId} ${player.color} offered a draw`)
    socket.emit('draw_offer_sent')
    socket.to(room.roomId).emit('draw_offered', { fromColor: player.color })
  })

  // The other player's answer to a pending draw offer — never the
  // offerer's own socket (drawOfferBy === player.color is rejected, same
  // as there being no offer at all). Accepting is the one path where
  // GAME_STATUS.DRAW gets recorded with a null winner/loser — the server
  // decides this outright, the client only ever sends its yes/no intent,
  // never a result. Declining just withdraws the offer and lets the match
  // continue untouched: no board/timer/history state is involved either way.
  socket.on('respond_draw', (payload) => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('room_error', { code: 'NOT_IN_ROOM', message: 'Bạn không ở trong phòng nào.' })
      return
    }
    if (room.status !== ROOM_STATUS.PLAYING || room.matchResult) {
      socket.emit('room_error', { code: 'GAME_NOT_PLAYING', message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc.' })
      return
    }
    const player = room.getPlayer(socket.id)
    if (!player || !player.color) {
      socket.emit('room_error', { code: 'NOT_A_PLAYER', message: 'Bạn không phải người chơi trong trận này.' })
      return
    }
    if (!room.drawOfferBy || room.drawOfferBy === player.color) {
      socket.emit('room_error', { code: 'NO_DRAW_OFFER', message: 'Không có lời đề nghị hòa nào để phản hồi.' })
      return
    }

    if (payload && payload.accept) {
      const result = room.recordMatchResult(GAME_STATUS.DRAW, null)
      console.log(`[game] ${room.roomId} draw accepted by ${player.color}`)
      io.to(room.roomId).emit('game_over', result)
      finishGameRecord(io, room, GAME_STATUS.DRAW, null)
    } else {
      room.clearDrawOffer()
      console.log(`[game] ${room.roomId} draw declined by ${player.color}`)
      io.to(room.roomId).emit('draw_offer_declined')
    }
  })

  // A rematch actually starting — shared by both the mutual-request and the
  // explicit-accept paths below. Reuses startGame() on the same Room: same
  // seats/colors as before, board/history/timer/result all reset exactly
  // like a brand new game_started.
  function startRematch(room) {
    room.clearPlayAgainRequest()
    room.startGame()
    console.log(`[game] ${room.roomId} rematch started`)
    // Resets room.dbGameId (synchronously, before its own DB work) ahead of
    // the broadcast below — otherwise the just-finished match's dbGameId
    // would briefly leak into this brand new match's game_started payload.
    createGameRecord(io, room)
    attachPlayerRatings(io, room)
    broadcastGameStarted(io, room)
  }

  // One player asking for a rematch once the current match has actually
  // concluded. This never restarts the match unilaterally — the other side
  // has to agree first, exactly like a draw offer. If the other side
  // already asked (both players clicked "Chơi lại" independently), this
  // call is treated as accepting that existing request outright, since the
  // outcome — both wanting a rematch — is identical either way.
  socket.on('request_play_again', () => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('room_error', { code: 'NOT_IN_ROOM', message: 'Bạn không ở trong phòng nào.' })
      return
    }
    if (!room.matchResult) {
      socket.emit('room_error', { code: 'GAME_STILL_PLAYING', message: 'Trận đấu hiện tại chưa kết thúc.' })
      return
    }
    const player = room.getPlayer(socket.id)
    if (!player || !player.color) {
      socket.emit('room_error', { code: 'NOT_A_PLAYER', message: 'Bạn không phải người chơi trong trận này.' })
      return
    }
    if (!room.isFull() || !room.players.every((p) => p.connected)) {
      socket.emit('room_error', { code: 'OPPONENT_UNAVAILABLE', message: 'Đối thủ hiện không có mặt để chơi lại.' })
      return
    }

    if (room.playAgainRequestBy === player.color) {
      // Duplicate click from the same player — nothing new to do, just
      // re-ack so their own UI stays in the "waiting" state.
      socket.emit('play_again_request_sent')
      return
    }

    if (room.playAgainRequestBy) {
      console.log(`[game] ${room.roomId} rematch requested by both players — starting`)
      startRematch(room)
      return
    }

    room.requestPlayAgain(player.color)
    console.log(`[game] ${room.roomId} ${player.color} requested a rematch`)
    socket.emit('play_again_request_sent')
    socket.to(room.roomId).emit('play_again_requested', { fromColor: player.color })
  })

  // The other player's answer to a pending rematch request — never the
  // requester's own socket (playAgainRequestBy === player.color is rejected,
  // same as there being no request at all).
  socket.on('respond_play_again', (payload) => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('room_error', { code: 'NOT_IN_ROOM', message: 'Bạn không ở trong phòng nào.' })
      return
    }
    const player = room.getPlayer(socket.id)
    if (!player || !player.color) {
      socket.emit('room_error', { code: 'NOT_A_PLAYER', message: 'Bạn không phải người chơi trong trận này.' })
      return
    }
    if (!room.playAgainRequestBy || room.playAgainRequestBy === player.color) {
      socket.emit('room_error', { code: 'NO_PLAY_AGAIN_REQUEST', message: 'Không có lời mời chơi lại nào để phản hồi.' })
      return
    }

    if (payload && payload.accept) {
      console.log(`[game] ${room.roomId} rematch accepted by ${player.color}`)
      startRematch(room)
    } else {
      room.clearPlayAgainRequest()
      console.log(`[game] ${room.roomId} rematch declined by ${player.color}`)
      io.to(room.roomId).emit('play_again_declined')
    }
  })
}

module.exports = { registerGameHandlers, broadcastGameStarted }
