// Quick Play ("Chơi ngay") pairing by Elo — one shared definition for the
// server (server/sockets/matchmakingHandler.js, via require(esm)) and the
// waiting screen, so the range the screen shows is the range the server uses.
//
// Players close in rating are preferred; the longer someone waits, the wider
// the gap they accept, and after 30 s anyone with the same time control will
// do — nobody waits forever on a quiet evening.

// Elo used for a guest, or when an account's rating can't be read.
export const DEFAULT_RATING = 1200

// From `afterMs` of waiting on, a gap of up to `range` points is accepted.
export const RATING_WINDOW_STEPS = [
  { afterMs: 0, range: 100 },
  { afterMs: 10_000, range: 200 },
  { afterMs: 20_000, range: 400 },
  { afterMs: 30_000, range: Infinity },
]

// The widest gap accepted after waiting `waitedMs`. `scale` shrinks the
// timeline (tests only — 1 everywhere else).
export function ratingRangeFor(waitedMs, scale = 1) {
  let range = RATING_WINDOW_STEPS[0].range
  for (const step of RATING_WINDOW_STEPS) {
    if (waitedMs >= step.afterMs * scale) range = step.range
  }
  return range
}

// How long until the range next widens, or null once it can't any more.
export function msUntilNextWiden(waitedMs, scale = 1) {
  const next = RATING_WINDOW_STEPS.find((step) => step.afterMs * scale > waitedMs)
  return next ? next.afterMs * scale - waitedMs : null
}

// Can these two queue entries ({ rating, queuedAt, timeControlId }) play
// each other right `now`? The gap must fit BOTH players' current range.
export function canPair(a, b, now, scale = 1) {
  if (a.timeControlId !== b.timeControlId) return false
  const gap = Math.abs(a.rating - b.rating)
  return gap <= ratingRangeFor(now - a.queuedAt, scale) && gap <= ratingRangeFor(now - b.queuedAt, scale)
}

// The best partner for `entry` among `candidates` (other entries; `entry`
// itself is skipped): the closest rating, then whoever has waited longest.
export function pickOpponent(entry, candidates, now, scale = 1) {
  let best = null
  for (const candidate of candidates) {
    if (candidate === entry || !canPair(entry, candidate, now, scale)) continue
    if (
      !best ||
      Math.abs(candidate.rating - entry.rating) < Math.abs(best.rating - entry.rating) ||
      (Math.abs(candidate.rating - entry.rating) === Math.abs(best.rating - entry.rating) && candidate.queuedAt < best.queuedAt)
    ) {
      best = candidate
    }
  }
  return best
}

// Every pair that can be made from `queue` right now, longest-waiting first
// getting the first pick. Each pair is [host, guest]: the one who waited
// longer hosts (and so plays Red, as before).
export function findPairs(queue, now, scale = 1) {
  const waiting = [...queue].sort((a, b) => a.queuedAt - b.queuedAt)
  const taken = new Set()
  const pairs = []
  for (const entry of waiting) {
    if (taken.has(entry)) continue
    const opponent = pickOpponent(
      entry,
      waiting.filter((other) => !taken.has(other)),
      now,
      scale
    )
    if (!opponent) continue
    taken.add(entry)
    taken.add(opponent)
    pairs.push(entry.queuedAt <= opponent.queuedAt ? [entry, opponent] : [opponent, entry])
  }
  return pairs
}
