// Quick Play: a lightweight waiting-queue layered on top of the existing
// Room system, never a parallel one — once two players are matched this
// hands off entirely to roomManager.createRoom/joinRoom (the exact same
// calls the manual Create Room / Join Room flow already makes), so
// everything downstream (color assignment, startGame, reconnect, resign,
// draw, game_over) keeps working unmodified.
//
// Who plays whom is decided by Elo (src/features/matchmaking/
// ratingWindow.js): the closest rating is preferred, and the gap a player
// accepts widens the longer they wait — after 30 s anyone with the same
// time control will do. Ratings are read here, server-side, from the
// account; nothing a client sends about its rating is used.
const { createGameRecord, attachPlayerRatings } = require('../services/gameHistoryService')
const { resolvePlayerId } = require('../utils/playerIdentity')
const { getTimeControl } = require('../../src/features/game/timeControls.js')
const { DEFAULT_RATING, findPairs } = require('../../src/features/matchmaking/ratingWindow.js')

// playerId -> { socketId, playerId, timeControlId, rating, queuedAt }.
// Only players who picked the same time control are ever paired, so each
// time control is in effect its own queue. Module-level (like
// reconnectHandler's pendingForfeits) since a player waiting to be matched
// isn't in any Room yet — there's nowhere on roomManager to hang this state.
const waitingQueue = new Map()

// XIANGBATTLE_MATCH_WINDOW_SCALE shrinks the waiting timeline for the
// socket tests (e.g. 0.05 → the 10/20/30 s steps at 0.5/1/1.5 s); unset, or
// anything but a number in (0, 1], means the real timeline.
function readWindowScale(raw) {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : 1
}
const WINDOW_SCALE = readWindowScale(process.env.XIANGBATTLE_MATCH_WINDOW_SCALE)
// While anyone waits, the queue is re-checked this often, so two players
// whose ranges have grown to meet are paired without either clicking again.
const SWEEP_INTERVAL_MS = Math.max(50, Math.round(1000 * WINDOW_SCALE))

// Reads an account's current Elo, or null. Swappable for tests (see
// tests/helpers/fakeRatingLookup.js) — same idea as sessionService's
// setTokenVersionStore; `db` is required lazily for the same reason.
let ratingLookup = async (userId) => {
  const { db } = require('../prisma/db')
  const user = await db.orm.public.User.select('id', 'rating').first({ id: userId })
  return user ? user.rating : null
}
function setRatingLookup(lookup) {
  ratingLookup = lookup
}

// A guest, an unknown account, or a failed lookup all search at the default.
async function ratingForSocket(socket) {
  if (!socket.user) return DEFAULT_RATING
  try {
    const rating = await ratingLookup(socket.user.id)
    return Number.isFinite(rating) ? rating : DEFAULT_RATING
  } catch (error) {
    console.error(`[matchmaking] rating lookup for user ${socket.user.id} failed, using ${DEFAULT_RATING}:`, error.message)
    return DEFAULT_RATING
  }
}

// Sockets whose quick_play is still waiting on its rating lookup — a cancel
// (or disconnect) in that gap must win over the late join.
const joiningSockets = new Set()

// Set on first registration: the sweep runs outside any one socket's
// handler. There is one io and one roomManager for the server's lifetime.
let matchContext = null
let sweepTimer = null

// What the waiting screen needs: the rating searched around and how long
// this entry has already waited (kept across a repeated click), so it can
// show the same widening range the server applies.
function queuedPayload(entry, now) {
  return { timeControl: entry.timeControlId, rating: entry.rating, waitedMs: now - entry.queuedAt }
}

// Puts two players who are not in any room into a brand new one and starts
// their match — the one path for "the server paired these two" (Quick Play
// below, an accepted challenge in challengeHandler.js). It is nothing but
// the manual flow's own roomManager.createRoom + joinRoom, so seats, colors
// (`host` takes seat 1, i.e. red), the game record, reconnect and everything
// after are exactly what a hand-made room gets. `host`/`guest` are
// { socketId, playerId }. `timeControlId` picks the clock (unknown or
// missing: the default). `options.rated`: whether it moves Elo — true only
// for Quick Play. Throws roomManager's own error (e.g. ALREADY_IN_ROOM) if
// either cannot be seated, leaving no room behind.
function startPairedMatch(io, roomManager, host, guest, timeControlId, options) {
  const created = roomManager.createRoom(host.socketId, host.playerId, timeControlId, options)
  let room
  try {
    room = roomManager.joinRoom(created.roomId, guest.socketId, guest.playerId).room
  } catch (error) {
    roomManager.deleteRoom(created.roomId)
    throw error
  }

  ;[host, guest].forEach((seat) => {
    const seatSocket = io.sockets.sockets.get(seat.socketId)
    if (seatSocket) seatSocket.join(room.roomId)
  })

  // roomManager.joinRoom always fills the last seat here, so this call
  // always "just started" the match — same persistence entry point as a
  // manual join_room (see socketHandler.js).
  createGameRecord(io, room)
  attachPlayerRatings(io, room)

  // Same per-recipient shape as game_started/game_state (you/opponent
  // differ per socket) — the frontend treats this identically to a
  // manual join_room that immediately filled the last seat.
  room.players.forEach((player) => {
    io.to(player.socketId).emit('match_found', { ...room.toGameStarted(player.socketId), dbGameId: room.dbGameId || null })
  })
  return room
}

// Pairs everyone who can be paired right now (ratingWindow.js's findPairs:
// longest-waiting first, each taking the closest rating within both
// players' ranges; the one who waited longer hosts and plays Red), drops
// entries whose socket is gone, and keeps the sweep running only while
// someone is still waiting.
function runMatching() {
  if (!matchContext) return
  const { io, roomManager } = matchContext
  for (const entry of [...waitingQueue.values()]) {
    if (!io.sockets.sockets.has(entry.socketId)) waitingQueue.delete(entry.playerId)
  }

  for (const [host, guest] of findPairs(waitingQueue.values(), Date.now(), WINDOW_SCALE)) {
    waitingQueue.delete(host.playerId)
    waitingQueue.delete(guest.playerId)
    try {
      // Quick Play is the one rated way to play (Elo moves).
      const room = startPairedMatch(io, roomManager, host, guest, host.timeControlId, { rated: true })
      console.log(
        `[matchmaking] matched ${host.playerId} (${host.rating}) vs ${guest.playerId} (${guest.rating}) (${host.timeControlId}) into room ${room.roomId}`
      )
    } catch (error) {
      // Narrow race (one of them got into a room some other way meanwhile):
      // whoever is still free keeps their place — and their waiting time.
      console.log(`[matchmaking] match attempt failed (${error.message}), keeping the free player queued`)
      ;[host, guest].forEach((entry) => {
        if (!roomManager.isSocketInRoom(entry.socketId) && !roomManager.isPlayerIdInRoom(entry.playerId)) {
          waitingQueue.set(entry.playerId, entry)
        }
      })
    }
  }

  if (waitingQueue.size === 0) {
    if (sweepTimer) clearInterval(sweepTimer)
    sweepTimer = null
  } else if (!sweepTimer) {
    sweepTimer = setInterval(runMatching, SWEEP_INTERVAL_MS)
    sweepTimer.unref()
  }
}

function registerMatchmakingHandlers(io, socket, roomManager) {
  if (!matchContext) matchContext = { io, roomManager }

  socket.on('quick_play', async (payload) => {
    const playerId = resolvePlayerId(socket, payload && payload.playerId)
    if (!playerId) {
      socket.emit('room_error', { code: 'INVALID_PLAYER_ID', message: 'Thiếu thông tin định danh người chơi.' })
      return
    }
    if (roomManager.isSocketInRoom(socket.id) || roomManager.isPlayerIdInRoom(playerId)) {
      socket.emit('room_error', { code: 'ALREADY_IN_ROOM', message: 'Bạn đang ở trong một phòng khác.' })
      return
    }
    // Never trusted as-is: anything that isn't one of the presets becomes
    // the default time control.
    const timeControlId = getTimeControl(payload && payload.timeControl).id

    const existing = waitingQueue.get(playerId)
    if (existing) {
      // Same identity clicking Quick Play again (double click, or a
      // reopened tab re-sending it) — never two slots: this socket takes
      // over the entry. Waiting time is kept, unless the time control
      // changed (that is a new search).
      existing.socketId = socket.id
      if (existing.timeControlId !== timeControlId) {
        existing.timeControlId = timeControlId
        existing.queuedAt = Date.now()
      }
      runMatching()
      if (waitingQueue.get(playerId) === existing) socket.emit('quick_play_queued', queuedPayload(existing, Date.now()))
      return
    }

    joiningSockets.add(socket.id)
    const rating = await ratingForSocket(socket)
    // Re-check after the await: still wanted, still connected, still free.
    if (!joiningSockets.delete(socket.id) || !socket.connected) return
    if (roomManager.isSocketInRoom(socket.id) || roomManager.isPlayerIdInRoom(playerId)) {
      socket.emit('room_error', { code: 'ALREADY_IN_ROOM', message: 'Bạn đang ở trong một phòng khác.' })
      return
    }

    const entry = waitingQueue.get(playerId) || { playerId, queuedAt: Date.now() }
    Object.assign(entry, { socketId: socket.id, timeControlId, rating })
    waitingQueue.set(playerId, entry)
    console.log(`[matchmaking] ${playerId} (${rating}) joined the ${timeControlId} queue`)
    // Paired at once → straight to match_found, never a flash of the
    // waiting screen; otherwise this player now waits.
    runMatching()
    if (waitingQueue.get(playerId) === entry) socket.emit('quick_play_queued', queuedPayload(entry, Date.now()))
  })

  socket.on('cancel_quick_play', (payload) => {
    joiningSockets.delete(socket.id)
    const playerId = resolvePlayerId(socket, payload && payload.playerId)
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
  joiningSockets.delete(socketId)
  for (const [playerId, entry] of waitingQueue) {
    if (entry.socketId === socketId) {
      waitingQueue.delete(playerId)
      console.log(`[matchmaking] ${playerId} removed from queue (disconnected)`)
      return
    }
  }
}

module.exports = { registerMatchmakingHandlers, removeFromQuickPlayQueue, startPairedMatch, setRatingLookup }
