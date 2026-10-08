const { db } = require('../prisma/db')
const { and, or } = require('@prisma/orm-family-sql/orm-client')
const { toPublicUser } = require('./authController')
const { isValidUsername, isValidBio, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, BIO_MAX_LENGTH } = require('../utils/validate')
const { uploadAvatarBuffer } = require('../utils/cloudinary')
const { canViewGameHistory } = require('../services/gameAccessService')
const { getRelationshipStatus } = require('../services/friendService')
const presenceService = require('../services/presenceService')

const User = db.orm.public.User
const Game = db.orm.public.Game

const GAMES_PAGE_SIZE_DEFAULT = 10
const GAMES_PAGE_SIZE_MAX = 30

const SEARCH_RESULTS_LIMIT = 20
const SEARCH_QUERY_MAX_LENGTH = 50

// Never leak more than a match-history viewer needs about the other player.
function toPublicOpponent(user) {
  if (!user) return null
  return { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl }
}

function toPublicPlayer(user) {
  if (!user) return null
  return { id: user.id, username: user.username, displayName: user.displayName }
}

// Escapes SQL LIKE/ILIKE wildcard characters in user-supplied search text so
// e.g. a literal "_" or "%" in a username search is matched literally
// instead of acting as a wildcard. The query itself is still parameterized
// by the ORM (no string concatenation into SQL) — this is about matching
// correctness, not injection.
function escapeLikePattern(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`)
}

// Wraps a handler so an unexpected failure (DB unreachable, Cloudinary
// down, etc.) reaches the client as a generic message instead of a leaked
// stack trace — same shape as authController.js's withErrorHandling.
function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error('[user] unexpected error:', error.message)
      res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
      })
    }
  }
}

// GET /api/users/me — the current user's own full profile (stats, avatar,
// bio included). Identity comes from req.auth.userId (set by requireAuth
// from the verified JWT), never from anything the client claims.
const getMe = withErrorHandling(async (req, res) => {
  const user = await User.first({ id: req.auth.userId })
  if (!user) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Không tìm thấy người dùng.' })
  }
  return res.json({ success: true, user: toPublicUser(user) })
})

// PATCH /api/users/me — updates only username/bio. Every other User field
// (email, passwordHash, rating, wins/losses/draws, emailVerified, id) is
// simply never read from the request body — there is no code path here
// that could write them, regardless of what a client sends.
const updateMe = withErrorHandling(async (req, res) => {
  const body = req.body || {}
  const updates = {}

  if (body.username !== undefined) {
    if (!isValidUsername(body.username)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_USERNAME',
        message: `Tên người dùng phải từ ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} ký tự, chỉ gồm chữ cái, số và dấu gạch dưới.`,
      })
    }
    const trimmedUsername = body.username.trim()

    const existing = await User.first({ username: trimmedUsername })
    if (existing && existing.id !== req.auth.userId) {
      return res.status(409).json({ success: false, code: 'USERNAME_TAKEN', message: 'Tên đăng nhập đã được sử dụng.' })
    }
    updates.username = trimmedUsername
  }

  if (body.bio !== undefined) {
    if (!isValidBio(body.bio)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_BIO',
        message: `Tiểu sử tối đa ${BIO_MAX_LENGTH} ký tự.`,
      })
    }
    // Normalize an empty string to null rather than storing "" — same
    // "absent means absent" convention the nullable columns elsewhere use.
    updates.bio = body.bio === '' ? null : body.bio
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, code: 'NO_FIELDS', message: 'Không có thông tin nào để cập nhật.' })
  }

  let updated
  try {
    updated = await User.where({ id: req.auth.userId }).update(updates)
  } catch (error) {
    console.error('[user] update failed:', error.message)
    return res.status(409).json({ success: false, code: 'UPDATE_FAILED', message: 'Không thể cập nhật hồ sơ.' })
  }

  return res.json({ success: true, user: toPublicUser(updated) })
})

// POST /api/users/me/avatar — multipart upload (see middleware/uploadMiddleware.js
// for the multer config: memory storage, image-only, 5MB cap). The file
// buffer goes straight to Cloudinary, never to disk or Postgres — only the
// resulting URL is persisted.
const uploadAvatar = withErrorHandling(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, code: 'NO_FILE', message: 'Vui lòng chọn một ảnh.' })
  }

  let avatarUrl
  try {
    avatarUrl = await uploadAvatarBuffer(req.file.buffer, req.auth.userId)
  } catch (error) {
    console.error('[user] avatar upload failed:', error.message)
    return res.status(502).json({ success: false, code: 'UPLOAD_FAILED', message: 'Không thể tải ảnh lên. Vui lòng thử lại sau.' })
  }

  const updated = await User.where({ id: req.auth.userId }).update({ avatarUrl })
  return res.json({ success: true, user: toPublicUser(updated) })
})

// Settings page — the only four User fields this pair of endpoints ever
// reads or writes, each with its full set of accepted values. Anything
// else in a PATCH body (rating, wins, email, passwordHash, ...) is never
// looked at, so there is no code path here that could write it.
const SETTINGS_FIELDS = {
  soundEnabled: (value) => typeof value === 'boolean',
  arrowsEnabled: (value) => typeof value === 'boolean',
  recentGamesVisibility: (value) => ['PUBLIC', 'FRIENDS', 'PRIVATE'].includes(value),
  challengePermission: (value) => ['EVERYONE', 'FRIENDS', 'NOBODY'].includes(value),
}

function toSettings(user) {
  return {
    soundEnabled: user.soundEnabled,
    arrowsEnabled: user.arrowsEnabled,
    recentGamesVisibility: user.recentGamesVisibility,
    challengePermission: user.challengePermission,
  }
}

// GET /api/users/me/settings — the current user's own settings. Like every
// /me route, identity is req.auth.userId only — there is no :userId form
// of this endpoint, so one user can never read or write another's.
const getMySettings = withErrorHandling(async (req, res) => {
  const user = await User.first({ id: req.auth.userId })
  if (!user) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Không tìm thấy người dùng.' })
  }
  return res.json({ success: true, settings: toSettings(user) })
})

// PATCH /api/users/me/settings — partial update of the whitelisted
// SETTINGS_FIELDS above.
const updateMySettings = withErrorHandling(async (req, res) => {
  const body = req.body || {}
  const updates = {}

  for (const [field, isValid] of Object.entries(SETTINGS_FIELDS)) {
    if (body[field] === undefined) continue
    if (!isValid(body[field])) {
      return res.status(400).json({ success: false, code: 'INVALID_SETTING', message: 'Giá trị cài đặt không hợp lệ.' })
    }
    updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, code: 'NO_FIELDS', message: 'Không có thông tin nào để cập nhật.' })
  }

  const updated = await User.where({ id: req.auth.userId }).update(updates)
  if (!updated) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Không tìm thấy người dùng.' })
  }
  return res.json({ success: true, settings: toSettings(updated) })
})

// GET /api/users/:userId — another player's PUBLIC profile (e.g. opened
// from a PlayerCard in an online match). Only fields safe to show about
// someone else: no email, no passwordHash, no emailVerified/verification
// state. Any authenticated user may look up any other user's id — this
// endpoint is read-only and never accepts/writes anything, so there's no
// authorization boundary to enforce on the data itself, only on who may
// call it at all (requireAuth, same as every other route in this file).
const getPublicProfile = withErrorHandling(async (req, res) => {
  const userId = Number(req.params.userId)
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, code: 'INVALID_USER_ID', message: 'Mã người dùng không hợp lệ.' })
  }

  const user = await User.first({ id: userId })
  if (!user) {
    return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'Không tìm thấy người chơi.' })
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      rating: user.rating,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      createdAt: user.createdAt,
    },
  })
})

// GET /api/users/:userId/games — a user's FINISHED-match history, newest
// first, for the Public Profile's "Ván đấu gần đây" section. Access is
// gated through gameAccessService.canViewGameHistory (the owner's own
// recentGamesVisibility setting — see that module) rather than decided
// here. Only what a history *list*
// needs is returned; the full move list is fetched separately, on demand,
// by GET /api/games/:id when a card is actually opened for replay.
const getUserGames = withErrorHandling(async (req, res) => {
  const userId = Number(req.params.userId)
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, code: 'INVALID_USER_ID', message: 'Mã người dùng không hợp lệ.' })
  }

  const user = await User.first({ id: userId })
  if (!user) {
    return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'Không tìm thấy người chơi.' })
  }

  if (!(await canViewGameHistory(req.auth.userId, userId, user))) {
    return res.status(403).json({
      success: false,
      code: 'GAME_HISTORY_PRIVATE',
      message:
        user.recentGamesVisibility === 'FRIENDS'
          ? 'Chỉ bạn bè của người chơi này mới xem được ván đấu gần đây.'
          : 'Người chơi này đã ẩn ván đấu gần đây.',
    })
  }

  const page = Math.max(1, Math.trunc(Number(req.query.page)) || 1)
  const limit = Math.min(GAMES_PAGE_SIZE_MAX, Math.max(1, Math.trunc(Number(req.query.limit)) || GAMES_PAGE_SIZE_DEFAULT))
  const offset = (page - 1) * limit

  // A user can only ever be redPlayer XOR blackPlayer in a given game, so
  // this OR never double-counts a row.
  const participant = (g) => or(g.redPlayerId.eq(userId), g.blackPlayerId.eq(userId))

  const [games, totals] = await Promise.all([
    Game.where(participant)
      .where({ status: 'FINISHED' })
      .include('redPlayer', (u) => u.select('id', 'username', 'displayName', 'avatarUrl'))
      .include('blackPlayer', (u) => u.select('id', 'username', 'displayName', 'avatarUrl'))
      .include('winner', (u) => u.select('id', 'username', 'displayName'))
      .include('moves', (m) => m.count())
      .orderBy((g) => g.endedAt.desc())
      .limit(limit)
      .offset(offset)
      .all(),
    Game.where(participant)
      .where({ status: 'FINISHED' })
      .aggregate((aggregate) => ({ total: aggregate.count() })),
  ])

  const items = games.map((game) => {
    const isRed = game.redPlayerId === userId
    const opponent = isRed ? game.blackPlayer : game.redPlayer
    const userWon = (isRed && game.result === 'RED_WIN') || (!isRed && game.result === 'BLACK_WIN')
    const result = game.result === 'DRAW' ? 'DRAW' : userWon ? 'WIN' : 'LOSS'

    return {
      gameId: game.id,
      opponent: toPublicOpponent(opponent),
      result, // 'WIN' | 'LOSS' | 'DRAW', from this user's (userId's) perspective
      winner: toPublicPlayer(game.winner),
      endReason: game.endReason,
      moveCount: game.moves,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
    }
  })

  const total = totals.total
  return res.json({
    success: true,
    games: items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  })
})

// GET /api/users/search?q= — username search feeding the Friends page's
// "Lời mời kết bạn" search box (and anywhere else that wants to find a
// player by name). Case-insensitive partial match, done in Postgres via
// ILIKE — never by pulling the User table into Node to filter in JS. The
// current user never appears in their own results (see CASE 5 in the
// Friends search spec — simplest reading of "self-search shows no add
// button" is to just not show the self row at all).
const searchUsers = withErrorHandling(async (req, res) => {
  const rawQuery = typeof req.query.q === 'string' ? req.query.q : ''
  const query = rawQuery.trim().slice(0, SEARCH_QUERY_MAX_LENGTH)

  if (!query) {
    return res.json({ success: true, users: [] })
  }

  const pattern = `%${escapeLikePattern(query)}%`
  const matches = await User.select('id', 'username', 'displayName', 'avatarUrl', 'rating')
    .where((u) => and(u.username.ilike(pattern), u.id.neq(req.auth.userId)))
    .orderBy((u) => u.username.asc())
    .limit(SEARCH_RESULTS_LIMIT)
    .all()

  const users = await Promise.all(
    matches.map(async (match) => ({
      id: match.id,
      username: match.username,
      displayName: match.displayName,
      avatarUrl: match.avatarUrl,
      rating: match.rating,
      online: presenceService.isOnline(match.id),
      relationshipStatus: await getRelationshipStatus(req.auth.userId, match.id),
    })),
  )

  return res.json({ success: true, users })
})

module.exports = { getMe, updateMe, uploadAvatar, getMySettings, updateMySettings, getPublicProfile, getUserGames, searchUsers }
