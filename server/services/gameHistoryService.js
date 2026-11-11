const { db } = require('../prisma/db')
const { calculateElo } = require('./eloService')
const { notifyGameResult } = require('./notificationService')

const Game = db.orm.public.Game
const Move = db.orm.public.Move
const User = db.orm.public.User

// Maps the client-derived / server-declared GAME_STATUS strings (see
// src/features/game/gameLogic.js and server/rooms/room.js's GAME_STATUS)
// to the persisted EndReason enum. 'opponent-left' has no natural fit among
// the chess-outcome reasons, hence the added DISCONNECT value.
const END_REASON_BY_STATUS = {
  checkmate: 'CHECKMATE',
  stalemate: 'STALEMATE',
  'perpetual-check': 'REPETITION',
  'perpetual-chase': 'REPETITION',
  'repetition-draw': 'REPETITION',
  'timeout-move': 'TIMEOUT',
  'timeout-game': 'TIMEOUT',
  resign: 'RESIGN',
  draw: 'DRAW_AGREEMENT',
  'opponent-left': 'DISCONNECT',
}

// How a finished match is stored: { isDraw, result, endReason }. Any result
// without a winning side is a draw — agreed ('draw') or by repetition
// ('repetition-draw') — and is rated as a draw (0.5 each).
function describeResult(status, winnerColor) {
  const isDraw = winnerColor !== 'red' && winnerColor !== 'black'
  return {
    isDraw,
    result: isDraw ? 'DRAW' : winnerColor === 'red' ? 'RED_WIN' : 'BLACK_WIN',
    endReason: END_REASON_BY_STATUS[status] || 'CANCELLED',
  }
}

// playerId is a client-generated identity (see src/features/room/roomSession.js) —
// only ever a real database user when it has the `u:<userId>` shape a logged-in
// client derives from its account. Guests get a random UUID and parse to null,
// which is exactly what tells the rest of this module "don't persist this match".
function parseUserId(playerId) {
  if (typeof playerId !== 'string') return null
  const match = /^u:(\d+)$/.exec(playerId)
  return match ? Number(match[1]) : null
}

// Game.roomCode is unique, but a Room is reused as-is across rematches
// (play_again calls room.startGame() again on the same Room/roomId) — this
// gives each persisted match its own roomCode derived from the room's,
// so a rematch doesn't collide with the first match played in that room.
function nextRoomCode(room) {
  room.dbMatchSeq = (room.dbMatchSeq || 0) + 1
  return room.dbMatchSeq === 1 ? room.roomId : `${room.roomId}-R${room.dbMatchSeq}`
}

// Called once a room's match actually starts (both seats filled, via
// join_room/quick_play filling the last seat, or play_again). Only persists
// the match when BOTH players are logged-in accounts — a guest has no User
// row to satisfy Game's redPlayerId/blackPlayerId foreign keys, so a match
// involving one simply isn't saved/replayable, though it still plays
// normally over the socket like any other match. `room.dbGameId` is the
// flag the rest of the app checks to know whether this match is persisted.
async function createGameRecord(io, room) {
  room.dbGameId = null
  room.dbResultSaved = false

  const redPlayer = room.players.find((player) => player.color === 'red')
  const blackPlayer = room.players.find((player) => player.color === 'black')
  if (!redPlayer || !blackPlayer) return

  const redPlayerId = parseUserId(redPlayer.playerId)
  const blackPlayerId = parseUserId(blackPlayer.playerId)
  if (!redPlayerId || !blackPlayerId) {
    console.log(`[game-db] skip persisting room ${room.roomId} — a guest is playing`)
    return
  }

  try {
    const game = await Game.create({
      roomCode: nextRoomCode(room),
      redPlayerId,
      blackPlayerId,
      status: 'PLAYING',
      initialTime: Math.round(room.timeControl.gameTimeMs / 1000),
      increment: 0,
      startedAt: new Date(),
    })
    room.dbGameId = game.id
    console.log(`[game-db] created game #${game.id} for room ${room.roomId}`)
    io.to(room.roomId).emit('game_persisted', { gameId: game.id })
  } catch (error) {
    console.error(`[game-db] failed to create game for room ${room.roomId}:`, error.message)
  }
}

// Looks up each seated account's *current* rating (the same User.rating
// column Elo/Profile/Sidebar already read) so PlayerCard can show it during
// the match, not just afterward. Runs independently of createGameRecord
// above — a guest opponent still has no rating to show, but that must never
// stop the logged-in side from seeing their own — and, like it, only ever
// reads, never invents or trusts anything from the client. Called
// alongside createGameRecord at every point a match starts (join_room,
// quick_play, play_again); resolves slightly after game_started/game_state
// go out, so this broadcasts the result as its own event the moment it's
// ready, same fill-in-later pattern as game_persisted.
async function attachPlayerRatings(io, room) {
  const redPlayer = room.players.find((player) => player.color === 'red')
  const blackPlayer = room.players.find((player) => player.color === 'black')
  const redPlayerId = parseUserId(redPlayer && redPlayer.playerId)
  const blackPlayerId = parseUserId(blackPlayer && blackPlayer.playerId)
  if (!redPlayerId && !blackPlayerId) return // both guests — nothing to look up

  try {
    const [redUser, blackUser] = await Promise.all([
      redPlayerId ? User.first({ id: redPlayerId }) : null,
      blackPlayerId ? User.first({ id: blackPlayerId }) : null,
    ])
    room.playerRatings = {
      red: redUser ? redUser.rating : null,
      black: blackUser ? blackUser.rating : null,
    }
    io.to(room.roomId).emit('player_ratings', room.playerRatings)
  } catch (error) {
    console.error(`[rating] failed to load player ratings for room ${room.roomId}:`, error.message)
  }
}

// Persists one already-committed move. A no-op for a room whose match isn't
// being persisted (guest involved, or the create above failed). moveNumber
// reuses the same `ply` the in-memory room already stamped on the entry
// (see room.playMove), so ordering here always matches moveHistory.
async function saveMoveRecord(room, moveEntry, player) {
  if (!room.dbGameId) return
  const playerId = parseUserId(player.playerId)
  if (!playerId) return

  try {
    await Move.create({
      gameId: room.dbGameId,
      playerId,
      moveNumber: moveEntry.ply,
      fromPosition: `${moveEntry.from.col},${moveEntry.from.row}`,
      toPosition: `${moveEntry.to.col},${moveEntry.to.row}`,
      piece: moveEntry.piece.type,
      capturedPiece: moveEntry.captured ? moveEntry.captured.type : null,
      notation: moveEntry.notation,
    })
    console.log(`[move-db] game #${room.dbGameId} move #${moveEntry.ply} saved`)
  } catch (error) {
    console.error(`[move-db] game #${room.dbGameId} failed to save move #${moveEntry.ply}:`, error.message)
  }
}

// Thrown inside the transaction below to trigger a rollback when the DB
// itself says this game is no longer PLAYING — see finishGameRecord.
class AlreadyFinishedError extends Error {}

// Persists the final result, runs the Elo update, and updates both
// players' win/loss/draw tallies — all inside one transaction, so a Game
// can never end up FINISHED with only one side's rating/stats applied.
//
// Guarded twice against ever processing the same match twice:
//   1. `room.dbResultSaved` — a synchronous in-memory flag set before any
//      `await`, so two calls arriving in the same tick (duplicate socket
//      event, a report racing a forfeit, etc.) can't both pass it.
//   2. The transaction's own `.where({ id, status: 'PLAYING' })` update —
//      a database-level check that the Game row itself hasn't already
//      been finished, independent of this process's in-memory state (the
//      guard that actually matters if the server restarted mid-match, or
//      anything else made #1 unreliable).
//
// `winnerColor` is null for a draw. On success, broadcasts the rating
// change to the room as `rating_updated` (kept separate from the caller's
// own immediate `game_over` emit, so the chess result reaches clients
// without waiting on this DB round trip) — mirrors createGameRecord's own
// io.emit('game_persisted', ...) above. Returns the rating info too so
// tests/callers can inspect it; returns null when nothing was persisted
// (a guest was playing) or this game was already processed.
async function finishGameRecord(io, room, status, winnerColor) {
  if (!room.dbGameId || room.dbResultSaved) return null
  room.dbResultSaved = true
  const gameId = room.dbGameId

  const redPlayer = room.players.find((player) => player.color === 'red')
  const blackPlayer = room.players.find((player) => player.color === 'black')
  const redPlayerId = parseUserId(redPlayer && redPlayer.playerId)
  const blackPlayerId = parseUserId(blackPlayer && blackPlayer.playerId)
  if (!redPlayerId || !blackPlayerId) return null

  const { isDraw, result, endReason } = describeResult(status, winnerColor)
  const winnerPlayerId = isDraw ? null : winnerColor === 'red' ? redPlayerId : blackPlayerId

  try {
    const ratingInfo = await db.transaction(async (tx) => {
      const updatedGame = await tx.orm.public.Game.where({ id: gameId, status: 'PLAYING' }).update({
        status: 'FINISHED',
        result,
        endReason,
        winnerPlayerId,
        endedAt: new Date(),
      })
      if (!updatedGame) throw new AlreadyFinishedError()

      const [redUser, blackUser] = await Promise.all([
        tx.orm.public.User.first({ id: redPlayerId }),
        tx.orm.public.User.first({ id: blackPlayerId }),
      ])
      if (!redUser || !blackUser) {
        console.error(`[elo] game #${gameId} missing player row (red=${!!redUser} black=${!!blackUser}) — skip rating update`)
        return null
      }

      const scoreRed = isDraw ? 0.5 : winnerColor === 'red' ? 1 : 0
      const elo = calculateElo(redUser.rating, blackUser.rating, scoreRed)

      // Full new stat lines for both sides — computed once here so the
      // update and the returned/emitted payload can never disagree about
      // what was actually written.
      const redStats = { wins: redUser.wins, losses: redUser.losses, draws: redUser.draws }
      const blackStats = { wins: blackUser.wins, losses: blackUser.losses, draws: blackUser.draws }
      if (isDraw) {
        redStats.draws += 1
        blackStats.draws += 1
      } else if (winnerColor === 'red') {
        redStats.wins += 1
        blackStats.losses += 1
      } else {
        redStats.losses += 1
        blackStats.wins += 1
      }

      await Promise.all([
        tx.orm.public.User.where({ id: redPlayerId }).update({ rating: elo.newRatingA, ...redStats }),
        tx.orm.public.User.where({ id: blackPlayerId }).update({ rating: elo.newRatingB, ...blackStats }),
      ])

      console.log(
        `[elo] game #${gameId} red player #${redPlayerId} rating ${redUser.rating} → ${elo.newRatingA} (${elo.changeA >= 0 ? '+' : ''}${elo.changeA})`,
      )
      console.log(
        `[elo] game #${gameId} black player #${blackPlayerId} rating ${blackUser.rating} → ${elo.newRatingB} (${elo.changeB >= 0 ? '+' : ''}${elo.changeB})`,
      )

      return {
        gameId,
        red: { userId: redPlayerId, rating: { before: redUser.rating, after: elo.newRatingA, change: elo.changeA }, ...redStats },
        black: { userId: blackPlayerId, rating: { before: blackUser.rating, after: elo.newRatingB, change: elo.changeB }, ...blackStats },
      }
    })

    console.log(`[game-db] game #${gameId} finished — ${result} (${endReason})`)
    if (ratingInfo) io.to(room.roomId).emit('rating_updated', ratingInfo)
    // Only reachable once the transaction above has committed this game as
    // FINISHED — a second call for the same game returned at the
    // dbResultSaved guard or threw AlreadyFinishedError instead. Not
    // awaited: purely a side effect, it never throws (see
    // notificationService.createNotification) and nothing here depends on it.
    notifyGameResult({ gameId, redPlayerId, blackPlayerId, result })
    return ratingInfo
  } catch (error) {
    if (error instanceof AlreadyFinishedError) {
      console.log(`[elo] game #${gameId} already processed — skip`)
      return null
    }
    console.error(`[game-db] game #${gameId} failed to record result:`, error.message)
    return null
  }
}

// Who userId played against in FINISHED game `gameId`, or null if that game
// isn't finished or userId wasn't one of its two players. Used to address a
// rematch invite once the opponent has already left the room and the Room
// itself no longer knows who they were (see gameHandler.js).
async function getFinishedGameOpponent(gameId, userId) {
  const game = await Game.select('id', 'status', 'redPlayerId', 'blackPlayerId').first({ id: gameId })
  if (!game || game.status !== 'FINISHED') return null
  if (game.redPlayerId === userId) return game.blackPlayerId
  if (game.blackPlayerId === userId) return game.redPlayerId
  return null
}

module.exports = {
  describeResult,
  parseUserId,
  createGameRecord,
  attachPlayerRatings,
  saveMoveRecord,
  finishGameRecord,
  getFinishedGameOpponent,
}
