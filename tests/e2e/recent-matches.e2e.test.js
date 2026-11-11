// "Ván đấu gần đây" on the Play page, in Chrome. The backend is NOT used:
// every /api call is answered by a fake (page.route) and the socket is
// blocked, so these tests need no server, database or real account, and
// a running backend can't influence them.
//
// Covers: signed out, loading, list (5 games, colours, account totals,
// "Xem tất cả"), empty, error + retry, "Xem" → that game's replay,
// refetch on every visit, and the Profile page still looking as before.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json, TEST_USER as USER } from './browser.js'

const GAMES = [
  { gameId: 42, result: 'WIN', color: 'red', endReason: 'CHECKMATE', moveCount: 37, opp: 'opponent_a' },
  { gameId: 41, result: 'LOSS', color: 'black', endReason: 'TIMEOUT', moveCount: 52, opp: 'opponent_b' },
  { gameId: 40, result: 'DRAW', color: 'red', endReason: 'REPETITION', moveCount: 24, opp: 'opponent_c' },
  { gameId: 39, result: 'WIN', color: 'black', endReason: 'RESIGN', moveCount: 18, opp: 'opponent_d' },
  { gameId: 38, result: 'LOSS', color: 'red', endReason: 'STALEMATE', moveCount: 61, opp: 'opponent_e' },
].map((g, i) => ({
  gameId: g.gameId,
  opponent: { id: 100 + i, username: g.opp, displayName: null, avatarUrl: null },
  result: g.result,
  color: g.color,
  winner: null,
  endReason: g.endReason,
  moveCount: g.moveCount,
  startedAt: '2026-11-01T10:00:00.000Z',
  endedAt: '2026-11-01T10:20:00.000Z',
}))

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

// Opens /play on a faked backend (see openMockedPage in ./browser.js).
async function openPlay(t, { signedIn = true, games = () => json({ success: true, games: GAMES }) } = {}) {
  const ctx = await openMockedPage(app, t, { signedIn, games })
  if (!ctx) return null
  await ctx.page.goto(`${app.baseUrl}/play`)
  return ctx
}

const section = (page) => page.getByTestId('recent-matches')

test('signed out: prompts to sign in and never calls the history API', async (t) => {
  const ctx = await openPlay(t, { signedIn: false })
  if (!ctx) return
  const { page, gameCalls } = ctx
  await section(page).getByText('Đăng nhập để lưu và xem lại ván đấu của bạn').waitFor()
  assert.equal(await section(page).getByRole('link', { name: 'Đăng nhập' }).getAttribute('href'), '/login')
  assert.equal(gameCalls.length, 0)
  assert.equal(await page.getByTestId('record-summary').count(), 0)
})

test('loading state while the history request is pending', async (t) => {
  let release
  const gate = new Promise((resolve) => (release = resolve))
  const ctx = await openPlay(t, {
    games: async () => {
      await gate
      return json({ success: true, games: GAMES })
    },
  })
  if (!ctx) return
  const { page } = ctx
  await section(page).getByLabel('Đang tải').waitFor()
  assert.equal(await section(page).getByRole('button', { name: 'Xem' }).count(), 0)
  release()
  await section(page).getByRole('button', { name: 'Xem' }).first().waitFor()
})

test('list: the 5 latest games with my colour, account totals and "Xem tất cả"', async (t) => {
  const ctx = await openPlay(t)
  if (!ctx) return
  const { page, gameCalls, errors } = ctx
  await section(page).getByRole('button', { name: 'Xem' }).first().waitFor()

  assert.deepEqual(gameCalls[0], { userId: String(USER.id), limit: '5' }, 'should ask for MY 5 latest games')
  assert.equal(await section(page).getByRole('button', { name: 'Xem' }).count(), 5)
  for (const g of GAMES) assert.ok(await section(page).getByText(`vs ${g.opponent.username}`).isVisible())

  const colors = await section(page).getByTestId('game-color').allInnerTexts()
  assert.deepEqual(
    colors.map((c) => c.trim()),
    ['Cầm Đỏ', 'Cầm Đen', 'Cầm Đỏ', 'Cầm Đen', 'Cầm Đỏ']
  )
  assert.ok(await section(page).getByText('Lặp nước', { exact: false }).isVisible())

  // Account totals, not counted from the 5 rows (those would be 2–2–1).
  const summary = (await page.getByTestId('record-summary').innerText()).replace(/\s+/g, ' ').trim()
  assert.equal(summary, 'Thắng 12 · Thua 8 · Hòa 3')

  assert.equal(await section(page).getByRole('link', { name: 'Xem tất cả' }).getAttribute('href'), '/profile')
  assert.deepEqual(errors, [])
})

test('empty: "Chưa có ván đấu nào" with a "Chơi ngay" link', async (t) => {
  const ctx = await openPlay(t, { games: () => json({ success: true, games: [] }) })
  if (!ctx) return
  const { page } = ctx
  await section(page).getByText('Chưa có ván đấu nào').waitFor()
  assert.equal(await section(page).getByRole('link', { name: 'Chơi ngay' }).getAttribute('href'), '/room?mode=quick')
  assert.equal(await section(page).getByRole('link', { name: 'Xem tất cả' }).count(), 0)
})

// (The dev server runs React StrictMode, which mounts effects twice — so a
// page visit may make two identical requests. The tests below therefore
// never rely on an exact request count per visit.)
test('error, then "Thử lại" loads the list', async (t) => {
  let failing = true
  const ctx = await openPlay(t, {
    games: () => (failing ? json({ success: false, message: 'boom' }, 500) : json({ success: true, games: GAMES })),
  })
  if (!ctx) return
  const { page, gameCalls } = ctx
  await section(page).getByText('Không thể tải lịch sử đấu.').waitFor()
  assert.equal(await section(page).getByRole('button', { name: 'Xem' }).count(), 0)

  const callsBeforeRetry = gameCalls.length
  failing = false
  await section(page).getByRole('button', { name: 'Thử lại' }).click()
  await section(page).getByRole('button', { name: 'Xem' }).first().waitFor()
  assert.ok(gameCalls.length > callsBeforeRetry, '"Thử lại" did not request again')
  assert.equal(await section(page).getByRole('button', { name: 'Xem' }).count(), 5)
})

test('"Xem" opens that game’s replay', async (t) => {
  const ctx = await openPlay(t)
  if (!ctx) return
  const { page } = ctx
  // Second row = game 41.
  await section(page).getByRole('button', { name: 'Xem' }).nth(1).click()
  await page.waitForURL(/\/replay\/41$/)
  await page.getByText('Đỏ thắng · Chiếu bí').waitFor()
})

test('the list is fetched again every time the Play page is opened', async (t) => {
  const ctx = await openPlay(t)
  if (!ctx) return
  const { page, gameCalls } = ctx
  await section(page).getByRole('button', { name: 'Xem' }).first().waitFor()
  const callsAfterFirstVisit = gameCalls.length
  await page.getByRole('link', { name: 'Học viện' }).first().click()
  await page.waitForURL(/\/academy/)
  await page.getByRole('link', { name: 'Chơi cờ' }).first().click()
  await page.waitForURL(/\/play$/)
  await section(page).getByRole('button', { name: 'Xem' }).first().waitFor()
  assert.ok(gameCalls.length > callsAfterFirstVisit, 'coming back to the Play page did not refetch')
})

test('"Xem tất cả" → Profile, which is unchanged: 10 games requested, no colour labels', async (t) => {
  const ctx = await openPlay(t)
  if (!ctx) return
  const { page, gameCalls } = ctx
  await section(page).getByRole('link', { name: 'Xem tất cả' }).click()
  await page.waitForURL(/\/profile$/)
  await page.getByRole('button', { name: 'Xem' }).first().waitFor()
  const profileCall = gameCalls.at(-1)
  assert.deepEqual(profileCall, { userId: String(USER.id), limit: '10' })
  assert.equal(await page.getByTestId('game-color').count(), 0)
  assert.equal(await page.getByTestId('record-summary').count(), 0)
})
