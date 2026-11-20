// "Lịch sử Elo" on a profile — pure helpers, tested without a database
// (server/tests/ratingHistory.test.js).
//
// A rated game (Quick Play) stores both players' Elo just before and just
// after it (Game.redRatingBefore/After, blackRatingBefore/After); friendly
// games and games finished before those columns existed leave them null and
// are not points of the chart. There is no synthetic starting point: the
// first rated game's "before" is where the line starts.

// This user's { before, after } in `game`, or null when it holds no Elo for
// them (friendly / older game, or they did not play it).
function ratingSide(game, userId) {
  const side = game.redPlayerId === userId ? 'red' : game.blackPlayerId === userId ? 'black' : null
  if (!side) return null
  const before = game[`${side}RatingBefore`]
  const after = game[`${side}RatingAfter`]
  if (!Number.isInteger(before) || !Number.isInteger(after)) return null
  return { before, after }
}

// The chart's points from `games` (oldest first): one per rated game, the
// Elo after it and the change it made.
function toRatingPoints(games, userId) {
  const points = []
  for (const game of games) {
    const side = ratingSide(game, userId)
    if (!side) continue
    points.push({ gameId: game.id, endedAt: game.endedAt, before: side.before, rating: side.after, change: side.after - side.before })
  }
  return points
}

// Highest Elo the points reached — counting where the line started, so a
// first game lost still shows the Elo held before it. Null with no points.
function peakRating(points) {
  if (points.length === 0) return null
  return Math.max(points[0].before, ...points.map((point) => point.rating))
}

// Win streaks over `results` (oldest first; 'WIN' | 'LOSS' | 'DRAW'). Every
// finished game counts, friendly ones too — the same games as the profile's
// wins/losses/draws — and a draw ends a streak like a loss does.
function winStreaks(results) {
  let current = 0
  let best = 0
  for (const result of results) {
    current = result === 'WIN' ? current + 1 : 0
    best = Math.max(best, current)
  }
  return { current, best }
}

module.exports = { ratingSide, toRatingPoints, peakRating, winStreaks }
