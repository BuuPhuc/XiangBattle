// "Đăng xuất khỏi tất cả thiết bị" and signing out when the server ends the
// session, in Chrome with a faked backend (see openMockedPage in
// ./browser.js — no server, database or real account involved).
//
// Covers: the button is for signed-in users only; it always asks first and
// Hủy changes nothing; confirming calls POST /auth/logout-all once (no user
// id sent) and signs this device out onto the login page; a failed request
// keeps the user signed in; a TOKEN_REVOKED / TOKEN_EXPIRED / INVALID_TOKEN
// reply mid-session signs out cleanly onto the login page with the reason;
// a wrong password (INVALID_CREDENTIALS) or a 403 never signs anyone out
// and causes no reload loop; a revoked token found at start-up just leaves
// a guest, exactly as an expired one always did.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const pathname = (page) => new URL(page.url()).pathname
const searchParam = (page, name) => new URL(page.url()).searchParams.get(name)
const openButton = (page) => page.getByRole('button', { name: 'Đăng xuất tất cả' })
const dialog = (page) => page.getByRole('dialog')
const savedSession = (page) =>
  page.evaluate(() => ({ token: localStorage.getItem('accessToken'), user: localStorage.getItem('xiangbattle_user') }))

// Answers POST /auth/logout-all with `reply` and logs every call.
async function mockLogoutAll(page, reply = json({ success: true, message: 'Đã đăng xuất khỏi tất cả thiết bị.' })) {
  const calls = []
  await page.route(/\/api\/auth\/logout-all(\?|$)/, (route) => {
    const request = route.request()
    calls.push({ method: request.method(), authorization: request.headers().authorization, body: request.postData() })
    return route.fulfill(typeof reply === 'function' ? reply() : reply)
  })
  return calls
}

// Counts full page loads of the main frame from now on.
function countPageLoads(page) {
  const loads = { count: 0 }
  page.on('load', () => {
    loads.count += 1
  })
  return loads
}

async function openSettingsSignedIn(t, options = {}) {
  const ctx = await openMockedPage(app, t, { seedOnce: true, ...options })
  if (!ctx) return null
  await ctx.page.goto(`${app.baseUrl}/settings`)
  await openButton(ctx.page).waitFor()
  return ctx
}

test('guest: no "Đăng xuất khỏi tất cả thiết bị" in Settings', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/settings`)
  await page.getByRole('switch', { name: 'Âm thanh' }).waitFor()
  assert.equal(await page.getByText('Đăng xuất khỏi tất cả thiết bị').count(), 0)
  assert.equal(await openButton(page).count(), 0)
  assert.deepEqual(errors, [])
})

test('signed in: asks first, Hủy changes nothing, confirming signs this device out', async (t) => {
  const ctx = await openSettingsSignedIn(t)
  if (!ctx) return
  const { page, errors } = ctx
  const calls = await mockLogoutAll(page)

  await openButton(page).click()
  await dialog(page).waitFor()
  assert.match(await dialog(page).innerText(), /Đăng xuất khỏi tất cả thiết bị\?/)
  assert.match(await dialog(page).innerText(), /kể cả thiết bị này/)
  await dialog(page).getByRole('button', { name: 'Hủy' }).click()
  await dialog(page).waitFor({ state: 'detached' })
  assert.equal(calls.length, 0, 'Hủy must not call the server')
  assert.equal(pathname(page), '/settings')
  assert.equal((await savedSession(page)).token, 'fake-token-for-tests', 'Hủy must keep the session')

  // Escape is a cancel too.
  await openButton(page).click()
  await dialog(page).waitFor()
  await page.keyboard.press('Escape')
  await dialog(page).waitFor({ state: 'detached' })
  assert.equal(calls.length, 0)

  await openButton(page).click()
  await dialog(page).getByRole('button', { name: 'Đăng xuất tất cả' }).click()
  await page.waitForURL((url) => url.pathname === '/login')
  await page.getByText('Đã đăng xuất khỏi tất cả thiết bị.').waitFor()

  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].authorization, 'Bearer fake-token-for-tests')
  assert.ok(!calls[0].body || !/userId|"id"/.test(calls[0].body), `a user id was sent: ${calls[0].body}`)
  assert.equal(searchParam(page, 'session'), 'LOGGED_OUT_ALL')
  assert.deepEqual(await savedSession(page), { token: null, user: null })
  // Really signed out: Settings is the guest version now.
  await page.goto(`${app.baseUrl}/settings`)
  await page.getByRole('switch', { name: 'Âm thanh' }).waitFor()
  assert.equal(await openButton(page).count(), 0)
  assert.deepEqual(errors, [])
})

test('signed in: a failed logout-all keeps the user signed in and says so', async (t) => {
  const ctx = await openSettingsSignedIn(t)
  if (!ctx) return
  const { page, errors } = ctx
  const calls = await mockLogoutAll(
    page,
    json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.' }, 503)
  )

  await openButton(page).click()
  await dialog(page).getByRole('button', { name: 'Đăng xuất tất cả' }).click()
  await dialog(page).getByRole('alert').waitFor()
  assert.match(await dialog(page).getByRole('alert').innerText(), /thử lại/)
  assert.equal(calls.length, 1)
  assert.equal(pathname(page), '/settings')
  assert.equal((await savedSession(page)).token, 'fake-token-for-tests')

  await dialog(page).getByRole('button', { name: 'Hủy' }).click()
  await dialog(page).waitFor({ state: 'detached' })
  assert.equal(await openButton(page).count(), 1, 'still the signed-in Settings')
  assert.deepEqual(errors, [])
})

for (const [code, message] of [
  ['TOKEN_REVOKED', 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.'],
  ['TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'],
  ['INVALID_TOKEN', 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.'],
]) {
  test(`mid-session ${code} from the API: signs out cleanly onto the login page`, async (t) => {
    const ctx = await openSettingsSignedIn(t)
    if (!ctx) return
    const { page, errors } = ctx
    await page.getByRole('switch', { name: 'Vẽ mũi tên và đánh dấu' }).waitFor()
    // From now on the server refuses this token.
    await page.route(/\/api\/users\/me\/settings(\?|$)/, (route) =>
      route.fulfill(json({ success: false, code, message: 'refused' }, 401))
    )

    await page.getByRole('switch', { name: 'Âm thanh' }).click()
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/login')
    await page.getByText(message).waitFor()
    assert.equal(searchParam(page, 'session'), code)
    assert.equal(searchParam(page, 'next'), '/settings', 'signing in again should return to the page')
    assert.deepEqual(await savedSession(page), { token: null, user: null })

    // Settled: it stays on the login page, as a guest.
    const loads = countPageLoads(page)
    await page.waitForTimeout(800)
    assert.equal(loads.count, 0, 'the page kept reloading')
    assert.equal(pathname(page), '/login')
    assert.equal(await page.getByRole('button', { name: 'Đăng nhập' }).count() > 0, true)
    assert.deepEqual(errors, [])
  })
}

test('wrong password (INVALID_CREDENTIALS, a 401) never signs out or loops', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  const loginCalls = []
  await page.route(/\/api\/auth\/login(\?|$)/, (route) => {
    loginCalls.push(route.request().postDataJSON())
    return route.fulfill(
      json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' }, 401)
    )
  })
  await page.goto(`${app.baseUrl}/login?next=%2Fprofile`)
  // A stale token left in storage must not turn a wrong password into a "session ended".
  await page.evaluate(() => localStorage.setItem('accessToken', 'stale-token'))
  const loads = countPageLoads(page)

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.locator('input[type="email"]').fill('tester@example.com')
    await page.locator('input[type="password"]').fill(`wrong-password-${attempt}`)
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.getByText('Email hoặc mật khẩu không đúng.').waitFor()
  }
  await page.waitForTimeout(500)

  assert.equal(loginCalls.length, 3)
  assert.equal(loads.count, 0, 'a wrong password reloaded the page')
  assert.equal(pathname(page), '/login')
  assert.equal(searchParam(page, 'session'), null, 'a wrong password was reported as a session ending')
  assert.equal(searchParam(page, 'next'), '/profile', 'the return path was lost')
  assert.equal(await page.getByText('Phiên đăng nhập', { exact: false }).count(), 0)
  assert.equal(await page.evaluate(() => localStorage.getItem('accessToken')), 'stale-token')
  assert.deepEqual(errors, [])
})

test('other 401 / 403 replies mid-session do not sign out', async (t) => {
  const ctx = await openSettingsSignedIn(t)
  if (!ctx) return
  const { page, errors } = ctx
  await page.getByRole('switch', { name: 'Vẽ mũi tên và đánh dấu' }).waitFor()
  const replies = [
    json({ success: false, code: 'FORBIDDEN', message: 'Không có quyền.' }, 403),
    json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Sai.' }, 401),
    json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Đã có lỗi xảy ra.' }, 503),
  ]
  let next = 0
  await page.route(/\/api\/users\/me\/settings(\?|$)/, (route) => route.fulfill(replies[next++ % replies.length]))
  const loads = countPageLoads(page)

  await page.getByRole('switch', { name: 'Âm thanh' }).click()
  for (let i = 0; i < replies.length; i += 1) {
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await page.getByText('Không thể lưu thay đổi. Vui lòng thử lại.').waitFor()
  }
  await page.waitForTimeout(500)
  assert.equal(next, replies.length)
  assert.equal(loads.count, 0)
  assert.equal(pathname(page), '/settings')
  assert.equal((await savedSession(page)).token, 'fake-token-for-tests')
  assert.equal(await openButton(page).count(), 1, 'still signed in')
  assert.deepEqual(errors, [])
})

test('start-up with a revoked token: a guest, no redirect (same as an expired one)', async (t) => {
  const ctx = await openMockedPage(app, t, {
    seedOnce: true,
    authMe: () => json({ success: false, code: 'TOKEN_REVOKED', message: 'refused' }, 401),
  })
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/settings`)
  await page.getByRole('switch', { name: 'Âm thanh' }).waitFor()
  await page.waitForTimeout(500)
  assert.equal(pathname(page), '/settings')
  assert.equal(await openButton(page).count(), 0)
  assert.deepEqual(await savedSession(page), { token: null, user: null })
  assert.deepEqual(errors, [])
})
