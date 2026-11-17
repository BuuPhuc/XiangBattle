// Leaving a game in progress asks first, in Chrome.
//  - vs the bot (no backend): any sidebar link opens "Bạn có muốn thoát…";
//    "Ở lại" keeps the game, "Thoát" goes; a finished game never asks;
//  - online (the REAL backend, guests only — nothing written to the
//    database): "Thoát và chịu thua" resigns (the opponent is told it won),
//    leaves the room, and coming back to /room starts fresh.
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

const step = (t, fn) => runStep(app, t, fn)
const sidebarLink = (page, label) => page.locator('aside').getByRole('link', { name: label }).first()
const dialog = (page) => page.getByRole('dialog')

test('vs the bot: a sidebar link asks first; "Ở lại" stays, "Thoát" leaves', async (t) => {
  await step(t, async (page) => {
    await page.goto(`${app.baseUrl}/ai`)
    await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()
    await page.getByRole('button', { name: 'Đầu hàng' }).first().waitFor()

    await sidebarLink(page, 'Cờ thế').click()
    await dialog(page).waitFor()
    assert.match(await dialog(page).innerText(), /Bạn có muốn thoát khỏi ván đấu với máy không\?/)
    assert.match(await dialog(page).innerText(), /không được lưu/)

    await dialog(page).getByRole('button', { name: 'Ở lại' }).click()
    await dialog(page).waitFor({ state: 'detached' })
    assert.match(page.url(), /\/ai$/)
    assert.equal(await page.getByRole('button', { name: 'Đầu hàng' }).first().isEnabled(), true, 'the game goes on')

    await sidebarLink(page, 'Cờ thế').click()
    await dialog(page).getByRole('button', { name: 'Thoát', exact: true }).click()
    await page.waitForURL(/\/puzzles$/)
  })
})

test('vs the bot: once the game is over, nothing asks', async (t) => {
  await step(t, async (page) => {
    await page.goto(`${app.baseUrl}/ai`)
    await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()
    await page.getByRole('button', { name: 'Đầu hàng' }).first().click()
    await page.getByRole('button', { name: 'Đầu hàng' }).last().click()
    await page.getByText('Bạn đã đầu hàng!').waitFor()
    await page.getByRole('button', { name: 'Đóng' }).click() // the result dialog
    await sidebarLink(page, 'Cờ thế').click()
    await page.waitForURL(/\/puzzles$/)
    assert.equal(await dialog(page).count(), 0)
  })
})

test('online: "Thoát và chịu thua" resigns, leaves the room, and /room starts fresh', async (t) => {
  await step(t, async (page) => {
    await page.goto(`${app.baseUrl}/room`)
    await page.getByRole('button', { name: 'Tạo phòng', exact: true }).click()
    await page.getByText('Đang chờ đối thủ...').waitFor()
    const code = (await page.locator('.tracking-\\[0\\.3em\\]').first().innerText()).trim()

    const black = await connect(backend.url, {})
    sockets.push(black)
    const started = firstOf(black, ['game_started'])
    black.emit('join_room', { roomId: code, playerId: `test-e2e-leave-${Date.now()}` })
    assert.ok(await started, 'game did not start')
    await page.getByTestId('match-time-control').waitFor()

    // "Ở lại": nothing happens to the match.
    const noResult = firstOf(black, ['game_over'], 800)
    await sidebarLink(page, 'Bảng xếp hạng').click()
    await dialog(page).waitFor()
    const text = await dialog(page).innerText()
    assert.match(text, /Bạn có muốn thoát khỏi trận đấu không\?/)
    assert.match(text, /bạn sẽ bị xử thua/)
    await dialog(page).getByRole('button', { name: 'Ở lại' }).click()
    await dialog(page).waitFor({ state: 'detached' })
    assert.equal(await noResult, null, 'staying must not end the match')
    assert.match(page.url(), /\/room$/)

    // "Thoát và chịu thua": black is told it won by resignation.
    const over = firstOf(black, ['game_over'])
    await sidebarLink(page, 'Cờ thế').click()
    await dialog(page).getByRole('button', { name: 'Thoát và chịu thua' }).click()
    const result = await over
    assert.ok(result, 'the opponent was not told the match ended')
    assert.deepEqual(
      { status: result.payload.status, winner: result.payload.winner },
      { status: 'resign', winner: 'black' }
    )
    await page.waitForURL(/\/puzzles$/)

    // Back to "Chơi cờ" → /room: the chooser, not the lost match.
    await page.goto(`${app.baseUrl}/room`)
    await page.getByRole('button', { name: 'Tạo phòng', exact: true }).waitFor()
    assert.equal(await page.getByTestId('match-time-control').count(), 0)
  })
})
