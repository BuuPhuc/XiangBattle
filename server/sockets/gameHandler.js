const { ROOM_STATUS, GAME_STATUS } = require('../rooms/room')
const {
  parseUserId,
  createGameRecord,
  attachPlayerRatings,
  saveMoveRecord,
  finishGameRecord,
  getFinishedGameOpponent,
} = require('../services/gameHistoryService')
const rematchInvites = require('../services/rematchInviteService')
const { checkChallengeAllowed } = require('../services/challengeService')
const { notifyRematchRequest } = require('../services/notificationService')

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
    // Whatever invite led here is now answered (read before startGame /
    // createGameRecord below replace dbGameId with the new match's).
    if (room.dbGameId) rematchInvites.remove(room.dbGameId)
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
  socket.on('request_play_again', async () => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('room_error', { code: 'NOT_IN_ROOM', message: 'Bạn không ở trong phòng nào.' })
      return
    }
    if (!room.matchResult) {
      // No result on the room has two very different causes. With both
      // seats still filled, a match really is in progress. With the other
      // seat empty, the opponent left after the match ended (removePlayer
      // wipes matchResult along with them) — the match this player is
      // still looking at is finished, and "play again" becomes an invite
      // for the opponent to come back.
      if (room.isFull()) {
        socket.emit('room_error', { code: 'GAME_STILL_PLAYING', message: 'Trận đấu hiện tại chưa kết thúc.' })
        return
      }
      await inviteDepartedOpponent(room)
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

    // A fresh rematch request is an invite aimed at the opponent, so their
    // "Ai có thể thách đấu tôi" setting decides whether it may be sent at
    // all (the mutual-request path above is exempt — there the opponent
    // asked first). The requester is identified by the socket's verified
    // JWT (socket.user), never by the client-supplied playerId; a guest
    // requester is simply nobody's friend.
    const opponent = room.getOpponent(socket.id)
    let permission
    try {
      permission = await checkChallengeAllowed(socket.user ? socket.user.id : null, parseUserId(opponent && opponent.playerId))
    } catch (error) {
      console.error(`[game] ${room.roomId} failed to check challenge permission:`, error.message)
      socket.emit('room_error', { code: 'SERVICE_UNAVAILABLE', message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.' })
      return
    }
    if (!permission.allowed) {
      console.log(`[game] ${room.roomId} rematch request by ${player.color} blocked by opponent's challenge setting`)
      socket.emit('room_error', { code: permission.code, message: permission.message })
      return
    }

    // The checks above ran before an `await` — re-validate what could have
    // changed meanwhile (a new match started, the opponent asked or left).
    if (roomManager.getRoomBySocket(socket.id) !== room || !room.matchResult) return
    if (!room.isFull() || !room.players.every((p) => p.connected)) {
      socket.emit('room_error', { code: 'OPPONENT_UNAVAILABLE', message: 'Đối thủ hiện không có mặt để chơi lại.' })
      return
    }
    if (room.playAgainRequestBy === player.color) {
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

    // The prompt above is one way to answer; the notification is the other
    // (the opponent may dismiss the prompt, or leave the match screen, and
    // still answer from their notification list — see
    // respond_rematch_invite). Limited to a persisted match between two
    // accounts: that is the only case with both a recipient to store it for
    // and a game id to address the invite by.
    const opponentUserId = parseUserId(opponent && opponent.playerId)
    if (socket.user && opponentUserId && room.dbGameId) {
      registerInvite(room, socket.user.id, opponentUserId)
    }
  })

  // Records the invite and notifies the invitee. Only ever reached once per
  // actual invite — both callers have already returned early for a repeat
  // click (room.playAgainRequestBy / an existing registry entry), so the
  // timestamp in the notification's dedupe key distinguishes a genuinely
  // new invite (e.g. asking again after a decline) without letting a
  // duplicated event through.
  function registerInvite(room, fromUserId, toUserId) {
    const gameId = room.dbGameId
    rematchInvites.set({ gameId, roomId: room.roomId, fromUserId, toUserId })
    notifyRematchRequest(gameId, fromUserId, toUserId, Date.now())
  }

  // "Chơi lại" pressed by a player whose opponent has already left the
  // finished match. The Room no longer knows who that opponent was, so they
  // are looked up from the persisted Game; the invite then waits in the
  // registry until they answer it from their notification.
  async function inviteDepartedOpponent(room) {
    const unavailable = () =>
      socket.emit('room_error', { code: 'OPPONENT_UNAVAILABLE', message: 'Đối thủ đã rời trận, không thể mời chơi lại.' })

    const gameId = room.dbGameId
    // Needs a finished, persisted match between two accounts — a guest
    // opponent has no account to notify.
    if (!socket.user || !gameId || !room.dbResultSaved || room.status !== ROOM_STATUS.WAITING) return unavailable()

    const existing = rematchInvites.get(gameId)
    if (existing && existing.fromUserId === socket.user.id && existing.roomId === room.roomId) {
      socket.emit('play_again_request_sent')
      return
    }

    let opponentUserId
    let permission
    try {
      opponentUserId = await getFinishedGameOpponent(gameId, socket.user.id)
      if (!opponentUserId) return unavailable()
      permission = await checkChallengeAllowed(socket.user.id, opponentUserId)
    } catch (error) {
      console.error(`[game] ${room.roomId} failed to prepare rematch invite:`, error.message)
      socket.emit('room_error', { code: 'SERVICE_UNAVAILABLE', message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.' })
      return
    }
    if (!permission.allowed) {
      socket.emit('room_error', { code: permission.code, message: permission.message })
      return
    }

    // Re-validate after the awaits above: still this room, still waiting
    // alone on that same finished game, and no invite registered meanwhile.
    if (roomManager.getRoomBySocket(socket.id) !== room || room.dbGameId !== gameId) return
    if (room.isFull() || room.status !== ROOM_STATUS.WAITING) return unavailable()
    if (rematchInvites.get(gameId)) {
      socket.emit('play_again_request_sent')
      return
    }

    console.log(`[game] ${room.roomId} user ${socket.user.id} invited departed opponent ${opponentUserId} to a rematch`)
    registerInvite(room, socket.user.id, opponentUserId)
    socket.emit('play_again_request_sent')
  }

  // The invitee answering a rematch invite from its notification rather
  // than from the in-room prompt — works whether they are still seated in
  // the room or have left it. `gameId` only names which invite; everything
  // that decides whether it can still be answered is read here, now, from
  // the registry and the Room: the invite exists and is addressed to this
  // socket's verified user, the room still exists and is still about that
  // same finished game (a new match there replaces dbGameId), and the
  // inviter is still in it. Anything else is "no longer valid" — no room is
  // joined and no game is created.
  socket.on('respond_rematch_invite', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {}
    const gameId = Number(payload && payload.gameId)
    const accept = Boolean(payload && payload.accept)
    const expired = () => {
      reply({ ok: false, code: 'REMATCH_INVITE_EXPIRED', message: 'Lời mời chơi lại này không còn hiệu lực.' })
    }

    const invite = socket.user ? rematchInvites.get(gameId) : null
    if (!invite || invite.toUserId !== socket.user.id) return expired()

    const room = roomManager.getRoom(invite.roomId)
    const inviter = room ? room.getPlayerByPlayerId(`u:${invite.fromUserId}`) : null
    if (!room || !inviter || !inviter.connected || room.dbGameId !== gameId) {
      rematchInvites.remove(gameId)
      return expired()
    }

    // Still seated in that room: this is the existing in-room handshake,
    // just answered from a different button.
    if (roomManager.getRoomBySocket(socket.id) === room) {
      const me = room.getPlayer(socket.id)
      if (!room.matchResult || !room.playAgainRequestBy || !me || room.playAgainRequestBy === me.color) {
        rematchInvites.remove(gameId)
        return expired()
      }
      if (accept) {
        console.log(`[game] ${room.roomId} rematch accepted by ${me.color} (from notification)`)
        startRematch(room)
      } else {
        rematchInvites.remove(gameId)
        room.clearPlayAgainRequest()
        console.log(`[game] ${room.roomId} rematch declined by ${me.color} (from notification)`)
        io.to(room.roomId).emit('play_again_declined')
      }
      return reply({ ok: true, roomId: room.roomId })
    }

    // Not in that room any more (either side left after the match): the
    // inviter must be waiting there alone for the invite to mean anything.
    if (room.status !== ROOM_STATUS.WAITING || room.isFull()) {
      rematchInvites.remove(gameId)
      return expired()
    }

    if (!accept) {
      rematchInvites.remove(gameId)
      console.log(`[game] ${room.roomId} rematch invite declined by user ${socket.user.id}`)
      io.to(room.roomId).emit('play_again_declined')
      return reply({ ok: true })
    }

    // Accepting is taking the free seat back — the same joinRoom every
    // other entry into a room uses, so "already in another room" and the
    // seat/color assignment behave exactly as they do for join_room.
    let result
    try {
      result = roomManager.joinRoom(room.roomId, socket.id, `u:${socket.user.id}`)
    } catch (error) {
      return reply({ ok: false, code: error.code || 'JOIN_FAILED', message: error.message })
    }
    rematchInvites.remove(gameId)
    socket.join(room.roomId)
    console.log(`[game] ${room.roomId} rematch invite accepted by user ${socket.user.id} — rejoined`)
    if (result.justStarted) {
      createGameRecord(io, room)
      attachPlayerRatings(io, room)
    }
    broadcastGameStarted(io, room)
    return reply({ ok: true, roomId: room.roomId })
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
      if (room.dbGameId) rematchInvites.remove(room.dbGameId)
      room.clearPlayAgainRequest()
      console.log(`[game] ${room.roomId} rematch declined by ${player.color}`)
      io.to(room.roomId).emit('play_again_declined')
    }
  })
}

module.exports = { registerGameHandlers, broadcastGameStarted }
