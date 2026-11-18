// Quick Play's Elo pairing rules (src/features/matchmaking/ratingWindow.js),
// shared by the server and the waiting screen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_RATING,
  ratingRangeFor,
  msUntilNextWiden,
  canPair,
  pickOpponent,
  findPairs,
} from '../../src/features/matchmaking/ratingWindow.js'

const NOW = 1_000_000
const entry = (rating, waitedMs = 0, timeControlId = '10+0') => ({ rating, queuedAt: NOW - waitedMs, timeControlId })

test('the accepted gap widens with waiting: ±100, ±200 at 10 s, ±400 at 20 s, anyone at 30 s', () => {
  assert.equal(DEFAULT_RATING, 1200)
  assert.equal(ratingRangeFor(0), 100)
  assert.equal(ratingRangeFor(9_999), 100)
  assert.equal(ratingRangeFor(10_000), 200)
  assert.equal(ratingRangeFor(19_999), 200)
  assert.equal(ratingRangeFor(20_000), 400)
  assert.equal(ratingRangeFor(30_000), Infinity)
  assert.equal(ratingRangeFor(10 * 60_000), Infinity)
  // The test-only scale shrinks the timeline, not the ranges.
  assert.equal(ratingRangeFor(500, 0.05), 200)
})

test('time until the next widening (for the waiting screen)', () => {
  assert.equal(msUntilNextWiden(0), 10_000)
  assert.equal(msUntilNextWiden(12_000), 8_000)
  assert.equal(msUntilNextWiden(29_000), 1_000)
  assert.equal(msUntilNextWiden(30_000), null)
})

test('a pair needs the gap to fit BOTH ranges, and the same time control', () => {
  assert.equal(canPair(entry(1200), entry(1300), NOW), true) // exactly 100
  assert.equal(canPair(entry(1200), entry(1301), NOW), false)
  // One waited 25 s (±400), the other just came (±100): still no.
  assert.equal(canPair(entry(1200, 25_000), entry(1500), NOW), false)
  assert.equal(canPair(entry(1200, 25_000), entry(1500, 20_000), NOW), true)
  assert.equal(canPair(entry(800, 40_000), entry(2400, 31_000), NOW), true)
  assert.equal(canPair(entry(1200, 0, '5+0'), entry(1200, 0, '10+0'), NOW), false)
  assert.equal(canPair(entry(1200, 60_000, '5+0'), entry(1200, 60_000, '10+0'), NOW), false)
})

test('the closest rating wins; equal gaps go to whoever waited longer', () => {
  const me = entry(1250)
  const older = entry(1180, 5_000) // 70 away
  const closer = entry(1290, 1_000) // 40 away
  assert.equal(pickOpponent(me, [older, closer, me], NOW), closer)

  const a = entry(1300, 2_000)
  const b = entry(1200, 6_000) // both 50 away
  assert.equal(pickOpponent(entry(1250), [a, b], NOW), b)
  assert.equal(pickOpponent(entry(1250), [entry(1500)], NOW), null)
})

test('findPairs: longest waiting picks first; the longer waiter hosts (Red); leftovers stay', () => {
  const w1 = entry(1200, 9_000)
  const w2 = entry(1260, 3_000)
  const w3 = entry(1240, 1_000)
  const w4 = entry(2000, 2_000)
  const pairs = findPairs([w3, w4, w2, w1], NOW)
  assert.equal(pairs.length, 1)
  // w1 (waited most) takes its nearest, w3 (40 away; w2 is 60 away).
  assert.deepEqual(pairs[0], [w1, w3])

  // Nobody is ever in two pairs.
  const many = [entry(1200, 40_000), entry(1210, 40_000), entry(1220, 40_000), entry(1230, 40_000), entry(1240, 40_000)]
  const seen = new Set(findPairs(many, NOW).flat())
  assert.equal(seen.size, 4)
})
