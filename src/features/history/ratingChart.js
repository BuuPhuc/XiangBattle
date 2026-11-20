// "Lịch sử Elo" chart — pure layout helpers (tested in
// tests/rules/rating-chart.test.js). A point is one rated game from
// GET /users/:id/rating-history: { endedAt, rating (Elo after it), change }.

const DAY_MS = 24 * 60 * 60 * 1000

export const RATING_RANGES = [
  { id: '30d', label: '30 ngày', days: 30 },
  { id: '90d', label: '90 ngày', days: 90 },
  { id: 'all', label: 'Tất cả', days: null },
]

// The points of the chosen range, `nowMs` being when they were fetched.
export function pointsInRange(points, rangeId, nowMs) {
  const range = RATING_RANGES.find((r) => r.id === rangeId)
  if (!range || range.days == null) return points
  const since = nowMs - range.days * DAY_MS
  return points.filter((point) => new Date(point.endedAt).getTime() >= since)
}

// "+12" / "−8" / "±0" (a real minus sign, as printed elsewhere).
export function formatRatingChange(change) {
  if (change > 0) return `+${change}`
  if (change < 0) return `−${Math.abs(change)}`
  return '±0'
}

const TICK_STEPS = [10, 25, 50, 100, 200, 500]

// Where everything sits in a `width` × `height` SVG. The line starts at the
// Elo held before the first game shown (`start`, not a game itself), then
// one evenly spaced point per game. `ticks` are round Elo values for the
// horizontal guide lines.
export function chartLayout(points, { width = 600, height = 220, left = 44, right = 14, top = 14, bottom = 26 } = {}) {
  if (points.length === 0) return null
  const startRating = points[0].rating - points[0].change
  const values = [startRating, ...points.map((point) => point.rating)]
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 40) {
    const mid = (max + min) / 2
    min = mid - 20
    max = mid + 20
  }
  const step = TICK_STEPS.find((s) => (max - min) / s <= 4) || TICK_STEPS[TICK_STEPS.length - 1]
  const low = Math.floor(min / step) * step
  const high = Math.ceil(max / step) * step
  const ticks = []
  for (let value = low; value <= high; value += step) ticks.push(value)

  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const x = (index) => left + (plotWidth * index) / points.length
  const y = (rating) => top + plotHeight * (1 - (rating - low) / (high - low))

  const start = { x: x(0), y: y(startRating), rating: startRating }
  const placed = points.map((point, index) => ({ ...point, x: x(index + 1), y: y(point.rating) }))
  const path = [start, ...placed].map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return {
    width,
    height,
    start,
    points: placed,
    path,
    ticks: ticks.map((value) => ({ value, y: y(value) })),
    plot: { left, right: width - right, top, bottom: height - bottom },
  }
}
