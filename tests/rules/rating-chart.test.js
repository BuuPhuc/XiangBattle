// "Lịch sử Elo" chart layout (src/features/history/ratingChart.js): range
// filters, the line starting at the Elo before the first game shown, round
// guide lines, and how a change is printed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chartLayout, pointsInRange, formatRatingChange } from '../../src/features/history/ratingChart.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-11-20T12:00:00.000Z')
const daysAgo = (days) => new Date(NOW - days * DAY).toISOString()

const POINTS = [
  { gameId: 1, endedAt: daysAgo(120), rating: 1216, change: 16 },
  { gameId: 2, endedAt: daysAgo(60), rating: 1206, change: -10 },
  { gameId: 3, endedAt: daysAgo(5), rating: 1225, change: 19 },
]

test('30 / 90 days / all keep only the games in that range', () => {
  assert.deepEqual(pointsInRange(POINTS, '30d', NOW).map((p) => p.gameId), [3])
  assert.deepEqual(pointsInRange(POINTS, '90d', NOW).map((p) => p.gameId), [2, 3])
  assert.deepEqual(pointsInRange(POINTS, 'all', NOW).map((p) => p.gameId), [1, 2, 3])
})

test('the line starts at the Elo before the first game shown, then one point per game', () => {
  const layout = chartLayout(POINTS)
  assert.equal(layout.start.rating, 1200)
  assert.equal(layout.points.length, 3)
  assert.equal(layout.path.split(' ').length, 4, 'start + 3 games')
  const xs = [layout.start.x, ...layout.points.map((p) => p.x)]
  assert.ok(xs.every((x, i) => i === 0 || x > xs[i - 1]), 'oldest on the left')
  // Higher Elo is drawn higher (smaller y).
  const [, low, high] = layout.points
  assert.ok(high.y < low.y)
  // Filtered to the last game: it starts from that game's own "before".
  assert.equal(chartLayout(POINTS.slice(2)).start.rating, 1206)
  assert.equal(chartLayout([]), null)
})

test('guide lines are round Elo values that cover every point', () => {
  const layout = chartLayout(POINTS)
  const values = layout.ticks.map((t) => t.value)
  assert.ok(values.length >= 2 && values.length <= 6, `ticks: ${values}`)
  const step = values[1] - values[0]
  assert.ok(values.every((v) => v % step === 0))
  assert.ok(values[0] <= 1200 && values.at(-1) >= 1225)
  const ys = layout.points.map((p) => p.y)
  assert.ok(ys.every((y) => y >= layout.plot.top && y <= layout.plot.bottom))
})

test('a change is printed +12 / −8 / ±0', () => {
  assert.equal(formatRatingChange(12), '+12')
  assert.equal(formatRatingChange(-8), '−8')
  assert.equal(formatRatingChange(0), '±0')
})
