// Repetition in the browser (local game at /game, both sides played from
// one screen — the same useGame logic bot games use): the result dialog
// appears once, with the right heading, and the board locks.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, step, clickSquare } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

async function move(page, [fromCol, fromRow, toCol, toRow]) {
  await clickSquare(page, fromCol, fromRow)
  await clickSquare(page, toCol, toRow)
}

test('local game: both horses out and back twice → "Hòa do lặp nước!" exactly once', (t) =>
  step(app, t, async (page) => {
    await page.goto(`${app.baseUrl}/game`)
    await page.locator('.piece').first().waitFor()

    const cycle = [
      [1, 9, 2, 7], // red horse out
      [1, 0, 2, 2], // black horse out
      [2, 7, 1, 9], // back
      [2, 2, 1, 0],
    ]
    for (const [i, m] of [...cycle, ...cycle].entries()) {
      await move(page, m)
      // Not judged before the 3rd occurrence of the start position.
      if (i < 7) assert.equal(await page.getByText('Hòa do lặp nước!').count(), 0, `judged too early, after move ${i + 1}`)
    }

    await page.getByText('Hòa do lặp nước!').waitFor({ timeout: 3000 })
    assert.equal(await page.getByText('Hòa do lặp nước!').count(), 1, 'dialog shown more than once')
    assert.equal(await page.getByText('Hòa', { exact: true }).count(), 1, 'should be shown as a draw')

    // Closing it leaves the board locked: no further move is possible.
    await page.getByRole('button', { name: 'Đóng' }).click()
    await move(page, [1, 9, 2, 7])
    const horse = await page.locator('.piece.red', { hasText: '傌' }).first().boundingBox()
    const board = await page.locator('.board-inner').boundingBox()
    assert.ok(horse.x < board.x + board.width * 0.2, 'a move was played after the game ended')
    assert.equal(await page.getByText('Hòa do lặp nước!').count(), 0, 'dialog re-opened after closing')
  }))

test('no page errors', (t) =>
  step(app, t, async () => {
    assert.deepEqual(app.pageErrors, [])
  }))
