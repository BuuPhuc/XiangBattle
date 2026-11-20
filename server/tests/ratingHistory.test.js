// "Lịch sử Elo" — checked without a database:
//  - a rated game records both players' Elo before/after it; a friendly one
//    records nothing (its Elo did not move);
//  - the chart's points come only from games holding Elo for that player;
//  - the highest Elo counts where the line started;
//  - win streaks count every finished game, and a draw ends a streak.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { settleRatings, ratingColumns } = require('../services/gameHistoryService')
const { ratingSide, toRatingPoints, peakRating, winStreaks } = require('../services/ratingHistory')

const red = { rating: 1300, wins: 0, losses: 0, draws: 0 }
const black = { rating: 1200, wins: 0, losses: 0, draws: 0 }

test('a rated game records both Elo before and after it', () => {
  const { elo } = settleRatings({ rated: true, isDraw: false, winnerColor: 'black', red, black })
  const columns = ratingColumns(red.rating, black.rating, elo)
  assert.equal(columns.redRatingBefore, 1300)
  assert.equal(columns.blackRatingBefore, 1200)
  assert.equal(columns.redRatingAfter, 1300 + elo.changeA)
  assert.equal(columns.blackRatingAfter, 1200 + elo.changeB)
  assert.ok(elo.changeB > 0 && elo.changeA < 0, 'the lower-rated winner gains, the loser drops')
})

// A Game row as the ORM returns it (only what the helpers read).
const game = (id, redPlayerId, blackPlayerId, ratings = {}) => ({
  id,
  redPlayerId,
  blackPlayerId,
  endedAt: `2026-11-${String(id).padStart(2, '0')}T10:00:00.000Z`,
  redRatingBefore: null,
  redRatingAfter: null,
  blackRatingBefore: null,
  blackRatingAfter: null,
  ...ratings,
})

test('friendly and older games hold no Elo; rated ones give the player their own side', () => {
  const friendly = game(1, 7, 8)
  assert.equal(ratingSide(friendly, 7), null)
  const rated = game(2, 7, 8, { redRatingBefore: 1200, redRatingAfter: 1216, blackRatingBefore: 1250, blackRatingAfter: 1234 })
  assert.deepEqual(ratingSide(rated, 7), { before: 1200, after: 1216 })
  assert.deepEqual(ratingSide(rated, 8), { before: 1250, after: 1234 })
  assert.equal(ratingSide(rated, 99), null, 'not one of its players')
})

test('the chart has one point per rated game, oldest first, with its change', () => {
  const games = [
    game(1, 7, 8), // played before the columns existed
    game(2, 7, 8, { redRatingBefore: 1200, redRatingAfter: 1216, blackRatingBefore: 1250, blackRatingAfter: 1234 }),
    game(3, 9, 7), // friendly
    game(4, 9, 7, { redRatingBefore: 1300, redRatingAfter: 1310, blackRatingBefore: 1216, blackRatingAfter: 1206 }),
  ]
  const points = toRatingPoints(games, 7)
  assert.deepEqual(
    points.map(({ gameId, before, rating, change }) => ({ gameId, before, rating, change })),
    [
      { gameId: 2, before: 1200, rating: 1216, change: 16 },
      { gameId: 4, before: 1216, rating: 1206, change: -10 },
    ]
  )
  assert.equal(points[0].endedAt, games[1].endedAt)
  assert.equal(peakRating(points), 1216)
})

test('the highest Elo counts the start of the line; none without rated games', () => {
  const points = [{ before: 1250, rating: 1238 }, { before: 1238, rating: 1245 }]
  assert.equal(peakRating(points), 1250, 'a first game lost still shows the Elo held before it')
  assert.equal(peakRating([]), null)
})

test('win streaks: current and longest, a draw or loss ends one', () => {
  assert.deepEqual(winStreaks([]), { current: 0, best: 0 })
  assert.deepEqual(winStreaks(['WIN', 'WIN', 'DRAW', 'WIN']), { current: 1, best: 2 })
  assert.deepEqual(winStreaks(['WIN', 'LOSS', 'WIN', 'WIN', 'WIN']), { current: 3, best: 3 })
  assert.deepEqual(winStreaks(['WIN', 'WIN', 'WIN', 'LOSS']), { current: 0, best: 3 })
})
