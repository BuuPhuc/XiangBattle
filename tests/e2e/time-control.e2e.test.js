// Chọn thời gian, in Chrome, on a faked backend (no server, no database —
// see openMockedPage in ./browser.js):
//  - the picker on /play: 10 + 0 by default, the four presets, picking one,
//    remembered after a reload and shared with the /room page;
//  - a game against the bot has no clocks at all;
//  - "Ván đấu gần đây" names the time control each game was played at.
// The clocks of a real online game are in online-clock.e2e.test.js.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const current = (page) => page.getByTestId('time-control-current').first()
const opener = (page) => page.getByRole('button', { name: /^Thời gian:/ }).first()

test('/play: 10 + 0 by default; pick 15 + 5; remembered after a reload and on /room', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/play`)

  await current(page).waitFor()
  assert.equal(await current(page).innerText(), '10 + 0')
  assert.match(await opener(page).innerText(), /Mỗi bên có 10 phút, tối đa 2 phút cho một nước\./)
  assert.equal(await page.getByRole('radio').count(), 0, 'closed until clicked')

  await opener(page).click()
  const radios = page.getByRole('radio')
  assert.deepEqual(await radios.allInnerTexts(), ['5 phút', '10 phút', '15 phút + 5 giây', '20 phút + 5 giây'])
  assert.equal(await page.getByRole('radio', { name: '10 phút', exact: true }).getAttribute('aria-checked'), 'true')

  await page.getByRole('radio', { name: '15 phút + 5 giây', exact: true }).click()
  assert.equal(await current(page).innerText(), '15 + 5')
  assert.equal(await page.getByRole('radio', { name: '15 phút + 5 giây', exact: true }).getAttribute('aria-checked'), 'true')
  assert.equal(await page.getByRole('radio', { name: '10 phút', exact: true }).getAttribute('aria-checked'), 'false')
  assert.match(
    await opener(page).innerText(),
    /Mỗi bên có 15 phút, cộng 5 giây sau mỗi nước, tối đa 2 phút cho một nước\./
  )

  await page.reload()
  await current(page).waitFor()
  assert.equal(await current(page).innerText(), '15 + 5', 'remembered after a reload')

  await page.goto(`${app.baseUrl}/room`)
  await current(page).waitFor()
  assert.equal(await current(page).innerText(), '15 + 5', 'same choice on /room')

  // And the per-move limits of the other two presets.
  await opener(page).click()
  await page.getByRole('radio', { name: '5 phút', exact: true }).click()
  assert.match(await opener(page).innerText(), /Mỗi bên có 5 phút, tối đa 1 phút cho một nước\./)
  await page.getByRole('radio', { name: '20 phút + 5 giây', exact: true }).click()
  assert.match(await opener(page).innerText(), /Mỗi bên có 20 phút, cộng 5 giây sau mỗi nước, tối đa 5 phút cho một nước\./)
  assert.deepEqual(errors, [])
})

test('a game against the bot has no clocks', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/ai`)
  await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()
  await page.getByRole('button', { name: 'Đầu hàng' }).first().waitFor()
  assert.equal(await page.getByText('Giờ/nước').count(), 0)
  assert.equal(await page.getByText('Ván đấu', { exact: true }).count(), 0)
  assert.equal(await page.getByText(/^\d\d:\d\d$/).count(), 0, 'no mm:ss clock anywhere')
  assert.equal(await page.getByTestId('match-time-control').count(), 0)
  assert.deepEqual(errors, [])
})

test('"Ván đấu gần đây" shows each game\'s time control', async (t) => {
  const game = (gameId, initialTime, increment, opponent) => ({
    gameId,
    opponent: { id: 100 + gameId, username: opponent, displayName: null, avatarUrl: null },
    result: 'WIN',
    color: 'red',
    winner: null,
    endReason: 'CHECKMATE',
    initialTime,
    increment,
    moveCount: 30,
    startedAt: '2026-11-01T10:00:00.000Z',
    endedAt: '2026-11-01T10:20:00.000Z',
  })
  const games = [game(3, 900, 5, 'opp_fifteen'), game(2, 600, 0, 'opp_ten'), game(1, undefined, undefined, 'opp_old')]
  const ctx = await openMockedPage(app, t, { games: () => json({ success: true, games }) })
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/play`)
  const section = page.getByTestId('recent-matches')
  await section.getByText('vs opp_fifteen').waitFor()
  const rowText = async (name) => section.locator('div', { has: page.getByText(`vs ${name}`) }).last().innerText()
  assert.match(await rowText('opp_fifteen'), /15 \+ 5 · 30 nước/)
  assert.match(await rowText('opp_ten'), /10 \+ 0 · 30 nước/)
  assert.doesNotMatch(await rowText('opp_old'), /\d+ \+ \d+ ·/, 'nothing invented when the API has no time control')
  assert.deepEqual(errors, [])
})
