// "Xem ván đang diễn ra" in Chrome against the REAL backend (guests and a
// made-up account id only — nothing is written to the database):
//  - a guest finds a running game on /live, opens it, sees the moves so far
//    and every new one, cannot move a piece, reads the spectators' chat but
//    can't write in it, sees the eye "Đang xem (n)" open on hover with who
//    is watching, and sees the result;
//  - a player sees the eye too, with the count and names live.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
import { openApp, closeApp, step as runStep, clickSquare } from './browser.js'

const require = createRequire(import.meta.url)
const { SERVER_DIR, startServer, connect, firstOf } = require('../../server/tests/helpers/testServer.js')
require(path.join(SERVER_DIR, 'node_modules', 'dotenv')).config({ path: path.join(SERVER_DIR, '.env'), quiet: true })
const { signAccessToken } = require('../../server/utils/token.js')

const VIEWER = { id: 900021, username: 'e2e_watcher' }
const guestId = (tag) => `test-e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

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

async function client(user) {
  const socket = await connect(backend.url, user ? { token: signAccessToken(user) } : {})
  sockets.push(socket)
  return socket
}

// Two guest sockets playing; returns them, the room code and red's first
// move's notation.
async function runningGame() {
  const red = await client()
  const black = await client()
  const created = firstOf(red, ['room_created'])
  red.emit('create_room', { playerId: guestId('red') })
  const roomId = (await created).payload.roomId
  const started = firstOf(black, ['game_started'])
  black.emit('join_room', { roomId, playerId: guestId('black') })
  assert.ok(await started, 'game did not start')
  const relayed = firstOf(black, ['move_made'])
  red.emit('make_move', { move: { from: { col: 1, row: 7 }, to: { col: 4, row: 7 } } })
  const first = await relayed
  assert.ok(first, 'first move not played')
  return { red, black, roomId, firstNotation: first.payload.move.notation }
}

test('a guest watches a game from /live: moves, read-only board, spectator chat, eye, result', async (t) => {
  const { red, black, roomId, firstNotation } = await runningGame()

  await step(t, async (page) => {
    await page.goto(`${app.baseUrl}/live`)
    const list = page.getByTestId('live-games')
    await list.waitFor()
    const row = list.locator('li', { has: page.locator(`a[href="/watch/${roomId}"]`) })
    await row.waitFor()
    assert.match(await row.innerText(), /Khách \(Đỏ\)/)
    assert.match(await row.innerText(), /1 nước/)
    await row.getByRole('link', { name: 'Xem' }).click()
    await page.waitForURL(new RegExp(`/watch/${roomId}$`))

    await page.getByTestId('watch-banner').waitFor()
    await page.getByRole('button', { name: firstNotation }).waitFor()

    // The eye: shut, "Đang xem (1)"; pointing at it opens it and the list.
    const eye = page.getByTestId('spectator-eye')
    await eye.getByText('Đang xem (1)').waitFor()
    const eyeButton = eye.getByRole('button')
    assert.equal(await eyeButton.getAttribute('aria-expanded'), 'false')
    assert.doesNotMatch((await eyeButton.getAttribute('class')) ?? '', /is-open/)
    await eyeButton.hover()
    assert.equal(await eyeButton.getAttribute('aria-expanded'), 'true')
    assert.match((await eyeButton.getAttribute('class')) ?? '', /is-open/)
    const people = page.getByRole('dialog', { name: 'Người đang xem' })
    assert.match(await people.innerText(), /1 khách/)
    await page.mouse.move(5, 5)
    await people.waitFor({ state: 'detached' })

    // A new move shows up.
    const second = firstOf(red, ['move_made'])
    black.emit('make_move', { move: { from: { col: 1, row: 0 }, to: { col: 2, row: 2 } } })
    const secondMove = await second
    assert.ok(secondMove)
    await page.getByRole('button', { name: secondMove.payload.move.notation }).waitFor()

    // Read-only: clicking red's pieces (red to move) sends nothing.
    const nothing = firstOf(black, ['move_made'], 800)
    await clickSquare(page, 0, 9)
    await clickSquare(page, 0, 8)
    assert.equal(await nothing, null, 'a spectator moved a piece')

    // Spectator chat: a guest reads along, but writes nothing.
    await page.getByRole('button', { name: /Khán giả/ }).click()
    await page.getByText('để trò chuyện cùng khán giả.').waitFor()
    assert.equal(await page.getByPlaceholder(/tin nhắn/i).count(), 0, 'a guest got a chat input')

    const account = await client(VIEWER)
    const watched = firstOf(account, ['spectate:state'])
    account.emit('watch_room', { roomId })
    assert.ok(await watched)
    await eye.getByText('Đang xem (2)').waitFor()
    account.emit('spectate:chat_send', { message: 'Pháo đầu đẹp quá!' })
    await page.getByText('Pháo đầu đẹp quá!').waitFor()
    assert.match(await page.locator('body').innerText(), new RegExp(VIEWER.username))

    await eyeButton.hover()
    assert.match(await people.innerText(), new RegExp(VIEWER.username))
    await page.mouse.move(5, 5)

    // The result.
    red.emit('resign')
    const banner = page.getByTestId('watch-result')
    await banner.waitFor()
    assert.match(await banner.innerText(), /Khách \(Đen\) thắng — đối phương đầu hàng/)
    assert.equal(await page.getByRole('link', { name: 'Xem ván khác' }).count(), 1)
  })
})

test('a player sees who is watching, live', async (t) => {
  await step(t, async (page) => {
    await page.goto(`${app.baseUrl}/room`)
    await page.getByRole('button', { name: 'Tạo phòng', exact: true }).click()
    await page.getByText('Đang chờ đối thủ...').waitFor()
    const code = (await page.locator('.tracking-\\[0\\.3em\\]').first().innerText()).trim()

    const black = await client()
    const started = firstOf(black, ['game_started'])
    black.emit('join_room', { roomId: code, playerId: guestId('black') })
    assert.ok(await started)

    const eye = page.getByTestId('spectator-eye')
    await eye.getByText('Đang xem (0)').waitFor()
    assert.match(await page.getByTestId('match-time-control').innerText(), /Ván 10 \+ 0 · tối đa 2 phút\/nước/)

    const account = await client(VIEWER)
    account.emit('watch_room', { roomId: code })
    const guest = await client()
    guest.emit('watch_room', { roomId: code, playerId: guestId('viewer') })
    await eye.getByText('Đang xem (2)').waitFor()

    // Tapping pins the list open; it names the account, counts the guest.
    await eye.getByRole('button').click()
    const people = page.getByRole('dialog', { name: 'Người đang xem' })
    await people.waitFor()
    const text = await people.innerText()
    assert.match(text, new RegExp(VIEWER.username))
    assert.match(text, /\+1/)

    guest.emit('unwatch_room')
    await eye.getByText('Đang xem (1)').waitFor()

    // Done: resign, so the next test's sidebar isn't blocked by the guard.
    await page.getByRole('button', { name: 'Đầu hàng' }).first().click()
    await page.getByRole('button', { name: 'Đầu hàng' }).last().click()
    await page.getByText(/đầu hàng/i).first().waitFor()
  })
})
