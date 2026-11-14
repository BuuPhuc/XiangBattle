// The move-history table's paging (10 rows a page), in Chrome. Written
// before the lint clean-up of MoveHistoryPanel.jsx (no setState inside an
// effect) to pin what it does today, on both pages that use it:
//  - a local game at /game: no pager up to 10 rows; the 11th row opens page
//    2 by itself; after going back to page 1, a move that doesn't add a page
//    leaves you on page 1;
//  - a replay at /replay/:id (faked backend): opens on the last page;
//    "Trang đầu" / "Trang sau" work; stepping through the replay or picking
//    a move never moves the table off the page being read.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, clickSquare, json, TEST_USER } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const pager = (page) => page.getByRole('button', { name: 'Trang đầu' })
const pageNumber = (page) => page.locator('[aria-label="Trang trước"] + span').innerText()
// Row numbers (the "#" column) currently shown.
const shownRows = (page) =>
  page.locator('.move-history tbody tr td:first-child').evaluateAll((cells) => cells.map((c) => Number(c.textContent)))
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

async function move(page, [fromCol, fromRow, toCol, toRow]) {
  const before = await page.locator('.move-history tbody tr').count()
  await clickSquare(page, fromCol, fromRow)
  await clickSquare(page, toCol, toRow)
  return before
}

// 22 legal plies (11 rows) that never repeat a position: both chariots
// walk along their empty second rank, then a pawn each.
function chariotWalk() {
  const red = [[0, 9, 0, 8]]
  const black = [[0, 0, 0, 1]]
  for (let col = 0; col < 8; col += 1) {
    red.push([col, 8, col + 1, 8])
    black.push([col, 1, col + 1, 1])
  }
  red.push([8, 8, 8, 7], [0, 6, 0, 5])
  black.push([8, 1, 8, 2], [8, 3, 8, 4])
  return red.flatMap((m, i) => [m, black[i]])
}

test('local game: the 11th row opens page 2; a move that adds no page keeps page 1', async (t) => {
  if (app.skipReason) return t.skip(app.skipReason)
  const context = await app.browser.newContext({ viewport: { width: 1400, height: 1000 } })
  t.after(() => context.close())
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route(/socket\.io/, (route) => route.abort())

  await page.goto(`${app.baseUrl}/game`)
  await page.locator('.piece').first().waitFor()
  const plies = chariotWalk()
  assert.equal(plies.length, 22)

  for (let i = 0; i < 20; i += 1) await move(page, plies[i])
  await page.locator('.move-history tbody tr').nth(9).waitFor()
  assert.deepEqual(await shownRows(page), range(1, 10))
  assert.equal(await pager(page).count(), 0, 'no pager while everything fits on one page')

  // Ply 21 starts row 11 → a second page, shown right away.
  await move(page, plies[20])
  await pager(page).waitFor()
  assert.equal(await pageNumber(page), '2')
  assert.deepEqual(await shownRows(page), [11])

  await pager(page).click()
  assert.equal(await pageNumber(page), '1')
  assert.deepEqual(await shownRows(page), range(1, 10))

  // Ply 22 completes row 11 — still 2 pages, so the table stays on page 1.
  await move(page, plies[21])
  await page.waitForTimeout(300)
  assert.equal(await pageNumber(page), '1')
  assert.deepEqual(await shownRows(page), range(1, 10))

  await page.getByRole('button', { name: 'Trang cuối' }).click()
  assert.equal(await pageNumber(page), '2')
  assert.deepEqual(await shownRows(page), [11])
  assert.deepEqual(errors, [])
})

// 26 plies (13 rows): both horses out and back, over and over (a replay
// rebuilds positions without judging them). Notations N1..N26.
function replayMoves() {
  const cycle = [
    ['1,9', '2,7'],
    ['1,0', '2,2'],
    ['2,7', '1,9'],
    ['2,2', '1,0'],
  ]
  return Array.from({ length: 26 }, (_, i) => ({
    moveNumber: i + 1,
    fromPosition: cycle[i % 4][0],
    toPosition: cycle[i % 4][1],
    piece: 'horse',
    capturedPiece: null,
    notation: `N${i + 1}`,
  }))
}

test('replay: opens on the last page; stepping or picking a move keeps the page being read', async (t) => {
  const ctx = await openMockedPage(app, t)
  if (!ctx) return
  const { page, errors } = ctx
  await page.route(/\/api\/games\/\d+/, (route) =>
    route.fulfill(
      json({
        success: true,
        game: {
          id: 42,
          redPlayer: { id: TEST_USER.id, username: TEST_USER.username, displayName: null },
          blackPlayer: { id: 100, username: 'opponent_a', displayName: null },
          winner: null,
          result: 'DRAW',
          endReason: 'DRAW_AGREEMENT',
          moves: replayMoves(),
        },
      })
    )
  )

  await page.goto(`${app.baseUrl}/replay/42`)
  await pager(page).waitFor()
  assert.equal(await pageNumber(page), '2', 'a replay should open on the last page')
  assert.deepEqual(await shownRows(page), [11, 12, 13])

  await pager(page).click()
  assert.equal(await pageNumber(page), '1')
  assert.deepEqual(await shownRows(page), range(1, 10))

  // Stepping through the replay never flips the table to another page.
  // (A replay opens on its final position.)
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Nước trước' }).click()
  await page.getByRole('button', { name: 'Về đầu' }).click()
  for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Nước tiếp theo' }).click()
  await page.getByRole('button', { name: 'Đến cuối' }).click()
  await page.waitForTimeout(200)
  assert.equal(await pageNumber(page), '1')

  // Picking a move in the table views it, and stays put too.
  await page.getByRole('button', { name: 'N5', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'N5', exact: true }).getAttribute('aria-current'), 'true')
  assert.equal(await pageNumber(page), '1')

  await page.getByRole('button', { name: 'Trang sau' }).click()
  assert.equal(await pageNumber(page), '2')
  assert.deepEqual(await shownRows(page), [11, 12, 13])
  assert.deepEqual(errors, [])
})
