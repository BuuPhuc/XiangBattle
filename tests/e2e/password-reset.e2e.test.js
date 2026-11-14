// "Quên mật khẩu" / "Đặt lại mật khẩu" in Chrome with a faked backend (see
// openMockedPage in ./browser.js — no server, database or email involved).
//
// Covers: the "Quên mật khẩu?" link on the login page; the request form
// shows the server's one generic answer; the reset page takes the token
// from after "#", wipes it from the address bar and sends it only in the
// POST body (never in any URL); it turns referrers off while open;
// mismatched / too-short passwords are caught before any request; a wrong
// or expired link explains itself and offers a new one; success lands on
// the login page with "Đã đổi mật khẩu, hãy đăng nhập lại." and clears a
// session this browser had; no token in the URL at all → a way to get a new
// link.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const TOKEN = 'ab'.repeat(32)
const GENERIC = 'Nếu email này có tài khoản, chúng tôi đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.'
const pathname = (page) => new URL(page.url()).pathname
const param = (page, name) => new URL(page.url()).searchParams.get(name)
const newPassword = (page) => page.getByLabel('Mật khẩu mới', { exact: true })
const confirmPassword = (page) => page.getByLabel('Nhập lại mật khẩu mới')
const submit = (page) => page.getByRole('button', { name: 'Đặt lại mật khẩu' })

// Answers POST /auth/reset-password with `reply` and logs each body.
async function mockReset(page, reply = json({ success: true, message: 'Đã đổi mật khẩu, hãy đăng nhập lại.' })) {
  const calls = []
  await page.route(/\/api\/auth\/reset-password(\?|$)/, (route) => {
    calls.push({ url: route.request().url(), method: route.request().method(), body: route.request().postDataJSON() })
    return route.fulfill(reply)
  })
  return calls
}

// Every URL the page requested (to prove the token never travels in one).
function recordUrls(page) {
  const urls = []
  page.on('request', (r) => urls.push(r.url()))
  return urls
}

async function openResetPage(t, options = {}) {
  const ctx = await openMockedPage(app, t, { signedIn: false, ...options })
  if (!ctx) return null
  const calls = await mockReset(ctx.page, options.reply)
  const urls = recordUrls(ctx.page)
  await ctx.page.goto(`${app.baseUrl}/reset-password#token=${TOKEN}`)
  await newPassword(ctx.page).waitFor()
  return { ...ctx, calls, urls }
}

test('login page: "Quên mật khẩu?" → the request form; it shows the one generic answer', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  const calls = []
  await page.route(/\/api\/auth\/forgot-password(\?|$)/, (route) => {
    calls.push(route.request().postDataJSON())
    return route.fulfill(json({ success: true, message: GENERIC }))
  })

  await page.goto(`${app.baseUrl}/login`)
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click()
  await page.waitForURL((url) => url.pathname === '/forgot-password')
  await page.getByRole('heading', { name: 'Quên mật khẩu' }).waitFor()

  await page.getByLabel('Email').fill('someone@example.com')
  await page.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click()
  await page.getByText(GENERIC).waitFor()
  assert.deepEqual(calls, [{ email: 'someone@example.com' }])
  assert.equal(await page.getByRole('link', { name: 'Quay lại đăng nhập' }).count(), 1)
  assert.deepEqual(errors, [])
})

test('request form: a failure (e.g. rate limit) is shown and the form stays', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  await page.route(/\/api\/auth\/forgot-password(\?|$)/, (route) =>
    route.fulfill(json({ success: false, code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' }, 429))
  )
  await page.goto(`${app.baseUrl}/forgot-password`)
  await page.getByLabel('Email').fill('someone@example.com')
  await page.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click()
  await page.getByText('Quá nhiều yêu cầu, vui lòng thử lại sau.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Gửi liên kết đặt lại' }).isEnabled(), true)
  assert.equal(pathname(page), '/forgot-password', 'a 429 must not sign anyone out or navigate')
  assert.deepEqual(errors, [])
})

test('reset page: the token is read from "#", wiped from the address bar, and referrers are off', async (t) => {
  const ctx = await openResetPage(t)
  if (!ctx) return
  const { page, errors } = ctx
  await page.waitForFunction(() => window.location.hash === '')
  assert.equal(page.url(), `${app.baseUrl}/reset-password`)
  assert.ok(!page.url().includes(TOKEN))
  assert.equal(await page.locator('meta[name="referrer"][content="no-referrer"]').count(), 1)
  assert.deepEqual(errors, [])
})

test('reset page: mismatched or too-short passwords are caught before any request', async (t) => {
  const ctx = await openResetPage(t)
  if (!ctx) return
  const { page, calls, errors } = ctx

  await newPassword(page).fill('matkhaumoi1')
  await confirmPassword(page).fill('matkhaumoi2')
  await submit(page).click()
  await page.getByText('Hai mật khẩu không khớp.').waitFor()

  await newPassword(page).fill('ngan')
  await confirmPassword(page).fill('ngan')
  await submit(page).click()
  await page.getByText('Mật khẩu phải có ít nhất 8 ký tự.').waitFor()

  assert.equal(calls.length, 0)
  assert.deepEqual(errors, [])
})

for (const [code, message] of [
  ['RESET_TOKEN_INVALID', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng.'],
  ['RESET_TOKEN_EXPIRED', 'Liên kết đặt lại mật khẩu đã hết hạn.'],
]) {
  test(`reset page: ${code} explains itself and offers a new link`, async (t) => {
    const ctx = await openResetPage(t, { reply: json({ success: false, code, message }, 400) })
    if (!ctx) return
    const { page, calls, errors } = ctx
    await newPassword(page).fill('matkhaumoi1')
    await confirmPassword(page).fill('matkhaumoi1')
    await submit(page).click()
    await page.getByText(message).waitFor()
    assert.equal(calls.length, 1)
    assert.equal(pathname(page), '/reset-password')
    await page.getByRole('link', { name: 'Gửi lại liên kết' }).click()
    await page.waitForURL((url) => url.pathname === '/forgot-password')
    assert.deepEqual(errors, [])
  })
}

test('reset page: success → login page with "Đã đổi mật khẩu"; the token travelled only in the body', async (t) => {
  const ctx = await openResetPage(t)
  if (!ctx) return
  const { page, calls, urls, errors } = ctx
  await newPassword(page).fill('matkhaumoi1')
  await confirmPassword(page).fill('matkhaumoi1')
  await submit(page).click()

  await page.waitForURL((url) => url.pathname === '/login')
  await page.getByText('Đã đổi mật khẩu, hãy đăng nhập lại.').waitFor()
  assert.equal(param(page, 'session'), 'PASSWORD_RESET')
  assert.equal(param(page, 'next'), null, 'should not send the user back to the reset form')

  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'POST')
  assert.deepEqual(calls[0].body, { token: TOKEN, password: 'matkhaumoi1' })
  const leaked = urls.filter((u) => u.includes(TOKEN))
  assert.deepEqual(leaked, [], 'the token appeared in a request URL')
  assert.deepEqual(errors, [])
})

test('reset page while signed in: success clears this browser\'s session too', async (t) => {
  const ctx = await openResetPage(t, { signedIn: true, seedOnce: true })
  if (!ctx) return
  const { page, errors } = ctx
  assert.equal(await page.evaluate(() => localStorage.getItem('accessToken')), 'fake-token-for-tests')
  await newPassword(page).fill('matkhaumoi1')
  await confirmPassword(page).fill('matkhaumoi1')
  await submit(page).click()
  await page.getByText('Đã đổi mật khẩu, hãy đăng nhập lại.').waitFor()
  assert.deepEqual(
    await page.evaluate(() => [localStorage.getItem('accessToken'), localStorage.getItem('xiangbattle_user')]),
    [null, null]
  )
  assert.deepEqual(errors, [])
})

test('reset page without a token (or reloaded after it was wiped): offers a new link', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  const calls = await mockReset(page)
  await page.goto(`${app.baseUrl}/reset-password#token=${TOKEN}`)
  await newPassword(page).waitFor()
  await page.waitForFunction(() => window.location.hash === '')
  await page.reload()
  await page.getByText('Liên kết không hợp lệ.', { exact: false }).waitFor()
  assert.equal(await newPassword(page).count(), 0)
  await page.getByRole('link', { name: 'Gửi lại liên kết' }).click()
  await page.waitForURL((url) => url.pathname === '/forgot-password')
  assert.equal(calls.length, 0)
  assert.deepEqual(errors, [])
})
