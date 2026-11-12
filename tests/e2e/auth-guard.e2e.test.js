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
  // (/settings is no longer private — see the guest test below — but a
  // signed-in direct load must still land on it.)
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

const signInPrompt = (page) => page.getByTestId('sign-in-prompt')

test('signed out: a private page shows a sign-in prompt in place (no bounce to "/")', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/profile`)
  await signInPrompt(page).waitFor()
  await page.waitForTimeout(500)
  assert.equal(pathname(page), '/profile')
  // The app shell (sidebar) is still there around it.
  assert.equal(await page.locator('aside').getByText('Bảng xếp hạng').count(), 1)
  assert.equal(await signInPrompt(page).getByRole('link', { name: 'Đăng nhập' }).getAttribute('href'), '/login?next=%2Fprofile')
  assert.equal(await signInPrompt(page).getByRole('link', { name: 'Đăng ký' }).getAttribute('href'), '/register')
})

// Every page that is still private, each loaded directly while signed out.
const PRIVATE_PAGES = ['/profile', '/profile/edit', '/profile/100', '/friends', '/replay/42']

test('/dashboard (removed) lands on /play, signed in or not', async (t) => {
  for (const signedIn of [true, false]) {
    const ctx = await openMockedPage(app, t, { signedIn })
    if (!ctx) return
    const { page } = ctx
    await page.goto(`${app.baseUrl}/dashboard`)
    await page.waitForURL((url) => url.pathname === '/play')
    assert.equal(await page.getByText('đang được xây dựng').count(), 0)
  }
})

test('signed out: every private page shows the sign-in prompt and stays put', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  for (const path of PRIVATE_PAGES) {
    await page.goto(`${app.baseUrl}${path}`)
    await signInPrompt(page).waitFor({ timeout: 3000 })
    assert.equal(pathname(page), path, `${path} navigated away`)
  }
})

test('signed out: Bảng xếp hạng and Câu lạc bộ are open to guests', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  const leaderboardCalls = []
  await page.route(/\/api\/leaderboard/, (route) => {
    leaderboardCalls.push(route.request().headers().authorization ?? null)
    return route.fulfill(
      json({
        success: true,
        players: [
          { rank: 1, id: 100, username: 'top_player', displayName: null, avatarUrl: null, rating: 1800, wins: 30, losses: 5, draws: 2 },
          { rank: 2, id: 101, username: 'second_player', displayName: null, avatarUrl: null, rating: 1650, wins: 20, losses: 9, draws: 1 },
        ],
        currentUser: null,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      })
    )
  })

  // Reached from the sidebar, the way the user did it.
  await page.goto(`${app.baseUrl}/play`)
  await page.locator('aside').getByRole('link', { name: /Bảng xếp hạng/ }).click()
  await page.getByText('top_player').first().waitFor()
  assert.equal(pathname(page), '/leaderboard')
  assert.equal(await signInPrompt(page).count(), 0)
  assert.equal(await page.getByTestId('leaderboard-guest-hint').getByRole('link', { name: 'Đăng nhập' }).getAttribute('href'), '/login?next=%2Fleaderboard')
  // (Dev mode's StrictMode may run the fetch effect twice — every call counts.)
  assert.ok(leaderboardCalls.length >= 1)
  assert.ok(leaderboardCalls.every((auth) => auth === null), 'a guest should call the leaderboard API without a token')

  await page.goto(`${app.baseUrl}/clubs`)
  await page.getByText('Câu lạc bộ sẽ sớm ra mắt').waitFor()
  assert.equal(pathname(page), '/clubs')
  assert.equal(await signInPrompt(page).count(), 0)
})

test('sign-in prompt → Đăng nhập → back on the page that asked', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.route(/\/api\/auth\/login/, (route) => route.fulfill(json({ success: true, token: 'fake-token-for-tests', user: TEST_USER })))

  await page.goto(`${app.baseUrl}/friends`)
  await signInPrompt(page).getByRole('link', { name: 'Đăng nhập' }).click()
  await page.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('next') === '/friends')
  await page.locator('input[type="email"], input[name="email"]').first().fill('tester@example.com')
  await page.locator('input[type="password"]').first().fill('secret123')
  await page.locator('form').getByRole('button', { name: /Đăng nhập/ }).click()
  await page.waitForURL((url) => url.pathname === '/friends')
  await page.waitForTimeout(300)
  assert.equal(await signInPrompt(page).count(), 0, 'still asked to sign in after signing in')
})

test('login ?next= never leaves the site', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.route(/\/api\/auth\/login/, (route) => route.fulfill(json({ success: true, token: 'fake-token-for-tests', user: TEST_USER })))
  await page.goto(`${app.baseUrl}/login?next=${encodeURIComponent('//evil.example.com/x')}`)
  await page.locator('input[type="email"], input[name="email"]').first().fill('tester@example.com')
  await page.locator('input[type="password"]').first().fill('secret123')
  await page.locator('form').getByRole('button', { name: /Đăng nhập/ }).click()
  await page.waitForURL((url) => url.pathname === '/play')
  assert.ok(page.url().startsWith(app.baseUrl), `left the site: ${page.url()}`)
})

test('signed out: /settings is open to guests (sound only) — no redirect', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, settingsCalls } = ctx
  await page.goto(`${app.baseUrl}/settings`)
  await page.getByRole('switch', { name: 'Âm thanh' }).waitFor()
  await page.waitForTimeout(800)
  assert.equal(pathname(page), '/settings')
  assert.deepEqual(settingsCalls, [])
})

test('expired session on /settings: falls back to the guest page, no settings API call', async (t) => {
  const ctx = await openMockedPage(app, t, {
    authMe: () => json({ success: false, code: 'UNAUTHORIZED', message: 'Token hết hạn' }, 401),
  })
  if (!ctx) return
  const { page, settingsCalls } = ctx
  await page.goto(`${app.baseUrl}/settings`)
  await page.getByRole('switch', { name: 'Âm thanh' }).waitFor()
  assert.equal(await page.getByRole('switch', { name: 'Vẽ mũi tên và đánh dấu' }).count(), 0)
  assert.equal(pathname(page), '/settings')
  assert.deepEqual(settingsCalls, [])
})

test('expired session: sign-in prompt shown and the saved session is cleared', async (t) => {
  const ctx = await openMockedPage(app, t, {
    authMe: () => json({ success: false, code: 'UNAUTHORIZED', message: 'Token hết hạn' }, 401),
  })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/profile`)
  await signInPrompt(page).waitFor()
  assert.equal(pathname(page), '/profile')
  const saved = await page.evaluate(() => [localStorage.getItem('accessToken'), localStorage.getItem('xiangbattle_user')])
  assert.deepEqual(saved, [null, null])
})
