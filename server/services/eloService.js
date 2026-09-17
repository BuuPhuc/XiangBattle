// Basic Elo rating calculation — the only place the formula is implemented.
// Intentionally minimal per the current requirements: no provisional
// rating, no games-played-based K-factor, no rank tiers.
const K_FACTOR = 32
const STARTING_RATING = 1200

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

// scoreA is 1 (win), 0 (loss) or 0.5 (draw) from player A's perspective —
// player B's score is always the complement. Ratings are rounded to the
// nearest integer and clamped at 0 (a rating can never go negative).
function calculateElo(ratingA, ratingB, scoreA) {
  const expectedA = expectedScore(ratingA, ratingB)
  const expectedB = 1 - expectedA
  const scoreB = 1 - scoreA

  const newRatingA = Math.max(0, Math.round(ratingA + K_FACTOR * (scoreA - expectedA)))
  const newRatingB = Math.max(0, Math.round(ratingB + K_FACTOR * (scoreB - expectedB)))

  return {
    newRatingA,
    newRatingB,
    changeA: newRatingA - ratingA,
    changeB: newRatingB - ratingB,
  }
}

module.exports = { calculateElo, K_FACTOR, STARTING_RATING }
