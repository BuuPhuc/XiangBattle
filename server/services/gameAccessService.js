// Single source of truth for "who may look at this match" — every place
// that serves a game replay or a user's match history goes through here
// instead of deciding on its own. Today the product only has one privacy
// tier (PUBLIC: any authenticated user may see anyone's finished games), so
// both checks below are simple, but keeping them centralized means the
// eventual FRIENDS/PRIVATE setting (read from the owning player's own
// preference, not yet a column on User) only has to change these two
// functions — every controller and route that calls them keeps working
// unchanged.

// Can `viewerId` open the replay of `game`? A match is only ever viewable
// once it's FINISHED — an in-progress room's state belongs to the live
// Socket.IO flow, never this REST path, regardless of privacy tier.
function canViewGameReplay(viewerId, game) {
  if (!game || game.status !== 'FINISHED') return false
  return true // PUBLIC tier: no participant/friendship check yet
}

// Can `viewerId` see `ownerId`'s list of finished games (Public Profile's
// match history, /api/users/:userId/games)?
function canViewGameHistory(viewerId, ownerId) {
  return true // PUBLIC tier: no participant/friendship check yet
}

module.exports = { canViewGameReplay, canViewGameHistory }
