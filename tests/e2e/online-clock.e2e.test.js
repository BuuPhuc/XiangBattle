// An online game's clock, in Chrome, against the REAL backend (started like
// the server tests do — server/tests/helpers/testServer.js). The player in
// Chrome is a guest who creates a room at 15 + 5; the opponent is a plain
// socket.io guest client. Guests only: nothing is written to the database.
//
// Covers: the waiting room names the time control, the match starts on a
// 15:00 / 02:00 clock with "Ván 15 + 5 · tối đa 2 phút/nước" shown, and
// moving earns the 5 seconds back — on the server and on the Chrome clock.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { openApp, closeApp, step as runStep, squareCenter } from './browser.js'

const HISTORY_ENTRY = /^[A-Za-z]{1,2}\d[.\-/]\d$/ // e.g. "P2-5", "M8.7" (as in play-ai.e2e.test.js)
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

// The mm:ss strings currently shown for one side's PlayerCard, found by the
// "Giờ/nước" / "Ván đấu" labels under them: { move, game }.
async function clocks(page, which) {
  const cards = page.locator('.glass-panel', { has: page.getByText('Giờ/nước') })
  const card = which === 'top' ? cards.first() : cards.last()
  const [move, game] = await card.locator('.font-mono').allInnerTexts()
  return { move, game }
}

test('a 15 + 5 room: shown before and during the game, and moving earns 5 seconds', async (t) => {
  await step(t, async (page) => {
    await page.goto(`${app.baseUrl}/room`)
    await page.getByRole('button', { name: /^Thời gian:/ }).click()
    await page.getByRole('radio', { name: '15 phút + 5 giây', exact: true }).click()
    await page.getByRole('button', { name: 'Tạo phòng', exact: true }).click()

    // Waiting room: the code and the time control.
    await page.getByText('Ván 15 + 5').waitFor()
    const code = (await page.locator('.tracking-\\[0\\.3em\\]').first().innerText()).trim()
    assert.match(code, /^[A-Z0-9]{4,6}$/)

    // The opponent (black) joins with the code.
    const black = await connect(backend.url, {})
    sockets.push(black)
    const started = firstOf(black, ['game_started', 'room_error'])
    black.emit('join_room', { roomId: code, playerId: `test-e2e-black-${Date.now()}` })
    const { event, payload } = await started
    assert.equal(event, 'game_started')
    assert.equal(payload.timeControl.id, '15+5')

    // Chrome is red, at the bottom; nobody has moved yet.
    await page.getByTestId('match-time-control').waitFor()
    assert.match(await page.getByTestId('match-time-control').innerText(), /Ván 15 \+ 5 · tối đa 2 phút\/nước/)
    assert.equal((await clocks(page, 'top')).game, '15:00', 'black starts on 15:00')
    assert.equal((await clocks(page, 'top')).move, '02:00')

    // Red plays cannon 2 to the centre (P2-5).
    const blackSeesMove = firstOf(black, ['move_made'])
    await page.mouse.click(...Object.values(await squareCenter(page, 7, 7)))
    await page.mouse.click(...Object.values(await squareCenter(page, 4, 7)))
    const made = await blackSeesMove
    assert.ok(made, 'the move did not reach the opponent')
    assert.equal(made.payload.move.notation, 'P2-5')

    // Red took well under 5 s, so with the +5 its clock is above 15:00.
    const red = await clocks(page, 'bottom')
    assert.match(red.game, /^15:0[1-5]$/, `red's clock after moving: ${red.game}`)

    // Black replies (horse 2 forward). Its clock had been running down from
    // 15:00, and gets its own +5 — so it lands just above 15:00 too.
    black.emit('make_move', { move: { from: { col: 1, row: 0 }, to: { col: 2, row: 2 } } })
    await page.waitForFunction(
      (pattern) => [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && new RegExp(pattern).test(el.textContent.trim())).length >= 2,
      HISTORY_ENTRY.source
    )
    const blackClock = await clocks(page, 'top')
    assert.match(blackClock.game, /^15:0[1-5]$/, `black's clock after replying: ${blackClock.game}`)
    assert.equal(blackClock.move, '02:00', "black's move clock is reset once its turn ends")
    assert.match((await clocks(page, 'bottom')).game, /^15:0[1-5]$/, "red's clock is running again from where it was")
  })
})
