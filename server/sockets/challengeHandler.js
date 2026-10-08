const { ROOM_STATUS } = require('../rooms/room')
const challengeService = require('../services/challengeService')
const notificationService = require('../services/notificationService')
const presenceService = require('../services/presenceService')
const rematchInvites = require('../services/rematchInviteService')
const { parseUserId } = require('../services/gameHistoryService')
const { cancelDisconnectForfeit } = require('./reconnectHandler')
const { startPairedMatch, removeFromQuickPlayQueue } = require('./matchmakingHandler')

// Challenge ids with an accept currently in flight in this process. Only an
// early exit for a burst of clicks on the same button — what actually makes a
// challenge produce at most one game is challengeService.claimAccepted's
// conditional UPDATE, which holds regardless of this set.
const accepting = new Set()

const EXPECTED_ERROR_CODE = /^(CHALLENGE_|CHALLENGER_|USER_NOT_FOUND$|ALREADY_IN_ROOM$|DISCONNECTED$)/

function seatError(code, message) {
  return Object.assign(new Error(message), { code })
}

// A room its only occupant is merely parked in — created and never joined,
// or left behind by an opponent after a finished match. Nobody else is
// affected if that player moves on to a different match.
function isIdleRoom(room) {
  return room.status === ROOM_STATUS.WAITING && room.players.length === 1
}

function isBusy(roomManager, playerId) {
  const room = roomManager.getRoomByPlayerId(playerId)
  return Boolean(room) && !isIdleRoom(room)
}

// Takes playerId out of the idle room they were parked in (if any), the same
// way an explicit leave_room would — including withdrawing a rematch invite
// they were waiting there on — so a forgotten "Đang chờ đối thủ..." room does
// not block them from the match they are about to start.
function vacateIdleRoom(io, roomManager, playerId) {
  const room = roomManager.getRoomByPlayerId(playerId)
  if (!room || !isIdleRoom(room)) return
  const [player] = room.players
  const playerSocket = io.sockets.sockets.get(player.socketId)
  if (playerSocket) playerSocket.leave(room.roomId)
  cancelDisconnectForfeit(playerId)
  const userId = parseUserId(playerId)
  if (userId) rematchInvites.removeFromInviter(room.roomId, userId)
  roomManager.deleteRoom(room.roomId)
  console.log(`[challenge] ${playerId} left idle room ${room.roomId} to start a challenge match`)
}

// Works out, synchronously against live server state, who would sit where if
// this challenge's match started right now — or throws the reason it cannot.
// The challenger is the host (seat 1, red), exactly as if they had created a
// room and the accepter had joined it.
function resolveSeats(io, roomManager, socket, challenge) {
  if (!socket.connected) {
    throw seatError('DISCONNECTED', 'Mất kết nối. Vui lòng thử lại.')
  }
  const senderSocketId = presenceService.getSocketIds(challenge.senderId).find((id) => io.sockets.sockets.has(id))
  if (!senderSocketId) {
    throw seatError('CHALLENGER_OFFLINE', 'Người thách đấu hiện không trực tuyến. Hãy thử lại khi họ online.')
  }

  const host = { socketId: senderSocketId, playerId: `u:${challenge.senderId}` }
  const guest = { socketId: socket.id, playerId: `u:${challenge.receiverId}` }
  if (isBusy(roomManager, host.playerId)) {
    throw seatError('CHALLENGER_BUSY', 'Người thách đấu đang ở trong một trận đấu khác.')
  }
  if (isBusy(roomManager, guest.playerId)) {
    throw seatError('ALREADY_IN_ROOM', 'Bạn đang ở trong một phòng khác. Hãy rời phòng trước khi nhận lời thách đấu.')
  }
  return { host, guest }
}

// The receiver accepting a challenge. This is a socket event rather than a
// REST call because accepting *is* entering a room: it needs this exact
// connection to seat, the same reason respond_rematch_invite lives in
// gameHandler.js. Sending, rejecting and cancelling touch no room and are
// plain REST (see challengeController.js).
//
// `challengeId` only names the challenge. Nothing the client sends — and
// nothing about the notification it clicked — is taken as permission:
//   1. challengeService.getAcceptable re-reads the row and checks it is this
//      socket's verified user's to accept, still PENDING, unexpired, and
//      still allowed by their current challenge setting.
//   2. resolveSeats checks both players can actually be seated right now.
//   3. challengeService.claimAccepted flips PENDING -> ACCEPTED in one
//      conditional UPDATE. A cancel that landed first, or a second accept,
//      makes this throw — and no room has been touched yet.
//   4. Only then is the match started, through the same startPairedMatch
//      Quick Play uses. No rating/stat is touched here; that happens when the
//      game ends, in gameHistoryService.finishGameRecord, like any other.
function registerChallengeHandlers(io, socket, roomManager) {
  socket.on('accept_challenge', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {}
    const fail = (code, message, extra) => reply({ ok: false, code, message, ...extra })

    if (!socket.user) {
      return fail('UNAUTHORIZED', 'Bạn cần đăng nhập để chấp nhận lời mời thách đấu.')
    }
    const challengeId = Number(payload && payload.challengeId)
    if (!Number.isInteger(challengeId) || challengeId <= 0) {
      return fail('INVALID_CHALLENGE_ID', 'Mã lời mời thách đấu không hợp lệ.')
    }
    if (accepting.has(challengeId)) {
      return fail('CHALLENGE_BUSY', 'Lời mời thách đấu này đang được xử lý.')
    }

    accepting.add(challengeId)
    try {
      const challenge = await challengeService.getAcceptable(challengeId, socket.user.id)
      resolveSeats(io, roomManager, socket, challenge)

      const accepted = await challengeService.claimAccepted(challengeId)

      // The claim was an `await` — re-derive the seats from what is true now
      // and start the match without yielding again.
      let room
      let host
      try {
        const seats = resolveSeats(io, roomManager, socket, challenge)
        host = seats.host
        vacateIdleRoom(io, roomManager, seats.host.playerId)
        vacateIdleRoom(io, roomManager, seats.guest.playerId)
        removeFromQuickPlayQueue(seats.host.socketId)
        removeFromQuickPlayQueue(seats.guest.socketId)
        room = startPairedMatch(io, roomManager, seats.host, seats.guest)
      } catch (error) {
        // No match was started, so the accept is undone rather than leaving
        // an ACCEPTED challenge with no game behind it.
        await challengeService.releaseAccepted(challengeId)
        return fail(error.code || 'CHALLENGE_START_FAILED', error.message)
      }

      console.log(`[challenge] #${challengeId} accepted by user ${socket.user.id} — room ${room.roomId}`)
      notificationService.markChallengeHandled(socket.user.id, challengeId)
      notificationService.announceChallengeUpdate(accepted)
      // The challenger may be on any page. Their seated socket has already
      // been handed the match (match_found); this is what lets every tab of
      // theirs find its way to the match screen. `socketId` names the tab
      // that is already seated so it does not rejoin itself.
      notificationService.emitToUser(challenge.senderId, 'challenge:accepted', {
        challengeId,
        roomId: room.roomId,
        socketId: host.socketId,
      })
      return reply({ ok: true, roomId: room.roomId })
    } catch (error) {
      // challengeService / resolveSeats refusals carry a message meant for
      // the player; anything else (a database error, say) does not.
      if (EXPECTED_ERROR_CODE.test(error.code)) {
        return fail(error.code, error.message, error.status ? { status: error.status } : undefined)
      }
      console.error(`[challenge] failed to accept #${challengeId}:`, error.message)
      return fail('SERVICE_UNAVAILABLE', 'Đã có lỗi xảy ra. Vui lòng thử lại sau.')
    } finally {
      accepting.delete(challengeId)
    }
  })
}

module.exports = { registerChallengeHandlers }
