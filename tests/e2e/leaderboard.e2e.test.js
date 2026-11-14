// The leaderboard's loading / paging / retry behavior, in Chrome with a
// faked backend (see openMockedPage in ./browser.js). Written before the
// lint clean-up of Leaderboard.jsx (no setState inside the fetch effect) to
// pin what the page does today: page 1 → 2 → 1 shows the right players and
// "Trang x/y"; a failed load shows the error and "Thử lại" loads again;
// when the viewer changes mid-load (session confirmed after the first
// render) the newest result wins and a late reply never overwrites it.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json, TEST_USER } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const TOTAL = 25
const PAGE_SIZE = 20

function player(rank) {
  return { id: 1000 + rank, rank, username: `player_${rank}`, displayName: null, avatarUrl: null, rating: 2000 - rank, wins: 1, draws: 0, losses: 0 }
}

// Serves GET /leaderboard like the server does (20 per page, 2 pages) and
// logs every call. While `control.failing` is true every call is a 503.
// (In dev, React StrictMode runs a mount effect twice, so a page load can
// make two identical calls — tests compare the distinct sequence.)
async function mockLeaderboard(page, control = { failing: false }) {
  const calls = []
  await page.route(/\/api\/leaderboard(\?|$)/, (route) => {
    const url = new URL(route.request().url())
    const n = Number(url.searchParams.get('page') || 1)
    const authorization = route.request().headers().authorization ?? null
    calls.push({ page: n, authorization })
    if (control.failing) {
      return route.fulfill(json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Không thể tải bảng xếp hạng lúc này.' }, 503))
    }
    const start = (n - 1) * PAGE_SIZE + 1
    const players = []
    for (let rank = start; rank <= Math.min(TOTAL, start + PAGE_SIZE - 1); rank += 1) players.push(player(rank))
    return route.fulfill(
      json({
        success: true,
        players,
        pagination: { page: n, limit: PAGE_SIZE, total: TOTAL, totalPages: 2 },
        currentUser: authorization ? { ...player(42), id: TEST_USER.id, username: TEST_USER.username } : null,
      })
    )
  })
  return calls
}

// The pages requested, with immediate repeats collapsed.
const pagesRequested = (calls) => calls.map((c) => c.page).filter((n, i, all) => i === 0 || all[i - 1] !== n)

const pageLabel = (page) => page.getByText(/^Trang \d+\/\d+$/)
const shows = (page, name) => page.getByText(name, { exact: true }).first()

test('paging: page 1 → 2 → 1 shows the right players and label', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  const calls = await mockLeaderboard(page)

  await page.goto(`${app.baseUrl}/leaderboard`)
  await shows(page, 'player_4').waitFor()
  assert.equal(await pageLabel(page).innerText(), 'Trang 1/2')
  assert.equal(await page.getByText('player_21', { exact: true }).count(), 0)

  await page.getByRole('button', { name: 'Sau' }).click()
  await shows(page, 'player_21').waitFor()
  assert.equal(await pageLabel(page).innerText(), 'Trang 2/2')
  assert.equal(await page.getByText('player_4', { exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Sau' }).isDisabled(), true)

  await page.getByRole('button', { name: 'Trước' }).click()
  await shows(page, 'player_4').waitFor()
  assert.equal(await pageLabel(page).innerText(), 'Trang 1/2')

  assert.deepEqual(pagesRequested(calls), [1, 2, 1])
  assert.deepEqual(errors, [])
})

test('a failed load shows the error; "Thử lại" loads again', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  const control = { failing: true }
  const calls = await mockLeaderboard(page, control)

  await page.goto(`${app.baseUrl}/leaderboard`)
  await page.getByText('Không thể tải bảng xếp hạng lúc này.').waitFor()
  assert.equal(await page.getByText('player_4', { exact: true }).count(), 0)

  const before = calls.length
  control.failing = false
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await shows(page, 'player_4').waitFor()
  assert.equal(await page.getByText('Không thể tải bảng xếp hạng lúc này.').count(), 0, 'the old error stayed on screen')
  assert.equal(await page.getByRole('button', { name: 'Thử lại' }).count(), 0)
  assert.equal(calls.length, before + 1, 'Thử lại should make exactly one request')
  assert.deepEqual(errors, [])
})

test('a failure on page 2 then "Thử lại" reloads page 2', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  const control = { failing: false }
  const calls = await mockLeaderboard(page, control)

  await page.goto(`${app.baseUrl}/leaderboard`)
  await shows(page, 'player_4').waitFor()
  control.failing = true
  await page.getByRole('button', { name: 'Sau' }).click()
  await page.getByText('Không thể tải bảng xếp hạng lúc này.').waitFor()
  control.failing = false
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await shows(page, 'player_21').waitFor()
  assert.equal(await pageLabel(page).innerText(), 'Trang 2/2')
  assert.deepEqual(
    calls.map((c) => c.page).slice(-2),
    [2, 2],
    'the retry should ask for page 2 again'
  )
  assert.deepEqual(errors, [])
})

// On a signed-in page load the viewer changes while the page is mounted:
// guest on the first render (the saved session isn't confirmed yet), then
// the account. The page must end up showing the account's view, and a slow
// reply to the earlier request must never overwrite it.
test('viewer changes during load (session confirmed late): the newest view wins', async (t) => {
  let confirmed = false
  const ctx = await openMockedPage(app, t, {
    seedOnce: true,
    authMe: async () => {
      await new Promise((resolve) => setTimeout(resolve, 400))
      confirmed = true
      return json({ success: true, user: TEST_USER })
    },
  })
  if (!ctx) return
  const { page, errors } = ctx
  const calls = []
  await page.route(/\/api\/leaderboard(\?|$)/, async (route) => {
    const early = !confirmed
    calls.push({ early })
    // Replies to requests made before the session was confirmed come back
    // late, and without "your rank"; later ones are quick and have it.
    if (early) await new Promise((resolve) => setTimeout(resolve, 1200))
    return route.fulfill(
      json({
        success: true,
        players: [player(1), player(2), player(3), player(4)],
        pagination: { page: 1, limit: PAGE_SIZE, total: 4, totalPages: 1 },
        currentUser: early ? null : { ...player(42), id: TEST_USER.id, username: TEST_USER.username },
      })
    )
  })

  await page.goto(`${app.baseUrl}/leaderboard`)
  await page.getByText('Xếp hạng của bạn').waitFor()
  await shows(page, 'player_4').waitFor()
  assert.ok(calls.some((c) => c.early), 'expected a request before the session was confirmed')
  assert.ok(calls.some((c) => !c.early), 'expected a refetch once the viewer changed')

  // Let the slow early replies land; they must not replace the newer view.
  await page.waitForTimeout(1600)
  assert.equal(await page.getByText('Xếp hạng của bạn').count(), 1, 'a stale reply overwrote the newer result')
  await shows(page, 'player_4').waitFor()
  assert.deepEqual(errors, [])
})
