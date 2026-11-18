// "CHƠI NGAY" in Chrome against the REAL backend (guests only — nothing is
// written to the database): the waiting screen names the Elo it searches
// around and the range accepted so far, counts the waiting time, and a
// player arriving within range is paired straight into the game.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { openApp, closeApp, step as runStep } from './browser.js'

const require = createRequire(import.meta.url)
const { startServer, connect, firstOf } = require('../../server/tests/helpers/testServer.js')

let backend
let app
const sockets = []
before(async () => {
  backend = await startServer()
  app = await openApp({ socketUrl: backend.url })
})
after(async () => {
  sockets.forEach((s) => s.close())
  await closeApp(app)
  await backend?.stop()
})

test('waiting screen shows the Elo range and time; a guest in range is paired', async (t) => {
  await runStep(app, t, async (page) => {
    await page.goto(`${app.baseUrl}/room?mode=quick`)
    const status = page.getByTestId('quick-play-search')
    await status.waitFor()
    const text = await status.innerText()
    assert.match(text, /Đang tìm đối thủ quanh 1200 Elo \(1100–1300\)/)
    assert.match(text, /Đã chờ 0:0\d/)
    await page.getByText(/Đã chờ 0:0[2-9]/).waitFor({ timeout: 5000 }) // the clock ticks

    const other = await connect(backend.url, {})
    sockets.push(other)
    const found = firstOf(other, ['match_found', 'quick_play_queued'], 3000)
    other.emit('quick_play', { playerId: `test-e2e-qp-${Date.now()}` })
    const reply = await found
    assert.equal(reply?.event, 'match_found', 'a 1200 guest should be paired at once')
    assert.equal(reply.payload.you.color, 'black', 'the one who waited longer plays Red')

    await page.getByTestId('match-time-control').waitFor()
    assert.equal(await status.count(), 0)

    // Leave cleanly (resign), so nothing lingers for other tests.
    await page.getByRole('button', { name: 'Đầu hàng' }).first().click()
    await page.getByRole('button', { name: 'Đầu hàng' }).last().click()
    await page.getByText(/đầu hàng/i).first().waitFor()
  })
})
