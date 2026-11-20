// One language: what a player sees is Vietnamese. Each main page is opened
// on a faked backend and its visible text — plus tooltips, placeholders and
// screen-reader labels — is checked for the English words that used to be
// there. Whole words, case-sensitive, so a name like "melody" never trips
// it (and no name used here contains these words).
// The one allowed "Elo" is on Giới thiệu: "Điểm xếp hạng (tính theo hệ số
// Elo) …" — exactly once in the page's visible text.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const BANNED = [/\bElo\b/, /\bELO\b/, /\bRating\b/, /\bPrivacy Policy\b/, /\bOffline\b/, /Đang online/]

// Visible text, and the text of title / placeholder / aria-label attributes.
function pageText(page) {
  return page.evaluate(() => {
    const attrs = [...document.querySelectorAll('[title], [placeholder], [aria-label]')].flatMap((el) =>
      ['title', 'placeholder', 'aria-label'].map((name) => el.getAttribute(name)).filter(Boolean)
    )
    return `${document.body.innerText}\n${attrs.join('\n')}`
  })
}

function assertVietnamese(text, where, allowed = []) {
  for (const pattern of BANNED) {
    if (allowed.includes(String(pattern))) continue
    const lines = text.split('\n').filter((line) => pattern.test(line))
    assert.deepEqual(lines, [], `${where}: "${pattern}" is still shown`)
  }
}

const FRIENDS = [
  { id: 201, username: 'ban_truc_tuyen', displayName: null, avatarUrl: null, rating: 1300, online: true },
  { id: 202, username: 'ban_ngoai_tuyen', displayName: null, avatarUrl: null, rating: 1180, online: false },
]
const HISTORY = {
  currentRating: 1234,
  peakRating: 1240,
  ratedGames: 1,
  streak: { current: 1, best: 2 },
  points: [{ gameId: 51, endedAt: new Date().toISOString(), rating: 1234, change: 12, opponent: { id: 301, username: 'doi_thu', displayName: null } }],
}
const GAMES = [
  {
    gameId: 51,
    rated: true,
    ratingChange: 12,
    ratingAfter: 1234,
    opponent: { id: 301, username: 'doi_thu', displayName: null, avatarUrl: null },
    result: 'WIN',
    color: 'red',
    winner: null,
    endReason: 'CHECKMATE',
    initialTime: 600,
    increment: 0,
    moveCount: 30,
    startedAt: '2026-11-01T10:00:00.000Z',
    endedAt: '2026-11-01T10:20:00.000Z',
  },
]

async function openSite(t) {
  const ctx = await openMockedPage(app, t, { ratingHistory: HISTORY, games: () => json({ success: true, games: GAMES }) })
  if (!ctx) return null
  const { page } = ctx
  await page.route(/\/api\/friends(\?|$)/, (route) => route.fulfill(json({ success: true, friends: FRIENDS })))
  await page.route(/\/api\/friends\/requests\/received(\?|$)/, (route) =>
    route.fulfill(json({ success: true, requests: [{ id: 203, username: 'loi_moi', displayName: null, avatarUrl: null, rating: 1250 }] }))
  )
  await page.route(/\/api\/friends\/requests\/sent(\?|$)/, (route) => route.fulfill(json({ success: true, requests: [] })))
  await page.route(/\/api\/challenges/, (route) => route.fulfill(json({ success: true, sent: [], received: [] })))
  await page.route(/\/api\/leaderboard/, (route) =>
    route.fulfill(
      json({
        success: true,
        players: [{ rank: 1, id: 7, username: 'tester', displayName: null, avatarUrl: null, rating: 1234, wins: 12, losses: 8, draws: 3 }],
        me: { rank: 1, rating: 1234 },
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      })
    )
  )
  return ctx
}

const PAGES = [
  ['/', 'Trang chủ', (page) => page.getByRole('heading', { level: 1 }).first().waitFor()],
  ['/play', 'Chơi', (page) => page.getByTestId('recent-matches').getByText('vs doi_thu').waitFor()],
  ['/friends', 'Bạn bè', (page) => page.getByText('ban_ngoai_tuyen', { exact: true }).waitFor()],
  ['/profile', 'Hồ sơ', (page) => page.getByTestId('rating-chart').waitFor()],
  ['/leaderboard', 'Bảng xếp hạng', (page) => page.getByRole('heading', { name: 'Bảng xếp hạng' }).waitFor()],
  ['/settings', 'Cài đặt', (page) => page.getByRole('heading', { level: 1 }).first().waitFor()],
  ['/room', 'Tạo phòng', (page) => page.getByTestId('room-friendly-note').waitFor()],
  ['/ai', 'Đấu với máy', (page) => page.getByText(/không tính điểm/).first().waitFor()],
]

for (const [path, name, ready] of PAGES) {
  test(`${name} (${path}) shows no English words`, async (t) => {
    const ctx = await openSite(t)
    if (!ctx) return
    const { page } = ctx
    await page.goto(`${app.baseUrl}${path}`)
    await ready(page)
    assertVietnamese(await pageText(page), name)
  })
}

test('Bạn bè: "Trực tuyến" / "Ngoại tuyến", and a request shows "1250 điểm"', async (t) => {
  const ctx = await openSite(t)
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/friends`)
  await page.getByText('ban_ngoai_tuyen', { exact: true }).waitFor()
  const text = await page.evaluate(() => document.body.innerText)
  assert.match(text, /Trực tuyến/)
  assert.match(text, /Ngoại tuyến/)
  await page.getByRole('button', { name: /Lời mời nhận/ }).click()
  await page.getByText('loi_moi', { exact: true }).waitFor()
  assert.match(await page.evaluate(() => document.body.innerText), /1250 điểm/)
  assertVietnamese(await pageText(page), 'Bạn bè — Lời mời nhận')
})

test('Giới thiệu: "Elo" is shown exactly once, in the sentence about Điểm xếp hạng', async (t) => {
  const ctx = await openSite(t)
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/about`)
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  const text = await page.evaluate(() => document.body.innerText)
  assert.equal(text.match(/\bElo\b/g)?.length ?? 0, 1, 'one "Elo" on the page')
  assert.match(text, /Điểm xếp hạng \(tính theo hệ số Elo\) chỉ thay đổi ở ván Chơi ngay/)
  assert.match(text, /kể cả khi bấm "Chơi lại" trong phòng đó/)
  assert.match(text, /Chính sách quyền riêng tư/)
  assertVietnamese(await pageText(page), 'Giới thiệu', [String(/\bElo\b/)])
})
