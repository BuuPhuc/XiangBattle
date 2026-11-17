// An online game's clock, in Chrome, against the REAL backend (started like
// the server tests do — server/tests/helpers/testServer.js). The player in
// Chrome is a guest who creates a room at 15 + 5; the opponent is a plain
// socket.io guest client. Guests only: nothing is written to the database.
//
// Covers: the waiting room names the time control, the match starts on a
// 15:00 / 02:00 clock with "Ván 15 + 5 · tối đa 2 phút/nước" shown, and
// each side's clock jumps by about +5 s when it moves.
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

// "14:57" → 897
const seconds = (mmss) => {
  const [m, s] = mmss.split(':').map(Number)
  return m * 60 + s
}

// One side's game clock (seconds) once it shows more than `from` (the +5
// landing) — the page redraws a moment after the move, so a read straight
// away can still show the old, ticking-down value. Gives up after 3 s and
// returns whatever it shows then.
async function clockAbove(page, which, from) {
  const until = Date.now() + 3000
  let value = seconds((await clocks(page, which)).game)
  while (value <= from && Date.now() < until) {
    await page.waitForTimeout(100)
    value = seconds((await clocks(page, which)).game)
  }
  return value
}

// +5 for the move, minus the second or two the move itself took between
// reading the clock and the turn passing (the display shows whole seconds).
function assertGained(gain, what) {
  assert.ok(gain >= 3 && gain <= 6, `${what} should jump by about +5 s, moved by ${gain} s`)
}

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

    // Red plays cannon 2 to the centre (P2-5). Its clock is read just before:
    // whatever time the move took (a second or two), the +5 must show as a
    // jump of about 5 seconds the moment the turn passes — not a fixed
    // "15:0x", which depends on how fast this machine got here.
    const redBefore = seconds((await clocks(page, 'bottom')).game)
    const blackSeesMove = firstOf(black, ['move_made'])
    await page.mouse.click(...Object.values(await squareCenter(page, 7, 7)))
    await page.mouse.click(...Object.values(await squareCenter(page, 4, 7)))
    const made = await blackSeesMove
    assert.ok(made, 'the move did not reach the opponent')
    assert.equal(made.payload.move.notation, 'P2-5')

    const redAfter = await clockAbove(page, 'bottom', redBefore)
    assertGained(redAfter - redBefore, "red's clock")

    // Black replies (horse 2 forward) and gets its own +5.
    const blackBefore = seconds((await clocks(page, 'top')).game)
    black.emit('make_move', { move: { from: { col: 1, row: 0 }, to: { col: 2, row: 2 } } })
    await page.waitForFunction(
      (pattern) =>
        [...document.querySelectorAll('body *')].filter(
          (el) => el.children.length === 0 && new RegExp(pattern).test(el.textContent.trim())
        ).length >= 2,
      HISTORY_ENTRY.source
    )
    const blackAfter = await clockAbove(page, 'top', blackBefore)
    assertGained(blackAfter - blackBefore, "black's clock")
    const blackClock = await clocks(page, 'top')
    assert.equal(blackClock.move, '02:00', "black's move clock is reset once its turn ends")
    const redNow = seconds((await clocks(page, 'bottom')).game)
    assert.ok(redNow <= redAfter && redNow >= redAfter - 2, `red's clock runs on from ${redAfter}s (now ${redNow}s)`)
  })
})
