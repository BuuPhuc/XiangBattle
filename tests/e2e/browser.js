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

// Clicks the board intersection (col, row) in REAL board coordinates — the
// same thing a click on the piece or the empty point there does.
export function clickSquare(page, col, row) {
  return page.getByRole('button', { name: `Ô cột ${col + 1} hàng ${row + 1}`, exact: true }).dispatchEvent('click')
}
