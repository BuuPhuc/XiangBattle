const { db } = require('../prisma/db')

const Game = db.orm.public.Game
const Move = db.orm.public.Move

// Maps the client-derived / server-declared GAME_STATUS strings (see
// src/features/game/gameLogic.js and server/rooms/room.js's GAME_STATUS)
// to the persisted EndReason enum. 'opponent-left' has no natural fit among
// the chess-outcome reasons, hence the added DISCONNECT value.
const END_REASON_BY_STATUS = {
  checkmate: 'CHECKMATE',
  'timeout-move': 'TIMEOUT',
  'timeout-game': 'TIMEOUT',
  resign: 'RESIGN',
  draw: 'DRAW_AGREEMENT',
  'opponent-left': 'DISCONNECT',
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

// Persists one already-committed move. A no-op for a room whose match isn't
// being persisted (guest involved, or the create above failed). moveNumber
// reuses the same `ply` the in-memory room already stamped on the entry
// (see room.recordMove), so ordering here always matches moveHistory.
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

// Persists the final result and updates both players' win/loss/draw
// tallies. Guarded by its own one-shot flag (independent of
// room.recordMatchResult's in-memory idempotency) so this can never run
// twice for the same match — a second write here would double-count stats,
// which must never happen. `winnerColor` is null for a draw.
async function finishGameRecord(room, status, winnerColor) {
  if (!room.dbGameId || room.dbResultSaved) return
  room.dbResultSaved = true

  const redPlayer = room.players.find((player) => player.color === 'red')
  const blackPlayer = room.players.find((player) => player.color === 'black')
  const redPlayerId = parseUserId(redPlayer && redPlayer.playerId)
  const blackPlayerId = parseUserId(blackPlayer && blackPlayer.playerId)
  if (!redPlayerId || !blackPlayerId) return

  const isDraw = status === 'draw'
  const result = isDraw ? 'DRAW' : winnerColor === 'red' ? 'RED_WIN' : 'BLACK_WIN'
  const winnerPlayerId = isDraw ? null : winnerColor === 'red' ? redPlayerId : blackPlayerId
  const endReason = END_REASON_BY_STATUS[status] || 'CANCELLED'

  try {
    await db.transaction(async (tx) => {
      await tx.orm.public.Game.where({ id: room.dbGameId }).update({
        status: 'FINISHED',
        result,
        endReason,
        winnerPlayerId,
        endedAt: new Date(),
      })

      if (isDraw) {
        const [redUser, blackUser] = await Promise.all([
          tx.orm.public.User.first({ id: redPlayerId }),
          tx.orm.public.User.first({ id: blackPlayerId }),
        ])
        await Promise.all([
          tx.orm.public.User.where({ id: redPlayerId }).update({ draws: (redUser ? redUser.draws : 0) + 1 }),
          tx.orm.public.User.where({ id: blackPlayerId }).update({ draws: (blackUser ? blackUser.draws : 0) + 1 }),
        ])
      } else {
        const loserPlayerId = winnerColor === 'red' ? blackPlayerId : redPlayerId
        const [winnerUser, loserUser] = await Promise.all([
          tx.orm.public.User.first({ id: winnerPlayerId }),
          tx.orm.public.User.first({ id: loserPlayerId }),
        ])
        await Promise.all([
          tx.orm.public.User.where({ id: winnerPlayerId }).update({ wins: (winnerUser ? winnerUser.wins : 0) + 1 }),
          tx.orm.public.User.where({ id: loserPlayerId }).update({ losses: (loserUser ? loserUser.losses : 0) + 1 }),
        ])
      }
    })
    console.log(`[game-db] game #${room.dbGameId} finished — ${result} (${endReason})`)
  } catch (error) {
    console.error(`[game-db] game #${room.dbGameId} failed to record result:`, error.message)
  }
}

module.exports = { parseUserId, createGameRecord, saveMoveRecord, finishGameRecord }
