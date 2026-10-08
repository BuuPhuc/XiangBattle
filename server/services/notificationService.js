const { db } = require('../prisma/db')
const { and, or } = require('@prisma/orm-family-sql/orm-client')
const { userRoom } = require('./presenceService')
const rematchInvites = require('./rematchInviteService')
const challengeService = require('./challengeService')

const Notification = db.orm.public.Notification
const Friendship = db.orm.public.Friendship
const User = db.orm.public.User

const RELATED_USER_FIELDS = ['id', 'username', 'displayName', 'avatarUrl']

const DEFAULT_LIST_LIMIT = 30
const MAX_LIST_LIMIT = 50

// The one Socket.IO server instance, handed over once at boot (see
// server.js). Notifications are produced from both REST controllers and
// socket handlers, and the REST side has no `io` of its own to thread
// through — this keeps every producer on the same existing connection and
// the same per-user `user:<id>` room presenceService already maintains,
// instead of anything opening a second realtime channel. Null only before
// boot finishes (or in a script that never starts the server), in which
// case a notification is still persisted, just not pushed.
let io = null

function attachIo(instance) {
  io = instance
}

function isUniqueViolation(error) {
  return error && (error.sqlState === '23505' || error.code === '23505')
}

function displayNameOf(user) {
  return user ? user.displayName || user.username : 'Một người chơi'
}

// Wire shape — never the recipient's own userId (the caller already is that
// user) and never dedupeKey (a server-side idempotency detail).
function toPublic(row, extra) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: row.createdAt,
    relatedUserId: row.relatedUserId,
    relatedGameId: row.relatedGameId,
    relatedRequestId: row.relatedRequestId,
    relatedUser: row.relatedUser || null,
    ...extra,
  }
}

async function countUnread(userId) {
  const { count } = await Notification.where({ userId, read: false }).aggregate((aggregate) => ({
    count: aggregate.count(),
  }))
  return count
}

function emitToUser(userId, event, payload) {
  if (io) io.to(userRoom(userId)).emit(event, payload)
}

// Tells every open tab/device of userId what its badge should now read.
// The number always comes from a fresh COUNT, never from the client's own
// arithmetic.
async function pushUnreadCount(userId) {
  if (!io) return
  emitToUser(userId, 'notification:unread_count', { count: await countUnread(userId) })
}

// The single place a Notification row is ever inserted. Idempotent on
// `dedupeKey`: a repeat of the same action (double click, HTTP retry,
// duplicated or replayed socket event, reconnect) hits the unique
// constraint and resolves to null — nothing inserted, nothing pushed.
//
// Deliberately never throws. A notification is a side effect of some other
// action that has already succeeded (a friend request was stored, a game
// was finished); failing to announce it must not turn that action into an
// error for its caller.
async function createNotification({
  userId,
  type,
  title,
  message,
  dedupeKey,
  relatedUserId = null,
  relatedGameId = null,
  relatedRequestId = null,
}) {
  try {
    const created = await Notification.create({
      userId,
      type,
      title,
      message,
      dedupeKey,
      relatedUserId,
      relatedGameId,
      relatedRequestId,
    })
    const relatedUser = relatedUserId ? await User.select(...RELATED_USER_FIELDS).first({ id: relatedUserId }) : null
    // A notification being pushed is by definition still actionable — its
    // underlying request was created a moment ago.
    const notification = toPublic(
      { ...created, relatedUser },
      { actionable: type === 'FRIEND_REQUEST' || type === 'REMATCH_REQUEST' || type === 'CHALLENGE' },
    )
    emitToUser(userId, 'notification:new', { notification, unreadCount: await countUnread(userId) })
    return notification
  } catch (error) {
    if (isUniqueViolation(error)) {
      console.log(`[notification] duplicate ${dedupeKey} — skip`)
      return null
    }
    console.error(`[notification] failed to create ${dedupeKey}:`, error.message)
    return null
  }
}

// ---- Producers ------------------------------------------------------------
// One per supported type. Each derives its dedupeKey from the action's own
// identity, so "one action, one notification" holds no matter how many
// times the producer ends up being called for it.

// fromUserId sent toUserId the friend request stored as Friendship
// `friendshipId`. A request that is rejected/cancelled and later re-sent is
// a new Friendship row with a new id, hence a new (legitimate) notification.
async function notifyFriendRequest(friendshipId, fromUserId, toUserId) {
  const sender = await User.select(...RELATED_USER_FIELDS).first({ id: fromUserId })
  return createNotification({
    userId: toUserId,
    type: 'FRIEND_REQUEST',
    title: 'Lời mời kết bạn',
    message: `${displayNameOf(sender)} đã gửi lời mời kết bạn cho bạn.`,
    dedupeKey: `friend_request:${friendshipId}`,
    relatedUserId: fromUserId,
    relatedRequestId: friendshipId,
  })
}

// accepterId accepted the request requesterId had sent.
async function notifyFriendAccepted(friendshipId, accepterId, requesterId) {
  const accepter = await User.select(...RELATED_USER_FIELDS).first({ id: accepterId })
  return createNotification({
    userId: requesterId,
    type: 'FRIEND_ACCEPTED',
    title: 'Đã trở thành bạn bè',
    message: `${displayNameOf(accepter)} đã chấp nhận lời mời kết bạn của bạn.`,
    dedupeKey: `friend_accepted:${friendshipId}`,
    relatedUserId: accepterId,
    relatedRequestId: friendshipId,
  })
}

// requesterId invited toUserId to a rematch of finished game `gameId`.
// `inviteStamp` identifies this particular invite: the caller only gets
// here once per invite (repeat clicks are stopped before it — see
// gameHandler.js's registerInvite), so asking again after a decline is a
// new invite with a new notification, while a duplicate of the same one
// cannot occur.
async function notifyRematchRequest(gameId, requesterId, toUserId, inviteStamp) {
  const requester = await User.select(...RELATED_USER_FIELDS).first({ id: requesterId })
  return createNotification({
    userId: toUserId,
    type: 'REMATCH_REQUEST',
    title: 'Lời mời chơi lại',
    message: `${displayNameOf(requester)} muốn chơi lại với bạn.`,
    dedupeKey: `rematch:${gameId}:${requesterId}:${inviteStamp}`,
    relatedUserId: requesterId,
    relatedGameId: gameId,
  })
}

// senderId challenged toUserId — Challenge row `challengeId`, which is what
// relatedRequestId points at for this type (a friend request points at a
// Friendship the same way; the type says which). One challenge, one
// notification: a re-send after a reject/cancel/expiry is a new Challenge
// row with a new id, and a duplicate send never creates a row at all (see
// challengeService.sendChallenge).
async function notifyChallenge(challengeId, senderId, toUserId) {
  const sender = await User.select(...RELATED_USER_FIELDS).first({ id: senderId })
  return createNotification({
    userId: toUserId,
    type: 'CHALLENGE',
    title: 'Lời mời thách đấu',
    message: `${displayNameOf(sender)} muốn thách đấu với bạn.`,
    dedupeKey: `challenge:${challengeId}`,
    relatedUserId: senderId,
    relatedRequestId: challengeId,
  })
}

// Tells both players, on every tab they have open, that a challenge between
// them changed state — what keeps the sender's Thách đấu button and the
// receiver's notification buttons in step without a refresh. Purely a
// display nudge: it carries no authority, every action is re-checked against
// the Challenge row when it is taken.
function announceChallengeUpdate(challenge) {
  const payload = {
    challengeId: challenge.id,
    status: challenge.status,
    senderId: challenge.senderId,
    receiverId: challenge.receiverId,
    createdAt: challenge.createdAt,
    expiresAt: challenge.expiresAt,
  }
  emitToUser(challenge.senderId, 'challenge:updated', payload)
  emitToUser(challenge.receiverId, 'challenge:updated', payload)
}

// One notification per player for a game that has just been committed as
// FINISHED. Only ever called from finishGameRecord's success path (see
// gameHistoryService.js), which already guarantees a game is finished
// exactly once; the (game, player) key is a second, database-level guard on
// top of that.
async function notifyGameResult({ gameId, redPlayerId, blackPlayerId, result }) {
  const [red, black] = await Promise.all([
    User.select(...RELATED_USER_FIELDS).first({ id: redPlayerId }),
    User.select(...RELATED_USER_FIELDS).first({ id: blackPlayerId }),
  ])

  const messageFor = (won, opponent) => {
    const name = displayNameOf(opponent)
    if (result === 'DRAW') return `Bạn đã hòa với ${name}.`
    return won ? `Bạn đã thắng ${name}.` : `Bạn đã thua ${name}.`
  }

  await Promise.all([
    createNotification({
      userId: redPlayerId,
      type: 'GAME_RESULT',
      title: 'Kết quả ván đấu',
      message: messageFor(result === 'RED_WIN', black),
      dedupeKey: `game_result:${gameId}:${redPlayerId}`,
      relatedUserId: blackPlayerId,
      relatedGameId: gameId,
    }),
    createNotification({
      userId: blackPlayerId,
      type: 'GAME_RESULT',
      title: 'Kết quả ván đấu',
      message: messageFor(result === 'BLACK_WIN', red),
      dedupeKey: `game_result:${gameId}:${blackPlayerId}`,
      relatedUserId: redPlayerId,
      relatedGameId: gameId,
    }),
  ])
}

// ---- Reads / read-state ---------------------------------------------------

function clampLimit(rawLimit) {
  const limit = Number(rawLimit)
  if (!Number.isInteger(limit) || limit <= 0) return DEFAULT_LIST_LIMIT
  return Math.min(limit, MAX_LIST_LIMIT)
}

// Ids of the Friendship rows that are, right now, a pending request sent
// *to* userId. Only used to decide whether a FRIEND_REQUEST notification
// should still render its Chấp nhận/Từ chối buttons — a display hint. The
// accept/reject endpoints re-check the Friendship themselves when called
// (friendService.acceptRequest/rejectRequest), so a stale hint can never
// make a dead request actionable.
async function pendingReceivedRequestIds(userId) {
  const rows = await Friendship.select('id')
    .where((f) =>
      and(f.status.eq('PENDING'), or(f.userLowId.eq(userId), f.userHighId.eq(userId)), f.requestedById.neq(userId)),
    )
    .all()
  return new Set(rows.map((row) => row.id))
}

// userId's most recent notifications, newest first. Always scoped by the
// caller-supplied userId, which controllers take from the verified JWT.
async function listForUser(userId, rawLimit) {
  const rows = await Notification.where({ userId })
    .include('relatedUser', (u) => u.select(...RELATED_USER_FIELDS))
    .orderBy([(n) => n.createdAt.desc(), (n) => n.id.desc()])
    .limit(clampLimit(rawLimit))
    .all()

  const hasFriendRequests = rows.some((row) => row.type === 'FRIEND_REQUEST')
  const pendingIds = hasFriendRequests ? await pendingReceivedRequestIds(userId) : new Set()

  const challengeIds = rows.filter((row) => row.type === 'CHALLENGE' && row.relatedRequestId).map((row) => row.relatedRequestId)
  const challengeStatuses = await challengeService.getStatuses(challengeIds)

  // `actionable` only decides whether a row draws its Chấp nhận / Từ chối
  // buttons. Every kind is re-validated against the real request when
  // answered (friendService for a friend request, gameHandler.js's
  // respond_rematch_invite for a rematch, challengeService for a challenge).
  const isActionable = (row) => {
    if (row.type === 'FRIEND_REQUEST') return pendingIds.has(row.relatedRequestId)
    if (row.type === 'REMATCH_REQUEST') return rematchInvites.isPending(row.relatedGameId, row.relatedUserId, userId)
    if (row.type === 'CHALLENGE') return challengeStatuses.get(row.relatedRequestId) === 'PENDING'
    return false
  }

  // Only the newest notification about a given rematch invite carries the
  // buttons — an earlier, declined invite for the same game stays as
  // history. (Rows are newest first.)
  const seenRematch = new Set()
  return rows.map((row) => {
    let actionable = isActionable(row)
    if (actionable && row.type === 'REMATCH_REQUEST') {
      const key = `${row.relatedGameId}:${row.relatedUserId}`
      if (seenRematch.has(key)) actionable = false
      seenRematch.add(key)
    }
    // requestStatus lets an already-answered challenge say how it ended
    // ("đã được chấp nhận" / "không còn hiệu lực") instead of going mute. A
    // challenge whose row is gone (its sender's account was deleted) reads
    // as cancelled.
    if (row.type === 'CHALLENGE') {
      return toPublic(row, { actionable, requestStatus: challengeStatuses.get(row.relatedRequestId) || 'CANCELLED' })
    }
    return toPublic(row, { actionable })
  })
}

// Ownership is part of the WHERE, not a separate check: someone else's id
// (or a non-existent one) simply matches no row and comes back null, which
// the controller reports as a 404 without revealing which of the two it was.
async function findForUser(userId, notificationId) {
  return Notification.where({ id: notificationId, userId }).first()
}

async function markRead(userId, notificationId) {
  const existing = await findForUser(userId, notificationId)
  if (!existing) return null
  if (!existing.read) {
    await Notification.where({ id: notificationId, userId }).update({ read: true })
    await pushUnreadCount(userId)
  }
  return toPublic({ ...existing, read: true })
}

async function markAllRead(userId) {
  await Notification.where({ userId, read: false }).updateAll({ read: true })
  await pushUnreadCount(userId)
}

// userId has just answered (accepted or rejected) fromUserId's friend
// request — wherever they did it from (the notification panel, the Friends
// page, a profile). Any FRIEND_REQUEST notification about it has served its
// purpose, so it stops counting as unread. Best-effort, like creation.
async function markFriendRequestHandled(userId, fromUserId) {
  try {
    await Notification.where({ userId, type: 'FRIEND_REQUEST', relatedUserId: fromUserId, read: false }).updateAll({
      read: true,
    })
    await pushUnreadCount(userId)
  } catch (error) {
    console.error(`[notification] failed to mark friend request from ${fromUserId} handled:`, error.message)
  }
}

// userId has just answered (accepted or rejected) challenge `challengeId` —
// from the notification panel, the Friends page or a profile. Same idea as
// markFriendRequestHandled above.
async function markChallengeHandled(userId, challengeId) {
  try {
    await Notification.where({ userId, type: 'CHALLENGE', relatedRequestId: challengeId, read: false }).updateAll({
      read: true,
    })
    await pushUnreadCount(userId)
  } catch (error) {
    console.error(`[notification] failed to mark challenge ${challengeId} handled:`, error.message)
  }
}

module.exports = {
  attachIo,
  emitToUser,
  notifyFriendRequest,
  notifyFriendAccepted,
  notifyRematchRequest,
  notifyChallenge,
  announceChallengeUpdate,
  markChallengeHandled,
  notifyGameResult,
  listForUser,
  countUnread,
  findForUser,
  markRead,
  markAllRead,
  markFriendRequestHandled,
}
