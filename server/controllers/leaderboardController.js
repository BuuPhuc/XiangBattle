const { db } = require('../prisma/db')
const { and, or } = require('@prisma/orm-family-sql/orm-client')

const User = db.orm.public.User

const LEADERBOARD_PAGE_SIZE_DEFAULT = 50
const LEADERBOARD_PAGE_SIZE_MAX = 100

// Only what a leaderboard row may show about a player — same "public
// projection" convention as userController.js's getPublicProfile /
// toPublicOpponent. Never rating history, email, or anything auth-related.
function toPublicPlayer(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    rating: user.rating,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
  }
}

function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error('[leaderboard] unexpected error:', error.message)
      res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
      })
    }
  }
}

// GET /api/leaderboard?page=&limit= — players ranked by rating DESC, tied
// ratings broken by id ASC (older account first) so the ordering — and
// therefore every player's rank — stays stable across requests. Sorting
// happens in Postgres (ORDER BY + LIMIT/OFFSET); the full User table is
// never pulled into Node just to sort it here.
//
// Also resolves the requesting user's own rank (regardless of which page
// they're viewing) by counting how many players outrank them under the
// same ordering, rather than loading every row to compute it in JS.
const getLeaderboard = withErrorHandling(async (req, res) => {
  const page = Math.max(1, Math.trunc(Number(req.query.page)) || 1)
  const limit = Math.min(LEADERBOARD_PAGE_SIZE_MAX, Math.max(1, Math.trunc(Number(req.query.limit)) || LEADERBOARD_PAGE_SIZE_DEFAULT))
  const offset = (page - 1) * limit

  const [players, totals] = await Promise.all([
    User.select('id', 'username', 'displayName', 'avatarUrl', 'rating', 'wins', 'losses', 'draws')
      .orderBy([(u) => u.rating.desc(), (u) => u.id.asc()])
      .limit(limit)
      .offset(offset)
      .all(),
    User.aggregate((aggregate) => ({ total: aggregate.count() })),
  ])

  const total = totals.total
  const items = players.map((player, index) => ({
    rank: offset + index + 1,
    ...toPublicPlayer(player),
  }))

  let currentUser = null
  if (req.auth && req.auth.userId) {
    const me = await User.first({ id: req.auth.userId })
    if (me) {
      const { ahead } = await User
        .where((u) => or(u.rating.gt(me.rating), and(u.rating.eq(me.rating), u.id.lt(me.id))))
        .aggregate((aggregate) => ({ ahead: aggregate.count() }))

      currentUser = {
        rank: ahead + 1,
        ...toPublicPlayer(me),
      }
    }
  }

  return res.json({
    success: true,
    players: items,
    currentUser,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  })
})

module.exports = { getLeaderboard }
