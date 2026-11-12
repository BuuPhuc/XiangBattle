// Shared setup for the browser tests: starts the app's own Vite dev server
// (no backend needed for local / bot games) and drives installed Google
// Chrome through playwright-core.
//
// Needs Google Chrome installed (or CHROME_PATH pointing at a Chromium-based
// browser). Without one, `skipReason` is set and tests are skipped, not
// passed. On a failing step a screenshot goes to the OS temp folder.
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export async function openApp() {
  const app = { skipReason: null, pageErrors: [], apiCalls: [] }
  try {
    app.browser = await chromium.launch(
      process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, headless: true } : { channel: 'chrome', headless: true }
    )
  } catch (error) {
    app.skipReason = `Chrome not available (${error.message.split('\n')[0]}) — set CHROME_PATH to run these`
    return app
  }
  app.server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false } })
  await app.server.listen()
  app.baseUrl = app.server.resolvedUrls.local[0].replace(/\/$/, '')

  app.page = await app.browser.newPage({ viewport: { width: 1600, height: 1000 } })
  app.page.on('pageerror', (e) => app.pageErrors.push(e.message))
  app.page.on('console', (m) => {
    // The app also tries to reach the backend socket; that's not under test.
    if (m.type() === 'error' && !/socket|ERR_CONNECTION_REFUSED|Failed to load resource|websocket/i.test(m.text())) {
      app.pageErrors.push(m.text())
    }
  })
  app.page.on('request', (r) => {
    if (/\/api\/(games|leaderboard|users)/.test(r.url())) app.apiCalls.push(r.url())
  })
  return app
}

export async function closeApp(app) {
  await app?.browser?.close()
  await app?.server?.close()
}

// Runs a test body; skips without Chrome; screenshots on failure.
export async function step(app, t, fn) {
  if (app.skipReason) return t.skip(app.skipReason)
  try {
    await fn(app.page)
  } catch (error) {
    const file = path.join(os.tmpdir(), `xiangbattle-e2e-${Date.now()}.png`)
    await app.page?.screenshot({ path: file }).catch(() => {})
    error.message += `\n  screenshot: ${file}`
    throw error
  }
}

export const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

export const TEST_USER = { id: 7, username: 'tester', displayName: null, rating: 1234, wins: 12, losses: 8, draws: 3, emailVerified: true }

// A fresh, isolated browser context whose backend is entirely faked: the
// socket is blocked and every /api call is answered here (unlisted ones get
// a 404), so no server, database or real account is involved and a running
// backend can't influence the test. Returns null (test skipped) without
// Chrome.
//   signedIn — seed the saved session a real login leaves in localStorage
//   authMe   — answer to the session check on page load (/auth/me)
//   games    — answer to GET /users/:id/games; calls are logged in gameCalls
//   settings — the signed-in user's stored settings, served (and updated by
//              PATCH) at /users/me/settings; every call is logged in
//              settingsCalls as { method, body }
//   sounds   — record every <audio> play() instead of playing it; read the
//              file names back with soundsPlayed(page)
export async function openMockedPage(
  app,
  t,
  { signedIn = true, user = TEST_USER, authMe, games, settings = DEFAULT_TEST_SETTINGS, sounds = false } = {}
) {
  if (app.skipReason) {
    t.skip(app.skipReason)
    return null
  }
  const context = await app.browser.newContext({ viewport: { width: 1400, height: 1000 } })
  t.after(() => context.close())
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const gameCalls = []

  await page.route(/socket\.io/, (route) => route.abort())
  await page.route(/\/api\//, (route) => route.fulfill(json({ success: false, code: 'NOT_MOCKED' }, 404)))
  await page.route(/\/api\/(auth|users)\/me(\?|$)/, async (route) =>
    route.fulfill(authMe ? await authMe(route.request()) : json({ success: true, user }))
  )
  await page.route(/\/api\/users\/\d+\/games/, async (route) => {
    const url = new URL(route.request().url())
    gameCalls.push({ userId: url.pathname.split('/').at(-2), limit: url.searchParams.get('limit') })
    await route.fulfill(games ? await games(route.request(), gameCalls.length) : json({ success: true, games: [] }))
  })
  await page.route(/\/api\/games\/\d+/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1))
    return route.fulfill(
      json({
        success: true,
        game: {
          id,
          redPlayer: { id: user.id, username: user.username, displayName: null },
          blackPlayer: { id: 100, username: 'opponent_a', displayName: null },
          winner: { id: user.id, username: user.username, displayName: null },
          result: 'RED_WIN',
          endReason: 'CHECKMATE',
          moves: [],
        },
      })
    )
  })

  const settingsCalls = []
  let storedSettings = { ...settings }
  await page.route(/\/api\/users\/me\/settings(\?|$)/, (route) => {
    const request = route.request()
    const body = request.postDataJSON?.() ?? null
    settingsCalls.push({ method: request.method(), body })
    if (request.method() === 'PATCH') storedSettings = { ...storedSettings, ...body }
    return route.fulfill(json({ success: true, settings: storedSettings }))
  })

  if (sounds) {
    await page.addInitScript(() => {
      window.__soundsPlayed = []
      HTMLMediaElement.prototype.play = function play() {
        window.__soundsPlayed.push(decodeURIComponent(new URL(this.src).pathname.split('/').at(-1)))
        return Promise.resolve()
      }
    })
  }

  if (signedIn) {
    await page.addInitScript((u) => {
      localStorage.setItem('accessToken', 'fake-token-for-tests')
      localStorage.setItem('xiangbattle_user', JSON.stringify(u))
    }, user)
  }
  return { page, gameCalls, settingsCalls, errors }
}

export const DEFAULT_TEST_SETTINGS = {
  soundEnabled: true,
  arrowsEnabled: true,
  recentGamesVisibility: 'PUBLIC',
  challengePermission: 'EVERYONE',
}

// File names recorded so far by openMockedPage's `sounds` option, in order.
export function soundsPlayed(page) {
  return page.evaluate(() => [...window.__soundsPlayed])
}

// Centre on screen of the board point (col, row) given in REAL coordinates.
// The click targets' labels ("Ô cột x hàng y") name the point by where it is
// DRAWN, so on a flipped board the real point is found under the rotated
// label — pass `flipped` there.
export async function squareCenter(page, col, row, { flipped = false } = {}) {
  const viewCol = flipped ? 8 - col : col
  const viewRow = flipped ? 9 - row : row
  const box = await page.getByRole('button', { name: `Ô cột ${viewCol + 1} hàng ${viewRow + 1}`, exact: true }).boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// A right-button drag from one board point to another (REAL coordinates)
// with the real mouse — same point twice = a right click there.
export async function rightDrag(page, [fromCol, fromRow], [toCol, toRow], { flipped = false } = {}) {
  const from = await squareCenter(page, fromCol, fromRow, { flipped })
  const to = await squareCenter(page, toCol, toRow, { flipped })
  await page.mouse.move(from.x, from.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(to.x, to.y, { steps: 4 })
  await page.mouse.up({ button: 'right' })
}

// Whether the board swallows the browser's right-click menu: dispatches a
// contextmenu event on the board and reports if the page cancelled it.
export function contextMenuBlocked(page) {
  return page.evaluate(() => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })
    document.querySelector('.board-inner').dispatchEvent(event)
    return event.defaultPrevented
  })
}

// Client-side navigation (no page load), the way an in-app link would —
// so a test can tell "took effect immediately" from "took effect after a
// reload".
export async function navigateInApp(page, path) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

// Clicks the board intersection (col, row) — the same thing a click on the
// piece or the empty point there does. The click targets are labelled by
// where they are DRAWN, which equals the real coordinates on an unflipped
// board (all callers); see squareCenter for a flipped one.
export function clickSquare(page, col, row) {
  return page.getByRole('button', { name: `Ô cột ${col + 1} hàng ${row + 1}`, exact: true }).dispatchEvent('click')
}
