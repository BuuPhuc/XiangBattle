// "Tính Elo" vs "Giao hữu" in Chrome — only Quick Play is rated:
//  - mocked API: a friend challenge is sent at the time control picked from
//    the Thách đấu menu (which says it is friendly), and an open challenge
//    shows its clock; a friendly game in Recent matches is marked;
//  - REAL backend (guests only, nothing written to the database): a "Tạo
//    phòng" room says it is friendly before and during the match, and its
//    result shows "Ván giao hữu — không tính Elo".
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { openApp, closeApp, openMockedPage, step as runStep, json } from './browser.js'

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

const FRIEND = { id: 201, username: 'ban_cu', displayName: null, avatarUrl: null, rating: 1300, online: true }

// The Friends page with one friend; `pending` answers GET /challenges/pending
// and every POST /challenges body is logged in `sent`.
async function openFriends(t, { pending = { sent: [], received: [] } } = {}) {
  const ctx = await openMockedPage(app, t)
  if (!ctx) return null
  const { page } = ctx
  const sent = []
  await page.route(/\/api\/friends(\?|$)/, (route) => route.fulfill(json({ success: true, friends: [FRIEND] })))
  await page.route(/\/api\/friends\/requests\/(received|sent)(\?|$)/, (route) => route.fulfill(json({ success: true, requests: [] })))
  await page.route(/\/api\/challenges/, (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      const body = request.postDataJSON()
      sent.push(body)
      return route.fulfill(
        json(
          {
            success: true,
            challenge: { id: 9, senderId: 7, receiverId: body.receiverId, status: 'PENDING', timeControlId: body.timeControl },
          },
          201
        )
      )
    }
    return route.fulfill(json({ success: true, ...pending }))
  })
  await page.goto(`${app.baseUrl}/friends`)
  await page.getByText('ban_cu', { exact: true }).waitFor()
  return { ...ctx, sent }
}

test('Thách đấu: pick a time control from the menu; it is sent and shown while waiting', async (t) => {
  const ctx = await openFriends(t)
  if (!ctx) return
  const { page, sent } = ctx

  await page.getByRole('button', { name: 'Thách đấu' }).click()
  const menu = page.getByRole('menu', { name: 'Chọn thời gian ván' })
  await menu.waitFor()
  assert.match(await menu.innerText(), /giao hữu — không tính Elo/)
  const items = await menu.getByRole('menuitem').allInnerTexts()
  assert.equal(items.length, 4)
  // Nothing on the page may cover or clip the menu (it was once drawn inside
  // the list's overflow-hidden card): the topmost element at the middle of
  // every option is that option.
  const covered = await menu.getByRole('menuitem').evaluateAll((options) =>
    options
      .filter((option) => {
        const r = option.getBoundingClientRect()
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return !top || !option.contains(top)
      })
      .map((option) => option.innerText)
  )
  assert.deepEqual(covered, [], 'some time controls in the menu are hidden behind the page')
  assert.ok(items.some((text) => /20 \+ 5/.test(text)))

  await menu.getByRole('menuitem').filter({ hasText: '20 + 5' }).click()
  await page.getByRole('button', { name: /Đang chờ\.\.\. \(Ván 20 \+ 5\)/ }).waitFor()
  assert.deepEqual(sent, [{ receiverId: 201, timeControl: '20+5' }])
})

test('a received challenge shows its clock and that it is friendly', async (t) => {
  const ctx = await openFriends(t, { pending: { sent: [], received: [{ id: 77, userId: 201, timeControlId: '15+5' }] } })
  if (!ctx) return
  const { page } = ctx
  await page.getByTestId('challenge-clock').waitFor()
  assert.equal(await page.getByTestId('challenge-clock').innerText(), 'Ván 15 + 5 · Giao hữu')
  await page.getByRole('button', { name: /Nhận thách đấu/ }).waitFor()
})

test('Recent matches marks a friendly game "Giao hữu", not a rated one', async (t) => {
  const game = (gameId, rated) => ({
    gameId,
    rated,
    opponent: { id: 300 + gameId, username: `opp_${gameId}`, displayName: null, avatarUrl: null },
    result: 'WIN',
    color: 'red',
    winner: null,
    endReason: 'CHECKMATE',
    initialTime: 600,
    increment: 0,
    moveCount: 30,
    startedAt: '2026-11-01T10:00:00.000Z',
    endedAt: '2026-11-01T10:20:00.000Z',
  })
  const ctx = await openMockedPage(app, t, { games: () => json({ success: true, games: [game(2, false), game(1, true)] }) })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/play`)
  const list = page.getByTestId('recent-matches')
  await list.getByText('vs opp_2').waitFor()
  assert.equal(await list.getByTestId('rated-badge').count(), 1, 'only the friendly game is marked')
  assert.match(await list.getByTestId('rated-badge').innerText(), /Giao hữu/)
})

test('"Tạo phòng" is friendly: the note, the badge in the match, and the result', async (t) => {
  await runStep(app, t, async (page) => {
    await page.goto(`${app.baseUrl}/room`)
    assert.match(await page.getByTestId('room-friendly-note').innerText(), /không tính Elo/)
    await page.getByRole('button', { name: 'Tạo phòng', exact: true }).click()
    await page.getByText('Đang chờ đối thủ...').waitFor()
    const code = (await page.locator('.tracking-\\[0\\.3em\\]').first().innerText()).trim()

    const black = await connect(backend.url, {})
    sockets.push(black)
    const started = firstOf(black, ['game_started'])
    black.emit('join_room', { roomId: code, playerId: `test-e2e-friendly-${Date.now()}` })
    assert.equal((await started)?.payload.rated, false)

    const badge = page.getByTestId('rated-badge')
    await badge.waitFor()
    assert.match(await badge.innerText(), /Giao hữu/)

    black.emit('resign')
    await page.getByTestId('friendly-result').waitFor()
    assert.match(await page.getByTestId('friendly-result').innerText(), /Ván giao hữu — không tính Elo/)
    assert.equal(await page.getByText(/Rating:/).count(), 0, 'a friendly game shows no rating change')
  })
})
