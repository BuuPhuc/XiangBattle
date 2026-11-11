// Private pages (RequireAuth) on a full page load / reload, in Chrome with
// a faked backend (see openMockedPage). Regression for: reloading /profile
// while signed in bounced to "/" because the saved session hadn't been
// restored yet on the first render.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json, TEST_USER } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const pathname = (page) => new URL(page.url()).pathname
// The Profile page itself has rendered (its own history section heading).
const profileShown = (page) => page.getByRole('heading', { name: 'Ván đấu gần đây' }).waitFor()

test('signed in: loading /profile directly stays on /profile, also after a reload', async (t) => {
  const ctx = await openMockedPage(app, t)
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/profile`)
  await profileShown(page)
  assert.equal(pathname(page), '/profile')

  await page.reload()
  await profileShown(page)
  assert.equal(pathname(page), '/profile')
  assert.deepEqual(errors, [])
})

test('signed in: every private page survives a direct load', async (t) => {
  const ctx = await openMockedPage(app, t)
  if (!ctx) return
  const { page } = ctx
  for (const path of ['/friends', '/settings', '/leaderboard', '/replay/42']) {
    await page.goto(`${app.baseUrl}${path}`)
    // Give a would-be redirect time to happen.
    await page.waitForTimeout(800)
    assert.equal(pathname(page), path, `${path} redirected away`)
  }
})

test('while the session is being confirmed: loading shown, no redirect', async (t) => {
  let release
  const gate = new Promise((resolve) => (release = resolve))
  const ctx = await openMockedPage(app, t, {
    authMe: async () => {
      await gate
      return json({ success: true, user: TEST_USER })
    },
  })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/profile`)
  await page.getByLabel('Đang tải').first().waitFor()
  assert.equal(pathname(page), '/profile')
  release()
  await profileShown(page)
  assert.equal(pathname(page), '/profile')
})

test('signed out: a private page still redirects to "/"', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/profile`)
  await page.waitForURL((url) => url.pathname === '/')
})

test('expired session: redirected to "/" and the saved session is cleared', async (t) => {
  const ctx = await openMockedPage(app, t, {
    authMe: () => json({ success: false, code: 'UNAUTHORIZED', message: 'Token hết hạn' }, 401),
  })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/profile`)
  await page.waitForURL((url) => url.pathname === '/')
  const saved = await page.evaluate(() => [localStorage.getItem('accessToken'), localStorage.getItem('xiangbattle_user')])
  assert.deepEqual(saved, [null, null])
})
