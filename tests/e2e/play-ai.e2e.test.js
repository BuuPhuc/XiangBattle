// Plays the real "Đối đầu AI" page in Chrome, the way a person would
// (Vite + Chrome setup in ./browser.js; skipped without Chrome).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, step as runStep } from './browser.js'

const HISTORY_ENTRY = /^[A-Za-z]{1,2}\d[.\-/]\d$/ // e.g. "P2-5", "Tg5.1", "X1/1"

let app
let page
before(async () => {
  app = await openApp()
  page = app.page
})
after(() => closeApp(app))

const step = (t, fn) => runStep(app, t, fn)
const historyCount = () => page.locator(`text=${HISTORY_ENTRY}`).count()
const selectedCount = () => page.locator('.piece.selected').count()

test('setup screen, then the bot (Red) opens while I play Black', (t) =>
  step(t, async () => {
    await page.goto(`${app.baseUrl}/ai`)
    await page.getByText('Đối đầu với máy').waitFor()
    await page.getByRole('button', { name: /^Dễ/ }).click()
    await page.getByRole('button', { name: /Cầm Đen/ }).click()
    await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()

    await page.getByText(/đang suy nghĩ/).waitFor({ timeout: 3000 })
    // My piece can't be picked up while the bot is thinking.
    await page.locator('.piece.black', { hasText: '卒' }).first().click({ force: true })
    assert.equal(await selectedCount(), 0, 'selected a piece during the bot turn')

    await page.getByText('Đến lượt bạn').waitFor({ timeout: 6000 })
    assert.equal(await historyCount(), 1, 'expected exactly the bot opening move in history')
  }))

test('board is turned for Black: my general at the bottom', (t) =>
  step(t, async () => {
    const mine = await page.locator('.piece.black', { hasText: '將' }).boundingBox()
    const bots = await page.locator('.piece.red', { hasText: '帥' }).boundingBox()
    assert.ok(mine.y > bots.y)
  }))

test('play several moves; input is blocked every time it is the bot turn', (t) =>
  step(t, async () => {
    let played = 0
    for (let i = 0; i < 6; i++) {
      await page.getByText('Đến lượt bạn').waitFor({ timeout: 8000 })
      const pieces = page.locator('.piece.black')
      const n = await pieces.count()
      let moved = false
      for (let k = 0; k < n && !moved; k++) {
        await pieces.nth((k + i * 3) % n).click()
        const markers = page.locator('.move-marker')
        if ((await markers.count()) > 0) {
          const box = await markers.first().boundingBox()
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
          moved = true
        }
      }
      assert.ok(moved, `found no legal move at turn ${i + 1}`)
      played++
      await page.getByText(/đang suy nghĩ/).waitFor({ timeout: 3000 })
      await page.locator('.piece.black').first().click({ force: true })
      assert.equal(await selectedCount(), 0, `selected a piece during bot turn ${i + 1}`)
    }
    await page.getByText('Đến lượt bạn').waitFor({ timeout: 8000 })
    assert.equal(await historyCount(), 1 + played * 2, 'history should list every move of both sides')
  }))

test('resign ends the game, with no rating change shown', (t) =>
  step(t, async () => {
    await page.getByRole('button', { name: 'Đầu hàng' }).first().click()
    await page.getByText('Bạn có chắc muốn đầu hàng?').waitFor()
    await page.getByRole('button', { name: 'Đầu hàng' }).last().click()
    await page.getByText('Bạn đã đầu hàng!').waitFor({ timeout: 3000 })
    assert.equal(await page.getByText(/Rating/).count(), 0)
  }))

test('"Chơi lại" in the result dialog restarts the game', (t) =>
  step(t, async () => {
    await page.getByRole('button', { name: /Chơi lại/ }).last().click()
    await page.getByText(/đang suy nghĩ/).waitFor({ timeout: 3000 })
    await page.getByText('Đến lượt bạn').waitFor({ timeout: 6000 })
    assert.equal(await historyCount(), 1, 'only the bot opening move should remain')
  }))

test('"Ván mới" goes back to setup; as Red I move first with Red at the bottom', (t) =>
  step(t, async () => {
    await page.getByRole('button', { name: /Ván mới/ }).click()
    await page.getByText('Đối đầu với máy').waitFor()
    await page.getByRole('button', { name: /Cầm Đỏ/ }).click()
    await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()
    await page.getByText('Đến lượt bạn').waitFor({ timeout: 3000 })
    const red = await page.locator('.piece.red', { hasText: '帥' }).boundingBox()
    const black = await page.locator('.piece.black', { hasText: '將' }).boundingBox()
    assert.ok(red.y > black.y)
    assert.equal(await historyCount(), 0)
  }))

test('Khó: answers within its budget and the page stays responsive while it thinks', (t) =>
  step(t, async () => {
    await page.getByRole('button', { name: /Ván mới/ }).click()
    await page.getByRole('button', { name: /^Khó/ }).click()
    await page.getByRole('button', { name: /Cầm Đen/ }).click()
    const started = Date.now()
    await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()
    await page.getByText(/đang suy nghĩ/).waitFor()
    const frameStart = Date.now()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())))
    const frameMs = Date.now() - frameStart
    await page.getByText('Đến lượt bạn').waitFor({ timeout: 10000 })
    const thinkMs = Date.now() - started
    t.diagnostic(`Khó answered in ${thinkMs} ms; one frame during thinking took ${frameMs} ms`)
    assert.ok(thinkMs < 3000 + 2000, `bot took ${thinkMs} ms`)
    assert.ok(frameMs < 500, `UI blocked for ${frameMs} ms while the bot was thinking`)
  }))

test('bot games never call the game / rating / profile APIs, and the page logged no errors', (t) =>
  step(t, async () => {
    assert.deepEqual(app.apiCalls, [])
    assert.deepEqual(app.pageErrors, [])
  }))
