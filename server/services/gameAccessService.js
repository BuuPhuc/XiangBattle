const { db } = require('../prisma/db')
const { areFriends } = require('./friendService')

const User = db.orm.public.User

// Single source of truth for "who may look at this match" — every place
// that serves a game replay or a user's match history goes through here
// instead of deciding on its own. The policy is each player's own
// recentGamesVisibility setting (Settings page > "Ván đấu gần đây"):
//   PUBLIC  — any authenticated user
//   FRIENDS — only accepted friends of the owner
//   PRIVATE — only the owner
// The owner always sees their own history, whatever the setting.

// Can `viewerId` see `ownerId`'s list of finished games (Public Profile's
// match history, /api/users/:userId/games)? `owner` may be passed when the
// caller already loaded the User row, to skip a second lookup. An unknown
// owner resolves to false here — callers that need a 404 for that case
// check existence themselves first.
async function canViewGameHistory(viewerId, ownerId, owner) {
  if (viewerId === ownerId) return true
  const ownerRow = owner || (await User.select('id', 'recentGamesVisibility').first({ id: ownerId }))
  if (!ownerRow) return false
  if (ownerRow.recentGamesVisibility === 'PUBLIC') return true
  if (ownerRow.recentGamesVisibility === 'FRIENDS') return areFriends(viewerId, ownerId)
  return false
}

// Can `viewerId` open the replay of `game`? A match is only ever viewable
// once it's FINISHED — an in-progress room's state belongs to the live
// Socket.IO flow, never this REST path, regardless of privacy tier. A
// finished match sits in *both* players' histories, so it's viewable by
// either participant, and by anyone allowed to see at least one
// participant's history — i.e. exactly the matches that viewer could
// already reach through a history list.
async function canViewGameReplay(viewerId, game) {
  if (!game || game.status !== 'FINISHED') return false
  if (viewerId === game.redPlayerId || viewerId === game.blackPlayerId) return true
  if (await canViewGameHistory(viewerId, game.redPlayerId)) return true
  return canViewGameHistory(viewerId, game.blackPlayerId)
}

module.exports = { canViewGameReplay, canViewGameHistory }
