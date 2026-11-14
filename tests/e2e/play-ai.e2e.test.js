// Plays the real "Đối đầu AI" page in Chrome, the way a person would
// (Vite + Chrome setup in ./browser.js; skipped without Chrome).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, step as runStep } from './browser.js'

const HISTORY_ENTRY = /^[A-Za-z]{1,2}\d[.\-/]\d$/ // e.g. "P2-5", "Tg5.1", "X1/1"

let app
let page
// Bot Web Workers seen (started / closed), and every move this test made
// itself — reported only when something times out (see diagnostics()).
const workers = { started: 0, closed: 0 }
const myMoves = []
before(async () => {
  app = await openApp()
  page = app.page
  page?.on('worker', (worker) => {
    workers.started += 1
    worker.on('close', () => {
      workers.closed += 1
    })
  })
})
after(() => closeApp(app))

const step = (t, fn) => runStep(app, t, fn)
const historyCount = () => page.locator(`text=${HISTORY_ENTRY}`).count()
const selectedCount = () => page.locator('.piece.selected').count()

// What the page looked like when a wait failed — so a rare failure says
// whether the game had ended (and how), the bot was still thinking, its
// worker died, or the page threw. (step() in ./browser.js already saves a
// screenshot of every failure.)
async function diagnostics(label) {
  const texts = async (locator) =>
    (await locator.allInnerTexts().catch(() => [])).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const history = await texts(page.locator(`text=${HISTORY_ENTRY}`))
  return [
    `--- play-ai diagnostics: ${label} ---`,
    `turn status: ${JSON.stringify(await texts(page.locator('[role="status"]')))}`,
    `overlays / result dialog: ${JSON.stringify((await texts(page.locator('.fixed.inset-0'))).map((s) => s.slice(0, 300)))}`,
    `Đầu hàng enabled: ${await page.getByRole('button', { name: 'Đầu hàng' }).first().isEnabled().catch(() => 'n/a')}`,
    `move history (${history.length}): ${history.join(' ')}`,
    `moves this test made: ${myMoves.join(', ') || '(none)'}`,
    `bot workers: started ${workers.started}, closed ${workers.closed}`,
    `page errors: ${JSON.stringify(app.pageErrors)}`,
  ].join('\n')
}

// Waits for `text`; on a timeout, fails with diagnostics() attached.
async function waitForText(text, timeout, label) {
  const started = Date.now()
  try {
    await page.getByText(text).first().waitFor({ timeout })
  } catch (error) {
    const waited = Date.now() - started
    throw new Error(`${label}: "${text}" not shown after ${waited} ms\n${await diagnostics(label)}`, { cause: error })
  }
}
const waitForMyTurn = (timeout, label) => waitForText('Đến lượt bạn', timeout, label)
const waitForBotThinking = (timeout, label) => waitForText(/đang suy nghĩ/, timeout, label)

test('setup screen, then the bot (Red) opens while I play Black', (t) =>
  step(t, async () => {
    await page.goto(`${app.baseUrl}/ai`)
    await page.getByText('Đối đầu với máy').waitFor()
    await page.getByRole('button', { name: /^Dễ/ }).click()
    await page.getByRole('button', { name: /Cầm Đen/ }).click()
    await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()

    await waitForBotThinking(3000, 'bot opening move')
    // My piece can't be picked up while the bot is thinking.
    await page.locator('.piece.black', { hasText: '卒' }).first().click({ force: true })
    assert.equal(await selectedCount(), 0, 'selected a piece during the bot turn')

    await waitForMyTurn(6000, 'after the bot opening move')
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
      await waitForMyTurn(8000, `before my move ${i + 1}`)
      const pieces = page.locator('.piece.black')
      const n = await pieces.count()
      let moved = false
      for (let k = 0; k < n && !moved; k++) {
        const piece = pieces.nth((k + i * 3) % n)
        await piece.click()
        const markers = page.locator('.move-marker')
        if ((await markers.count()) > 0) {
          myMoves.push(`#${i + 1} ${await piece.innerText()}`)
          const box = await markers.first().boundingBox()
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
          moved = true
        }
      }
      assert.ok(moved, `found no legal move at turn ${i + 1}`)
      played++
      await waitForBotThinking(3000, `bot reply to my move ${i + 1}`)
      await page.locator('.piece.black').first().click({ force: true })
      assert.equal(await selectedCount(), 0, `selected a piece during bot turn ${i + 1}`)
    }
    await waitForMyTurn(8000, 'after the last bot reply')
    assert.equal(await historyCount(), 1 + played * 2, 'history should list every move of both sides')
  }))

test('resign ends the game, with no rating change shown', (t) =>
  step(t, async () => {
    const resign = page.getByRole('button', { name: 'Đầu hàng' }).first()
    if (!(await resign.isEnabled())) {
      throw new Error(`"Đầu hàng" is disabled — the game is not in progress\n${await diagnostics('before resigning')}`)
    }
    await resign.click()
    await page.getByText('Bạn có chắc muốn đầu hàng?').waitFor()
    await page.getByRole('button', { name: 'Đầu hàng' }).last().click()
    await page.getByText('Bạn đã đầu hàng!').waitFor({ timeout: 3000 })
    assert.equal(await page.getByText(/Rating/).count(), 0)
  }))

test('"Chơi lại" in the result dialog restarts the game', (t) =>
  step(t, async () => {
    await page.getByRole('button', { name: /Chơi lại/ }).last().click()
    await waitForBotThinking(3000, 'Chơi lại: bot opening move')
    await waitForMyTurn(6000, 'Chơi lại: after the bot opening move')
    assert.equal(await historyCount(), 1, 'only the bot opening move should remain')
  }))

test('"Ván mới" goes back to setup; as Red I move first with Red at the bottom', (t) =>
  step(t, async () => {
    await page.getByRole('button', { name: /Ván mới/ }).click()
    await page.getByText('Đối đầu với máy').waitFor()
    await page.getByRole('button', { name: /Cầm Đỏ/ }).click()
    await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()
    await waitForMyTurn(3000, 'Ván mới as Red')
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
    await waitForBotThinking(30000, 'Khó: bot opening move')
    const frameStart = Date.now()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())))
    const frameMs = Date.now() - frameStart
    await waitForMyTurn(10000, 'Khó: after the bot opening move')
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
