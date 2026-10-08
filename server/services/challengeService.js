const { db } = require('../prisma/db')
const { areFriends } = require('./friendService')

const User = db.orm.public.User
const Challenge = db.orm.public.Challenge

// How long a challenge may sit unanswered. A challenge is "play me now" —
// accepting it seats both players in a match on the spot (see
// sockets/challengeHandler.js) — so it is not left open indefinitely for the
// sender to be pulled into a game long after they asked. Nothing sweeps
// expired rows on a timer: a PENDING row past this age is flipped to EXPIRED
// the next time anything looks at it (see expireIfStale).
const CHALLENGE_TTL_MS = 15 * 60 * 1000

const CHALLENGE_NOT_ALLOWED = {
  allowed: false,
  code: 'CHALLENGE_NOT_ALLOWED',
  message: 'Người chơi này hiện không nhận lời mời thách đấu.',
}

function challengeServiceError(code, message, extra) {
  return Object.assign(new Error(message), { code }, extra)
}

function isUniqueViolation(error) {
  return error && (error.sqlState === '23505' || error.code === '23505')
}

// Same pair normalization as friendService.js — what lets one partial unique
// index cover "A challenged B" and "B challenged A" alike.
function normalizePair(userIdA, userIdB) {
  return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA]
}

// Single source of truth for "may `challengerUserId` send `targetUserId` a
// challenge/rematch invite" — the target's own challengePermission setting
// (Settings page > "Ai có thể thách đấu tôi"):
//   EVERYONE — anyone
//   FRIENDS  — only accepted friends of the target
//   NOBODY   — no one
// Either id may be null for a guest seat: a guest target has no User row
// (so no setting to honor) and is always challengeable; a guest challenger
// can never be anyone's friend, so only passes an EVERYONE target. Always
// decided here on the server — the client never gets a say.
async function checkChallengeAllowed(challengerUserId, targetUserId) {
  if (!targetUserId) return { allowed: true }

  const target = await User.select('id', 'challengePermission').first({ id: targetUserId })
  if (!target || target.challengePermission === 'EVERYONE') return { allowed: true }
  if (target.challengePermission === 'NOBODY') return CHALLENGE_NOT_ALLOWED

  // FRIENDS
  if (challengerUserId && (await areFriends(challengerUserId, targetUserId))) return { allowed: true }
  return CHALLENGE_NOT_ALLOWED
}

function isPastExpiry(challenge) {
  return new Date(challenge.expiresAt).getTime() <= Date.now()
}

// What a challenge's status effectively is right now — a PENDING row that
// has outlived its TTL but hasn't been touched since still reads as EXPIRED.
function effectiveStatus(challenge) {
  return challenge.status === 'PENDING' && isPastExpiry(challenge) ? 'EXPIRED' : challenge.status
}

// Compare-and-set on the status column: one `UPDATE ... WHERE id = ? AND
// status = ?` statement, true only for the call whose statement matched the
// row. Built with the SQL builder on purpose — the ORM's
// `.where({ id, status }).update(...)` is not a single conditional statement
// (two of them racing on the same row both report success), and this is the
// one place in the feature where that difference decides whether a cancelled
// challenge can still start a game.
async function moveStatus(challengeId, fromStatus, toStatus, respondedAt) {
  const now = new Date()
  const plan = db.sql.public.challenge
    .update({ status: toStatus, respondedAt, updatedAt: now })
    .where((f, fns) => fns.and(fns.eq(f.id, challengeId), fns.eq(f.status, fromStatus)))
    .build()
  const result = await db.runtime().execute(plan)
  return result.affectedRows === 1
}

// The only way a challenge ever leaves PENDING. Whoever's UPDATE matches the
// row wins and gets it back; every other concurrent accept / reject / cancel
// / expire matches nothing and gets null. This is what makes "A cancels
// while B is clicking Chấp nhận" and "B clicks Chấp nhận three times" safe
// without any locking in this process.
async function transition(challengeId, nextStatus) {
  const won = await moveStatus(challengeId, 'PENDING', nextStatus, new Date())
  return won ? Challenge.first({ id: challengeId }) : null
}

// Returns the row as it now stands: flipped to EXPIRED if it was a stale
// PENDING, otherwise untouched.
async function expireIfStale(challenge) {
  if (challenge.status !== 'PENDING' || !isPastExpiry(challenge)) return challenge
  const expired = await transition(challenge.id, 'EXPIRED')
  // Lost the race to some other transition — report whatever won.
  return expired || (await Challenge.first({ id: challenge.id })) || { ...challenge, status: 'EXPIRED' }
}

function notPendingError(challenge) {
  const status = challenge ? challenge.status : 'CANCELLED'
  if (status === 'EXPIRED') {
    return challengeServiceError('CHALLENGE_EXPIRED', 'Lời mời thách đấu này đã hết hạn.', { status })
  }
  return challengeServiceError(
    'CHALLENGE_NOT_PENDING',
    status === 'ACCEPTED' ? 'Lời mời thách đấu này đã được chấp nhận.' : 'Lời mời thách đấu này không còn hiệu lực.',
    { status },
  )
}

// The pair's live PENDING challenge (either direction), or null. The partial
// unique index guarantees there is at most one.
async function findPendingForPair(userIdA, userIdB) {
  const [userLowId, userHighId] = normalizePair(userIdA, userIdB)
  const existing = await Challenge.first({ userLowId, userHighId, status: 'PENDING' })
  if (!existing) return null
  const current = await expireIfStale(existing)
  return current.status === 'PENDING' ? current : null
}

// A send into a pair that already has a PENDING challenge never creates a
// second one. Either I already asked (duplicate), or *they* already asked me
// — in which case there is nothing to send, their challenge is right there
// to accept (the id is handed back so the client can offer exactly that).
function rejectAgainstPending(existing, senderId) {
  if (existing.senderId === senderId) {
    return challengeServiceError('CHALLENGE_ALREADY_SENT', 'Bạn đã gửi lời mời thách đấu đang chờ phản hồi.', {
      challengeId: existing.id,
    })
  }
  return challengeServiceError(
    'CHALLENGE_INCOMING_PENDING',
    'Người chơi này đã gửi lời mời thách đấu cho bạn. Hãy chấp nhận lời mời đó.',
    { challengeId: existing.id },
  )
}

// senderId challenges receiverId. senderId always comes from the caller's
// verified JWT (see challengeController.js); receiverId is the only thing
// taken from the request, and everything about it is checked here.
async function sendChallenge(senderId, receiverId) {
  if (senderId === receiverId) {
    throw challengeServiceError('SELF_CHALLENGE', 'Không thể tự thách đấu chính mình.')
  }
  const receiver = await User.select('id').first({ id: receiverId })
  if (!receiver) {
    throw challengeServiceError('USER_NOT_FOUND', 'Không tìm thấy người chơi.')
  }

  const existing = await findPendingForPair(senderId, receiverId)
  if (existing) throw rejectAgainstPending(existing, senderId)

  const permission = await checkChallengeAllowed(senderId, receiverId)
  if (!permission.allowed) throw challengeServiceError(permission.code, permission.message)

  const [userLowId, userHighId] = normalizePair(senderId, receiverId)
  try {
    return await Challenge.create({
      senderId,
      receiverId,
      userLowId,
      userHighId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    })
  } catch (error) {
    // Two sends for the same pair raced past the read above (a double click,
    // or both players challenging each other at once) — the unique index let
    // exactly one in. The loser resolves against the winner's row, same as if
    // it had seen it in the first place.
    if (!isUniqueViolation(error)) throw error
    const raced = await findPendingForPair(senderId, receiverId)
    if (!raced) throw error
    throw rejectAgainstPending(raced, senderId)
  }
}

// Loads challengeId on behalf of userId, who must be its `role`
// ('senderId' | 'receiverId'). A challenge that exists but belongs to
// someone else is FORBIDDEN, not "not found" — the ids are sequential, so
// there is nothing to hide by pretending otherwise.
async function loadFor(challengeId, userId, role) {
  const challenge = await Challenge.first({ id: challengeId })
  if (!challenge) {
    throw challengeServiceError('CHALLENGE_NOT_FOUND', 'Không tìm thấy lời mời thách đấu.')
  }
  if (challenge[role] !== userId) {
    throw challengeServiceError('CHALLENGE_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này với lời mời thách đấu.')
  }
  return challenge
}

async function resolvePending(challengeId, userId, role, nextStatus) {
  const challenge = await expireIfStale(await loadFor(challengeId, userId, role))
  if (challenge.status !== 'PENDING') throw notPendingError(challenge)
  const updated = await transition(challengeId, nextStatus)
  if (!updated) throw notPendingError(await Challenge.first({ id: challengeId }))
  return updated
}

// Only the receiver may reject, only the sender may cancel.
function rejectChallenge(receiverId, challengeId) {
  return resolvePending(challengeId, receiverId, 'receiverId', 'REJECTED')
}

function cancelChallenge(senderId, challengeId) {
  return resolvePending(challengeId, senderId, 'senderId', 'CANCELLED')
}

// Everything about accepting that the database can answer, checked at the
// moment of the accept: the challenge exists, receiverId really is its
// receiver, it is still PENDING and unexpired, both accounts still exist,
// and the receiver's *current* challenge setting still admits the sender (a
// setting tightened after the challenge was sent applies to it too). Does
// not change anything — claimAccepted below is the step that commits.
async function getAcceptable(challengeId, receiverId) {
  const challenge = await expireIfStale(await loadFor(challengeId, receiverId, 'receiverId'))
  if (challenge.status !== 'PENDING') throw notPendingError(challenge)

  const [sender, receiver] = await Promise.all([
    User.select('id').first({ id: challenge.senderId }),
    User.select('id').first({ id: challenge.receiverId }),
  ])
  if (!sender || !receiver) {
    throw challengeServiceError('USER_NOT_FOUND', 'Không tìm thấy người chơi.')
  }

  const permission = await checkChallengeAllowed(challenge.senderId, challenge.receiverId)
  if (!permission.allowed) {
    throw challengeServiceError(
      permission.code,
      'Cài đặt "Ai có thể thách đấu tôi" hiện tại của bạn không cho phép nhận lời mời thách đấu này.',
    )
  }
  return challenge
}

// PENDING -> ACCEPTED. Throws unless this call is the one that made the
// transition, so a caller that gets a row back is the single accept allowed
// to create the game.
async function claimAccepted(challengeId) {
  const claimed = await transition(challengeId, 'ACCEPTED')
  if (!claimed) throw notPendingError(await Challenge.first({ id: challengeId }))
  return claimed
}

// Undoes claimAccepted when the match could not actually be started (the
// sender went offline or into another game in the instant between the checks
// and the claim) — the challenge goes back to waiting instead of being
// burned on a game that never existed. If the pair somehow has a newer
// PENDING challenge by now, the unique index refuses the revert and this one
// is closed as EXPIRED instead.
async function releaseAccepted(challengeId) {
  try {
    await moveStatus(challengeId, 'ACCEPTED', 'PENDING', null)
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    await moveStatus(challengeId, 'ACCEPTED', 'EXPIRED', new Date())
  }
}

function toPendingEntry(challenge, otherUserId) {
  return { id: challenge.id, userId: otherUserId, createdAt: challenge.createdAt, expiresAt: challenge.expiresAt }
}

// userId's open challenges in both directions, each naming the *other*
// player — what the Thách đấu button needs to draw itself (see
// src/features/challenge/useChallenges.js). A display aid only: every action
// taken from it is re-validated above.
async function listPendingForUser(userId) {
  const [sent, received] = await Promise.all([
    Challenge.where({ senderId: userId, status: 'PENDING' }).all(),
    Challenge.where({ receiverId: userId, status: 'PENDING' }).all(),
  ])
  const live = (challenge) => !isPastExpiry(challenge)
  return {
    sent: sent.filter(live).map((challenge) => toPendingEntry(challenge, challenge.receiverId)),
    received: received.filter(live).map((challenge) => toPendingEntry(challenge, challenge.senderId)),
  }
}

// challengeId -> effective status, for the notification list (see
// notificationService.js's listForUser).
async function getStatuses(challengeIds) {
  if (challengeIds.length === 0) return new Map()
  const rows = await Challenge.select('id', 'status', 'expiresAt')
    .where((c) => c.id.in(challengeIds))
    .all()
  return new Map(rows.map((row) => [row.id, effectiveStatus(row)]))
}

module.exports = {
  checkChallengeAllowed,
  sendChallenge,
  rejectChallenge,
  cancelChallenge,
  getAcceptable,
  claimAccepted,
  releaseAccepted,
  listPendingForUser,
  getStatuses,
}
