// The Friends page's loading / retry and username search, in Chrome with a
// faked backend (see openMockedPage in ./browser.js). Written before the
// lint clean-up of Friends.jsx (no setState inside its effects) to pin what
// the page does today: a failed load shows the error and "Thử lại" loads
// again; the search waits for typing to stop, shows "Đang tìm kiếm...", then
// the results; a slow reply for an older query ("ab") never replaces the
// newer one ("abc"); clearing the box hides the results without a request,
// and typing the same name again searches again.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const FRIEND = { id: 201, username: 'ban_cu', displayName: null, avatarUrl: null, rating: 1300, online: false }

// The three lists the page loads up front. While `control.failing` is true
// GET /friends is a 503. (React StrictMode may run the mount effect twice
// in dev, so counts compare before/after an action, not absolute totals.)
async function mockFriendLists(page, control = { failing: false }) {
  const calls = { friends: 0 }
  await page.route(/\/api\/friends(\?|$)/, (route) => {
    calls.friends += 1
    if (control.failing) {
      return route.fulfill(json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Không thể tải danh sách bạn bè lúc này.' }, 503))
    }
    return route.fulfill(json({ success: true, friends: [FRIEND] }))
  })
  await page.route(/\/api\/friends\/requests\/(received|sent)(\?|$)/, (route) =>
    route.fulfill(json({ success: true, requests: [] }))
  )
  await page.route(/\/api\/challenges/, (route) => route.fulfill(json({ success: true, challenges: [] })))
  return calls
}

const searchResult = (id, username) => ({ id, username, displayName: null, avatarUrl: null, rating: 1200, relationshipStatus: 'NONE' })

// GET /users/search?q=…: every request is logged as { q } and answered by
// `answer(q)`, which may return a promise to hold the reply back.
async function mockSearch(page, answer) {
  const requests = []
  await page.route(/\/api\/users\/search(\?|$)/, async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')
    requests.push(q)
    const users = await answer(q)
    return route.fulfill(json({ success: true, users }))
  })
  return requests
}

const searchBox = (page) => page.getByPlaceholder('Tìm kiếm theo tên người dùng...')

async function openReceivedTab(page) {
  await page.goto(`${app.baseUrl}/friends`)
  await page.getByText('ban_cu', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Lời mời nhận' }).click()
  await searchBox(page).waitFor()
}

test('a failed load shows the error; "Thử lại" loads the lists', async (t) => {
  const ctx = await openMockedPage(app, t)
  if (!ctx) return
  const { page, errors } = ctx
  const control = { failing: true }
  const calls = await mockFriendLists(page, control)

  await page.goto(`${app.baseUrl}/friends`)
  await page.getByText('Không thể tải danh sách bạn bè lúc này.').waitFor()
  assert.equal(await page.getByText('ban_cu', { exact: true }).count(), 0)

  const before = calls.friends
  control.failing = false
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await page.getByText('ban_cu', { exact: true }).waitFor()
  assert.equal(await page.getByText('Không thể tải danh sách bạn bè lúc này.').count(), 0, 'the old error stayed on screen')
  assert.equal(calls.friends, before + 1, 'Thử lại should make exactly one request')
  assert.deepEqual(errors, [])
})

test('search: "Đang tìm kiếm..." then results; the query sent is the trimmed text', async (t) => {
  const ctx = await openMockedPage(app, t)
  if (!ctx) return
  const { page, errors } = ctx
  await mockFriendLists(page)
  let release
  const held = new Promise((resolve) => {
    release = resolve
  })
  const requests = await mockSearch(page, async (q) => {
    await held
    return [searchResult(301, `${q}_user`)]
  })
  await openReceivedTab(page)

  await searchBox(page).fill('  tuong  ')
  await page.getByText('Đang tìm kiếm...').waitFor()
  await page.waitForTimeout(600)
  assert.deepEqual(requests, ['tuong'], 'the request should carry the trimmed query, once')
  release()
  await page.getByText('tuong_user', { exact: true }).waitFor()
  assert.equal(await page.getByText('Đang tìm kiếm...').count(), 0, 'stuck on "Đang tìm kiếm..."')
  assert.deepEqual(errors, [])
})

test('search: a late reply for "ab" never replaces the results for "abc"', async (t) => {
  const ctx = await openMockedPage(app, t)
  if (!ctx) return
  const { page, errors } = ctx
  await mockFriendLists(page)
  let releaseAb
  const abHeld = new Promise((resolve) => {
    releaseAb = resolve
  })
  const requests = await mockSearch(page, async (q) => {
    if (q === 'ab') {
      await abHeld
      return [searchResult(401, 'ket_qua_ab')]
    }
    return [searchResult(402, `ket_qua_${q}`)]
  })
  await openReceivedTab(page)

  await searchBox(page).fill('ab')
  // Wait until the "ab" request is actually out (held by the mock).
  for (let i = 0; i < 50 && !requests.includes('ab'); i += 1) await page.waitForTimeout(50)
  assert.ok(requests.includes('ab'), 'the "ab" search was never sent')

  await searchBox(page).fill('abc')
  await page.getByText('ket_qua_abc', { exact: true }).waitFor()

  // Now the "ab" reply arrives, late.
  releaseAb()
  await page.waitForTimeout(800)
  assert.equal(await page.getByText('ket_qua_abc', { exact: true }).count(), 1, 'the "abc" results were replaced')
  assert.equal(await page.getByText('ket_qua_ab', { exact: true }).count(), 0, 'the late "ab" reply was shown')
  assert.equal(await page.getByText('Đang tìm kiếm...').count(), 0)
  assert.deepEqual(requests, ['ab', 'abc'])
  assert.deepEqual(errors, [])
})

test('search: clearing hides the results without a request; the same name searches again', async (t) => {
  const ctx = await openMockedPage(app, t)
  if (!ctx) return
  const { page, errors } = ctx
  await mockFriendLists(page)
  const requests = await mockSearch(page, async (q) => [searchResult(501, `${q}_user`)])
  await openReceivedTab(page)

  await searchBox(page).fill('tuong')
  await page.getByText('tuong_user', { exact: true }).waitFor()
  assert.deepEqual(requests, ['tuong'])

  await searchBox(page).fill('')
  await page.waitForTimeout(800)
  assert.equal(await page.getByText('tuong_user', { exact: true }).count(), 0, 'results still shown for an empty box')
  assert.deepEqual(requests, ['tuong'], 'an empty box must not call the server')

  await searchBox(page).fill('   ')
  await page.waitForTimeout(800)
  assert.deepEqual(requests, ['tuong'], 'a blank box must not call the server')

  await searchBox(page).fill('tuong')
  await page.getByText('tuong_user', { exact: true }).waitFor()
  await page.waitForTimeout(200)
  assert.deepEqual(requests, ['tuong', 'tuong'], 'typing the same name again should search again')
  assert.deepEqual(errors, [])
})

test('search: a failed search shows its error, the next one recovers', async (t) => {
  const ctx = await openMockedPage(app, t)
  if (!ctx) return
  const { page, errors } = ctx
  await mockFriendLists(page)
  await page.route(/\/api\/users\/search(\?|$)/, (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')
    if (q === 'loi') return route.fulfill(json({ success: false, message: 'Tìm kiếm đang gặp sự cố.' }, 503))
    return route.fulfill(json({ success: true, users: [] }))
  })
  await openReceivedTab(page)

  await searchBox(page).fill('loi')
  await page.getByText('Tìm kiếm đang gặp sự cố.').waitFor()
  await searchBox(page).fill('khongco')
  await page.getByText('Không tìm thấy người chơi phù hợp.').waitFor()
  assert.equal(await page.getByText('Tìm kiếm đang gặp sự cố.').count(), 0, 'the old error stayed on screen')
  assert.deepEqual(errors, [])
})
