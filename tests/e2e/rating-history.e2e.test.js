// "Lịch sử Elo" on the Profile pages, in Chrome, on a faked backend (no
// server, database or real account):
//  - the chart with its tiles, a point's details on hover, a click opening
//    that game's replay, and the 30 ngày / 90 ngày / Tất cả filters;
//  - no rated game yet: the current Elo and "Biểu đồ sẽ có sau ván xếp hạng
//    đầu tiên", with "Chơi ngay" on one's own profile;
//  - win streaks in "Thống kê"; +12 / −8 on rated games in "Ván đấu gần đây";
//  - another player whose games are hidden: numbers only, nothing to open.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json, TEST_USER as USER } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString()
const opponent = (id, username) => ({ id, username, displayName: null })

const HISTORY = {
  currentRating: 1234,
  peakRating: 1240,
  ratedGames: 3,
  streak: { current: 2, best: 4 },
  points: [
    { gameId: 51, endedAt: daysAgo(100), rating: 1216, change: 16, opponent: opponent(301, 'cao_thu') },
    { gameId: 52, endedAt: daysAgo(40), rating: 1240, change: 24, opponent: opponent(302, 'tan_thu') },
    { gameId: 53, endedAt: daysAgo(3), rating: 1234, change: -6, opponent: opponent(303, 'ke_thu') },
  ],
}

async function openProfile(t, options = {}) {
  const ctx = await openMockedPage(app, t, options)
  if (!ctx) return null
  await ctx.page.goto(`${app.baseUrl}/profile`)
  await ctx.page.getByTestId('rating-history').waitFor()
  return ctx
}

test('the chart, its tiles, a point on hover, and a click opening the replay', async (t) => {
  const ctx = await openProfile(t, { ratingHistory: HISTORY })
  if (!ctx) return
  const { page } = ctx
  const section = page.getByTestId('rating-history')
  await section.getByTestId('rating-chart').waitFor()
  assert.match(await section.getByTestId('rating-current').innerText(), /^1234\s+Elo hiện tại$/)
  assert.match(await section.getByTestId('rating-peak').innerText(), /^1240\s+Elo cao nhất$/)
  assert.match(await section.getByTestId('rating-games').innerText(), /^3\s+Ván xếp hạng$/)
  assert.equal(await section.getByTestId('rating-point').count(), 3)

  await section.getByTestId('rating-point').nth(2).hover()
  const tooltip = page.getByTestId('rating-tooltip')
  await tooltip.waitFor()
  const text = await tooltip.innerText()
  assert.match(text, /1234 Elo/)
  assert.match(text, /−6/)
  assert.match(text, /vs ke_thu/)
  assert.match(text, /Bấm để xem lại ván/)

  await section.getByTestId('rating-point').nth(2).click()
  await page.waitForURL(/\/replay\/53$/)
})

test('30 ngày / 90 ngày / Tất cả filter the points', async (t) => {
  const ctx = await openProfile(t, { ratingHistory: HISTORY })
  if (!ctx) return
  const { page } = ctx
  const section = page.getByTestId('rating-history')
  await section.getByTestId('rating-chart').waitFor()
  const points = section.getByTestId('rating-point')

  await section.getByRole('button', { name: '30 ngày' }).click()
  assert.equal(await points.count(), 1)
  await section.getByRole('button', { name: '90 ngày' }).click()
  assert.equal(await points.count(), 2)
  assert.equal(await section.getByRole('button', { name: '90 ngày' }).getAttribute('aria-pressed'), 'true')
  await section.getByRole('button', { name: 'Tất cả' }).click()
  assert.equal(await points.count(), 3)
})

test('no rated game yet: current Elo, the note, and "Chơi ngay"', async (t) => {
  const ctx = await openProfile(t)
  if (!ctx) return
  const { page } = ctx
  const empty = page.getByTestId('rating-history-empty')
  await empty.waitFor()
  const text = await empty.innerText()
  assert.match(text, new RegExp(`${USER.rating} Elo`))
  assert.match(text, /Biểu đồ sẽ có sau ván xếp hạng đầu tiên/)
  assert.equal(await empty.getByRole('link', { name: /Chơi ngay/ }).getAttribute('href'), '/room?mode=quick')
  assert.equal(await page.getByTestId('rating-chart').count(), 0)
  assert.equal(await page.getByRole('button', { name: '30 ngày' }).count(), 0, 'no filters without points')
})

test('Thống kê shows Elo and both win streaks; recent games show +/− Elo', async (t) => {
  const game = (gameId, rated, ratingChange) => ({
    gameId,
    rated,
    ratingChange,
    ratingAfter: ratingChange == null ? null : 1234,
    opponent: { id: 400 + gameId, username: `opp_${gameId}`, displayName: null, avatarUrl: null },
    result: 'WIN',
    color: 'red',
    winner: null,
    endReason: 'CHECKMATE',
    initialTime: 600,
    increment: 0,
    moveCount: 30,
    startedAt: '2026-11-01T10:00:00.000Z',
    endedAt: '2026-11-01T10:20:00.000Z',
  })
  const ctx = await openProfile(t, {
    ratingHistory: HISTORY,
    games: () => json({ success: true, games: [game(3, true, 12), game(2, true, -8), game(1, false, null), game(0, true, null)] }),
  })
  if (!ctx) return
  const { page } = ctx
  await page.getByText('Chuỗi thắng dài nhất').waitFor()
  const stats = await page.getByRole('heading', { name: 'Thống kê' }).locator('..').innerText()
  assert.match(stats, /1234\s*Elo/)
  assert.match(stats, /2\s*Chuỗi thắng hiện tại/)
  assert.match(stats, /4\s*Chuỗi thắng dài nhất/)

  await page.getByText('vs opp_3').waitFor()
  assert.deepEqual(await page.getByTestId('rating-change').allInnerTexts(), ['+12', '−8'], 'friendly and older games show no change')
})

test("another player's hidden games: the numbers, but no opponent and nothing to open", async (t) => {
  const ctx = await openMockedPage(app, t, {
    ratingHistory: { ...HISTORY, points: HISTORY.points.map(({ endedAt, rating, change }) => ({ endedAt, rating, change })) },
  })
  if (!ctx) return
  const { page } = ctx
  await page.route(/\/api\/users\/88(\?|$)/, (route) =>
    route.fulfill(
      json({
        success: true,
        user: { id: 88, username: 'nguoi_khac', displayName: null, avatarUrl: null, bio: null, rating: 1234, wins: 1, losses: 0, draws: 0, createdAt: '2026-01-01T00:00:00.000Z' },
      })
    )
  )
  await page.goto(`${app.baseUrl}/profile/88`)
  const section = page.getByTestId('rating-history')
  await section.getByTestId('rating-chart').waitFor()
  assert.equal(await section.getByRole('link', { name: /Chơi ngay/ }).count(), 0)

  await section.getByTestId('rating-point').first().hover()
  const text = await page.getByTestId('rating-tooltip').innerText()
  assert.match(text, /1216 Elo/)
  assert.doesNotMatch(text, /vs |Bấm để xem lại/)
  await section.getByTestId('rating-point').first().click()
  assert.match(page.url(), /\/profile\/88$/, 'a point without a game opens nothing')
})
