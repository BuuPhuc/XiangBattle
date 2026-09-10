const { db } = require('../prisma/db')

const Game = db.orm.public.Game

// Never leak more than a replay viewer needs to know about a player.
function toPublicPlayer(user) {
  if (!user) return null
  return { id: user.id, username: user.username, displayName: user.displayName }
}

// GET /api/games/:id — returns one finished match plus its full move list
// (ascending by moveNumber) for the frontend's replay viewer to reconstruct
// the board from. Only the two players who were actually in the match may
// fetch it, and only once it's finished — an in-progress room's state
// belongs to the live Socket.IO flow, never this REST endpoint.
async function getGameById(req, res) {
  const gameId = Number(req.params.id)
  if (!Number.isInteger(gameId) || gameId <= 0) {
    return res.status(400).json({ success: false, code: 'INVALID_GAME_ID', message: 'Mã trận đấu không hợp lệ.' })
  }

  let game
  try {
    game = await Game.include('redPlayer', (u) => u.select('id', 'username', 'displayName'))
      .include('blackPlayer', (u) => u.select('id', 'username', 'displayName'))
      .include('winner', (u) => u.select('id', 'username', 'displayName'))
      .include('moves', (m) => m.orderBy((move) => move.moveNumber.asc()))
      .first({ id: gameId })
  } catch (error) {
    console.error('[game] failed to load game:', error.message)
    return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.' })
  }

  if (!game) {
    return res.status(404).json({ success: false, code: 'GAME_NOT_FOUND', message: 'Không tìm thấy trận đấu.' })
  }

  if (req.auth.userId !== game.redPlayerId && req.auth.userId !== game.blackPlayerId) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Bạn không có quyền xem lại trận đấu này.' })
  }

  if (game.status !== 'FINISHED') {
    return res.status(409).json({ success: false, code: 'GAME_NOT_FINISHED', message: 'Trận đấu chưa kết thúc.' })
  }

  return res.json({
    success: true,
    game: {
      id: game.id,
      roomCode: game.roomCode,
      redPlayer: toPublicPlayer(game.redPlayer),
      blackPlayer: toPublicPlayer(game.blackPlayer),
      winner: toPublicPlayer(game.winner),
      result: game.result,
      endReason: game.endReason,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      moves: (game.moves || []).map((move) => ({
        moveNumber: move.moveNumber,
        playerId: move.playerId,
        fromPosition: move.fromPosition,
        toPosition: move.toPosition,
        piece: move.piece,
        capturedPiece: move.capturedPiece,
        notation: move.notation,
      })),
    },
  })
}

module.exports = { getGameById }
