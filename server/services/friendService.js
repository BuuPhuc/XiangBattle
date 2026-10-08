const { db } = require('../prisma/db')
const { and, or } = require('@prisma/orm-family-sql/orm-client')

const Friendship = db.orm.public.Friendship
const User = db.orm.public.User

const PUBLIC_FRIEND_FIELDS = ['id', 'username', 'displayName', 'avatarUrl', 'rating', 'wins', 'losses', 'draws']

function friendServiceError(code, message) {
  return Object.assign(new Error(message), { code })
}

// Every Friendship row is keyed by the *pair* of users, not by direction —
// (userLowId, userHighId) is always the pair's two ids with the smaller one
// first, so "A requests B" and "B requests A" can only ever resolve to the
// same row (see the model's doc comment in contract.prisma). Every
// read/write in this module normalizes through this first.
function normalizePair(userIdA, userIdB) {
  return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA]
}

function isUniqueViolation(error) {
  return error && (error.sqlState === '23505' || (error.code === '23505'))
}

async function getFriendship(userIdA, userIdB) {
  const [userLowId, userHighId] = normalizePair(userIdA, userIdB)
  return Friendship.first({ userLowId, userHighId })
}

function includeFriendUsers(query) {
  return query
    .include('userLow', (u) => u.select(...PUBLIC_FRIEND_FIELDS))
    .include('userHigh', (u) => u.select(...PUBLIC_FRIEND_FIELDS))
}

// Picks whichever side of a normalized row isn't `meId` — every list query
// below filters so that side is always well-defined (meId is always one of
// userLowId/userHighId for a row it returns).
function otherUser(row, meId) {
  return row.userLowId === meId ? row.userHigh : row.userLow
}

// Decides what happens when a request is sent into a pair that already has
// a row. Three outcomes: already friends (error), I already asked (error —
// no duplicate), or *they* already asked *me* — in which case both people
// want to be friends, so this accepts their pending request on the spot
// instead of leaving a second, redundant request to deal with.
async function resolveAgainstExisting(existing, fromId, toId) {
  if (existing.status === 'ACCEPTED') {
    throw friendServiceError('ALREADY_FRIENDS', 'Hai người đã là bạn bè.')
  }
  if (existing.requestedById === fromId) {
    throw friendServiceError('REQUEST_ALREADY_SENT', 'Bạn đã gửi lời mời kết bạn này rồi.')
  }
  // existing.requestedById === toId: the other person already asked me first.
  const updated = await Friendship.where({ id: existing.id })
    .select('id', 'userLowId', 'userHighId', 'requestedById', 'status', 'createdAt', 'respondedAt')
    .update({ status: 'ACCEPTED', respondedAt: new Date() })
  return { friendship: updated, autoAccepted: true }
}

// POST target: creates (or resolves into) a pending/accepted relationship
// between fromId and toId. Self-requests are rejected by the controller
// before this is ever called (defense in depth — see friendController.js).
async function sendRequest(fromId, toId) {
  const target = await User.first({ id: toId })
  if (!target) {
    throw friendServiceError('USER_NOT_FOUND', 'Không tìm thấy người chơi.')
  }

  const existing = await getFriendship(fromId, toId)
  if (existing) {
    return resolveAgainstExisting(existing, fromId, toId)
  }

  const [userLowId, userHighId] = normalizePair(fromId, toId)
  try {
    const created = await Friendship.create({
      userLowId,
      userHighId,
      requestedById: fromId,
      status: 'PENDING',
    })
    return { friendship: created, autoAccepted: false }
  } catch (error) {
    // Two concurrent sends for the same pair raced the unique constraint —
    // the loser here re-reads whatever the winner just committed and
    // resolves against it exactly like the existing-row path above, rather
    // than surfacing a raw DB error.
    if (!isUniqueViolation(error)) throw error
    const raced = await getFriendship(fromId, toId)
    if (!raced) throw error
    return resolveAgainstExisting(raced, fromId, toId)
  }
}

// meId accepts a request that otherId sent. Only the recipient of a
// pending request may accept it — never the sender (ownership check lives
// here, not just in the controller, so every caller gets it for free).
async function acceptRequest(meId, otherId) {
  const existing = await getFriendship(meId, otherId)
  if (!existing || existing.status !== 'PENDING' || existing.requestedById !== otherId) {
    throw friendServiceError('REQUEST_NOT_FOUND', 'Không tìm thấy lời mời kết bạn để chấp nhận.')
  }
  return Friendship.where({ id: existing.id })
    .select('id', 'userLowId', 'userHighId', 'requestedById', 'status', 'createdAt', 'respondedAt')
    .update({ status: 'ACCEPTED', respondedAt: new Date() })
}

// meId rejects a request otherId sent — the row is deleted outright (no
// lingering REJECTED status), so otherId is free to try again later.
async function rejectRequest(meId, otherId) {
  const existing = await getFriendship(meId, otherId)
  if (!existing || existing.status !== 'PENDING' || existing.requestedById !== otherId) {
    throw friendServiceError('REQUEST_NOT_FOUND', 'Không tìm thấy lời mời kết bạn để từ chối.')
  }
  await Friendship.where({ id: existing.id }).delete()
}

// meId cancels a request meId sent to otherId. Only the sender may cancel
// their own outgoing request.
async function cancelRequest(meId, otherId) {
  const existing = await getFriendship(meId, otherId)
  if (!existing || existing.status !== 'PENDING' || existing.requestedById !== meId) {
    throw friendServiceError('REQUEST_NOT_FOUND', 'Không tìm thấy lời mời kết bạn để hủy.')
  }
  await Friendship.where({ id: existing.id }).delete()
}

// Unfriends meId/otherId. The row is deleted (not just downgraded), which
// is what makes "can send a request again later" true for free — there is
// nothing left to block a fresh sendRequest.
async function removeFriend(meId, otherId) {
  const existing = await getFriendship(meId, otherId)
  if (!existing || existing.status !== 'ACCEPTED') {
    throw friendServiceError('FRIENDSHIP_NOT_FOUND', 'Hai người chưa phải là bạn bè.')
  }
  await Friendship.where({ id: existing.id }).delete()
}

// Relationship between meId and otherId, from meId's point of view — drives
// which action button Public Profile shows.
async function getRelationshipStatus(meId, otherId) {
  if (meId === otherId) return 'SELF'
  const existing = await getFriendship(meId, otherId)
  if (!existing) return 'NONE'
  if (existing.status === 'ACCEPTED') return 'FRIENDS'
  return existing.requestedById === meId ? 'REQUEST_SENT' : 'REQUEST_RECEIVED'
}

// True only for an ACCEPTED friendship — a pending request in either
// direction doesn't count. This is what the FRIENDS tier of the Settings
// page's privacy options (see gameAccessService.js / challengeService.js)
// checks against.
async function areFriends(userIdA, userIdB) {
  if (userIdA === userIdB) return false
  const existing = await getFriendship(userIdA, userIdB)
  return Boolean(existing) && existing.status === 'ACCEPTED'
}

async function listFriends(meId) {
  const rows = await includeFriendUsers(
    Friendship.where((f) => and(f.status.eq('ACCEPTED'), or(f.userLowId.eq(meId), f.userHighId.eq(meId)))),
  )
    .orderBy((f) => f.respondedAt.desc())
    .all()

  return rows.map((row) => ({ ...otherUser(row, meId), friendsSince: row.respondedAt }))
}

async function listReceivedRequests(meId) {
  const rows = await includeFriendUsers(
    Friendship.where((f) =>
      and(f.status.eq('PENDING'), or(f.userLowId.eq(meId), f.userHighId.eq(meId)), f.requestedById.neq(meId)),
    ),
  )
    .orderBy((f) => f.createdAt.desc())
    .all()

  return rows.map((row) => ({ ...otherUser(row, meId), requestedAt: row.createdAt }))
}

async function listSentRequests(meId) {
  const rows = await includeFriendUsers(Friendship.where((f) => and(f.status.eq('PENDING'), f.requestedById.eq(meId))))
    .orderBy((f) => f.createdAt.desc())
    .all()

  return rows.map((row) => ({ ...otherUser(row, meId), requestedAt: row.createdAt }))
}

// Every accepted friend's id — used only to target presence broadcasts
// (see presenceService.js), never returned to a client directly.
async function listFriendUserIds(meId) {
  const rows = await Friendship.select('userLowId', 'userHighId')
    .where((f) => and(f.status.eq('ACCEPTED'), or(f.userLowId.eq(meId), f.userHighId.eq(meId))))
    .all()
  return rows.map((row) => (row.userLowId === meId ? row.userHighId : row.userLowId))
}

module.exports = {
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeFriend,
  getRelationshipStatus,
  areFriends,
  listFriends,
  listReceivedRequests,
  listSentRequests,
  listFriendUserIds,
}
