// Board feedback in Chrome with a faked backend (openMockedPage): move
// sounds, the last-move highlight, and right-click arrows/circles — on the
// local board (/game), against the bot (/ai, board flipped for Black), on
// the replay page (flipped for the player who had Black), and the Academy
// board staying untouched. Sounds are recorded instead of played (see the
// `sounds` option), so the test reads back exactly which files played.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  openApp,
  closeApp,
  openMockedPage,
  clickSquare,
  soundsPlayed,
  squareCenter,
  rightDrag,
  contextMenuBlocked,
  navigateInApp,
  json,
  TEST_USER,
} from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

async function move(page, [fromCol, fromRow, toCol, toRow]) {
  await clickSquare(page, fromCol, fromRow)
  await clickSquare(page, toCol, toRow)
}

// Plays a move and waits until it has made its sound (`expected` total).
async function moveAndHear(page, m, expected) {
  await move(page, m)
  await page.waitForFunction((n) => window.__soundsPlayed.length >= n, expected, { timeout: 3000 })
}

async function openGuestGame(t, path = '/game') {
  const ctx = await openMockedPage(app, t, { signedIn: false, sounds: true })
  if (!ctx) return null
  await ctx.page.goto(`${app.baseUrl}${path}`)
  await ctx.page.locator('.piece').first().waitFor()
  return ctx
}

const near = (a, b, what) => {
  assert.ok(Math.abs(a.x - b.x) < 3 && Math.abs(a.y - b.y) < 3, `${what}: (${a.x},${a.y}) vs (${b.x},${b.y})`)
}
async function centerOf(locator) {
  const box = await locator.boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
// Whether one of the pieces matching `selector` is drawn centred on `point`
// — an independent check of a position, not relying on the click labels.
async function pieceAt(page, selector, point) {
  const centers = await page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const b = el.getBoundingClientRect()
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    })
  )
  return centers.some((c) => Math.abs(c.x - point.x) < 3 && Math.abs(c.y - point.y) < 3)
}

// Red: cannon to the centre; capture a horse; rook out and across; rook
// takes the advisor next to the black general (capture AND check → "check").
const SEQUENCE = [
  [[1, 7, 4, 7], 'move.mp3'],
  [[0, 3, 0, 4], 'move.mp3'],
  [[7, 7, 7, 0], 'capture.mp3'],
  [[8, 3, 8, 4], 'move.mp3'],
  [[0, 9, 0, 7], 'move.mp3'],
  [[8, 4, 8, 5], 'move.mp3'],
  [[0, 7, 3, 7], 'move.mp3'],
  [[0, 4, 0, 5], 'move.mp3'],
  [[3, 7, 3, 0], 'check.mp3'],
]

test('sounds: move / capture / check, one per move; undo and redo stay silent', async (t) => {
  const ctx = await openGuestGame(t)
  if (!ctx) return
  const { page, errors } = ctx
  assert.deepEqual(await soundsPlayed(page), [], 'a sound played on page load')

  for (const [i, [m]] of SEQUENCE.entries()) await moveAndHear(page, m, i + 1)
  assert.deepEqual(
    await soundsPlayed(page),
    SEQUENCE.map(([, sound]) => sound)
  )

  await page.getByRole('button', { name: /Hoàn tác/ }).click()
  await page.getByRole('button', { name: /Hoàn tác/ }).click()
  await page.getByRole('button', { name: /Làm lại/ }).click()
  await page.getByRole('button', { name: /Làm lại/ }).click()
  await page.waitForTimeout(400)
  assert.equal((await soundsPlayed(page)).length, SEQUENCE.length, 'undo/redo played a sound')
  assert.deepEqual(errors, [])
})

test('sounds: a move that ends the game plays only game-end', async (t) => {
  const ctx = await openGuestGame(t)
  if (!ctx) return
  const { page } = ctx
  // Both horses out and back twice → draw by repetition on the 8th move.
  const cycle = [
    [1, 9, 2, 7],
    [1, 0, 2, 2],
    [2, 7, 1, 9],
    [2, 2, 1, 0],
  ]
  for (const [i, m] of [...cycle, ...cycle].entries()) await moveAndHear(page, m, i + 1)
  await page.getByText('Hòa do lặp nước!').waitFor()
  await page.waitForTimeout(400)
  assert.deepEqual(await soundsPlayed(page), [...Array(7).fill('move.mp3'), 'game-end.mp3'])
})

test('sounds: ending without a move (resigning to the bot) plays game-end once', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false, sounds: true })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/ai`)
  await page.getByRole('button', { name: /Cầm Đỏ/ }).click()
  await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()
  await page.getByText('Đến lượt bạn').waitFor()
  await page.getByRole('button', { name: 'Đầu hàng' }).first().click()
  await page.getByRole('button', { name: 'Đầu hàng' }).last().click()
  await page.getByText('Bạn đã đầu hàng!').waitFor()
  await page.waitForTimeout(400)
  assert.deepEqual(await soundsPlayed(page), ['game-end.mp3'])
})

test('sounds: switched off (guest, Settings) → nothing plays', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false, sounds: true })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/settings`)
  await page.getByRole('switch', { name: 'Âm thanh' }).click()
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  await page.getByText('Đã lưu thay đổi').waitFor()

  await navigateInApp(page, '/game')
  await page.locator('.piece').first().waitFor()
  for (const [m] of SEQUENCE.slice(0, 3)) await move(page, m)
  await page.locator('.last-move-to[data-square="7,0"]').waitFor()
  await page.waitForTimeout(400)
  assert.deepEqual(await soundsPlayed(page), [])
})

test('last move: from/to squares highlighted on the right points; follows undo', async (t) => {
  const ctx = await openGuestGame(t)
  if (!ctx) return
  const { page } = ctx
  assert.equal(await page.locator('.last-move-square').count(), 0, 'highlight before any move')

  await move(page, [1, 7, 4, 7])
  await move(page, [0, 3, 0, 4])
  assert.equal(await page.locator('.last-move-from').getAttribute('data-square'), '0,3')
  assert.equal(await page.locator('.last-move-to').getAttribute('data-square'), '0,4')
  near(await centerOf(page.locator('.last-move-from')), await squareCenter(page, 0, 3), 'from square position')
  near(await centerOf(page.locator('.last-move-to')), await squareCenter(page, 0, 4), 'to square position')

  // Undo shows the move that led to the position now on screen.
  await page.getByRole('button', { name: /Hoàn tác/ }).click()
  assert.equal(await page.locator('.last-move-from').getAttribute('data-square'), '1,7')
  assert.equal(await page.locator('.last-move-to').getAttribute('data-square'), '4,7')
  await page.getByRole('button', { name: /Hoàn tác/ }).click()
  assert.equal(await page.locator('.last-move-square').count(), 0, 'highlight at the start position')
})

test('last move: right points on the board flipped for Black (vs the bot)', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/ai`)
  await page.getByRole('button', { name: /^Dễ/ }).click()
  await page.getByRole('button', { name: /Cầm Đen/ }).click()
  await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()
  await page.getByText('Đến lượt bạn').waitFor({ timeout: 8000 })

  const to = (await page.locator('.last-move-to').getAttribute('data-square')).split(',').map(Number)
  const from = (await page.locator('.last-move-from').getAttribute('data-square')).split(',').map(Number)
  const toCenter = await centerOf(page.locator('.last-move-to'))
  near(toCenter, await squareCenter(page, ...to, { flipped: true }), 'to square (flipped)')
  near(await centerOf(page.locator('.last-move-from')), await squareCenter(page, ...from, { flipped: true }), 'from square (flipped)')
  // The bot's (red) piece really stands on the highlighted point…
  assert.ok(await pieceAt(page, '.piece.red', toCenter), 'no red piece on the highlighted square')
  // …and the board really is flipped: red's side is at the top.
  const redGeneral = await centerOf(page.locator('.piece.red', { hasText: '帥' }))
  const blackGeneral = await centerOf(page.locator('.piece.black', { hasText: '將' }))
  assert.ok(redGeneral.y < blackGeneral.y, 'board not flipped for Black')
})

// A finished game where the signed-in test user had Black (replay flips).
const REPLAY_GAME = {
  id: 42,
  redPlayer: { id: 100, username: 'opponent_a', displayName: null },
  blackPlayer: { id: TEST_USER.id, username: TEST_USER.username, displayName: null },
  winner: null,
  result: 'DRAW',
  endReason: 'DRAW_AGREEMENT',
  moves: [
    { moveNumber: 1, fromPosition: '1,7', toPosition: '4,7', piece: 'cannon', capturedPiece: null, notation: 'P2-5' },
    { moveNumber: 2, fromPosition: '0,3', toPosition: '0,4', piece: 'pawn', capturedPiece: null, notation: 'B9+1' },
    { moveNumber: 3, fromPosition: '4,7', toPosition: '4,3', piece: 'cannon', capturedPiece: 'pawn', notation: 'P5+4' },
  ],
}

async function openReplay(t, options = {}) {
  const ctx = await openMockedPage(app, t, { signedIn: true, sounds: true, ...options })
  if (!ctx) return null
  await ctx.page.route(/\/api\/games\/42(\?|$)/, (route) => route.fulfill(json({ success: true, game: REPLAY_GAME })))
  await ctx.page.goto(`${app.baseUrl}/replay/42`)
  await ctx.page.locator('.piece').first().waitFor()
  return ctx
}

test('replay: highlight on the flipped board; only "next" plays a sound', async (t) => {
  const ctx = await openReplay(t)
  if (!ctx) return
  const { page, errors } = ctx
  // Opens at the end: last move is red cannon 4,7 → 4,3 (a capture).
  assert.equal(await page.locator('.last-move-to').getAttribute('data-square'), '4,3')
  const toCenter = await centerOf(page.locator('.last-move-to'))
  near(toCenter, await squareCenter(page, 4, 3, { flipped: true }), 'to square (replay, flipped)')
  near(await centerOf(page.locator('.last-move-from')), await squareCenter(page, 4, 7, { flipped: true }), 'from square (replay, flipped)')
  // The red piece that moved really stands on the highlighted point…
  assert.ok(await pieceAt(page, '.piece.red', toCenter), 'no red piece on the highlighted square (replay)')
  // …and the board really is flipped: Black's general is drawn below Red's.
  const redGeneral = await centerOf(page.locator('.piece.red', { hasText: '帥' }))
  const blackGeneral = await centerOf(page.locator('.piece.black', { hasText: '將' }))
  assert.ok(blackGeneral.y > redGeneral.y, 'replay not flipped for Black')

  await page.getByRole('button', { name: 'Nước trước' }).click()
  await page.getByRole('button', { name: 'Về đầu' }).click()
  await page.getByRole('button', { name: 'Đến cuối' }).click()
  await page.getByRole('button', { name: 'Về đầu' }).click()
  await page.waitForTimeout(300)
  assert.deepEqual(await soundsPlayed(page), [], 'back / start / end should be silent')

  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Nước tiếp theo' }).click()
  await page.waitForFunction(() => window.__soundsPlayed.length >= 3)
  assert.deepEqual(await soundsPlayed(page), ['move.mp3', 'move.mp3', 'capture.mp3'])
  assert.deepEqual(errors, [])
})

test('replay: sound off for the account → "next" is silent', async (t) => {
  const ctx = await openReplay(t, { settings: { soundEnabled: false, arrowsEnabled: true, recentGamesVisibility: 'PUBLIC', challengePermission: 'EVERYONE' } })
  if (!ctx) return
  const { page, settingsCalls } = ctx
  await page.waitForFunction(() => true)
  // Wait until the account settings have been loaded.
  for (let i = 0; i < 50 && settingsCalls.length === 0; i++) await page.waitForTimeout(50)
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Về đầu' }).click()
  await page.getByRole('button', { name: 'Nước tiếp theo' }).click()
  await page.waitForTimeout(300)
  assert.deepEqual(await soundsPlayed(page), [])
})

test('drawing: arrow and circle; same gesture removes; cleared by left click and by a new move', async (t) => {
  const ctx = await openGuestGame(t)
  if (!ctx) return
  const { page, errors } = ctx
  const drawing = (key) => page.locator(`[data-drawing="${key}"]`)

  assert.equal(await contextMenuBlocked(page), true, 'right-click menu should be blocked while drawing is on')

  await rightDrag(page, [1, 9], [2, 7])
  assert.equal(await drawing('arrow:1,9-2,7').count(), 1, 'arrow not drawn')
  await rightDrag(page, [1, 9], [2, 7])
  assert.equal(await drawing('arrow:1,9-2,7').count(), 0, 'same arrow again should remove it')

  await rightDrag(page, [4, 9], [4, 9])
  assert.equal(await drawing('circle:4,9').count(), 1, 'circle not drawn')
  near(await centerOf(drawing('circle:4,9')), await squareCenter(page, 4, 9), 'circle position')
  await rightDrag(page, [4, 9], [4, 9])
  assert.equal(await drawing('circle:4,9').count(), 0, 'same circle again should remove it')

  // A left click anywhere on the board clears everything.
  await rightDrag(page, [1, 9], [2, 7])
  await rightDrag(page, [4, 0], [4, 0])
  assert.equal(await page.locator('[data-drawing]').count(), 2)
  const empty = await squareCenter(page, 4, 4)
  await page.mouse.click(empty.x, empty.y)
  assert.equal(await page.locator('[data-drawing]').count(), 0, 'left click did not clear drawings')

  // A new move clears them too (the move itself is played by clicks, which
  // would also clear — so draw after selecting, then finish the move).
  await clickSquare(page, 1, 7)
  await rightDrag(page, [4, 0], [4, 0])
  assert.equal(await page.locator('[data-drawing]').count(), 1)
  await clickSquare(page, 4, 7)
  await page.locator('.last-move-to[data-square="4,7"]').waitFor()
  assert.equal(await page.locator('[data-drawing]').count(), 0, 'a new move did not clear drawings')

  // Drawing never selects or moves anything.
  assert.equal(await page.locator('.piece.selected').count(), 0)
  assert.deepEqual(errors, [])
})

test('drawing: on a flipped board, stored and drawn at the real points', async (t) => {
  const ctx = await openReplay(t)
  if (!ctx) return
  const { page } = ctx
  const flipped = { flipped: true }
  // Right-click where the black general is drawn (real 4,0 — at the bottom).
  const general = await centerOf(page.locator('.piece.black', { hasText: '將' }))
  near(general, await squareCenter(page, 4, 0, flipped), 'black general position (flipped)')
  await rightDrag(page, [4, 0], [4, 0], flipped)
  const circle = page.locator('[data-drawing="circle:4,0"]')
  assert.equal(await circle.count(), 1, 'circle not stored at the real point (4,0)')
  near(await centerOf(circle), general, 'circle drawn on the black general (flipped)')

  await rightDrag(page, [0, 0], [0, 2], flipped)
  const arrow = page.locator('[data-drawing="arrow:0,0-0,2"]')
  assert.equal(await arrow.count(), 1, 'arrow not stored at the real points')
  // The arrow lies between the two real points on screen.
  const box = await arrow.boundingBox()
  const a = await squareCenter(page, 0, 0, flipped)
  const b = await squareCenter(page, 0, 2, flipped)
  assert.ok(Math.abs(box.x + box.width / 2 - a.x) < 3, 'arrow not on the column of (0,0)')
  assert.ok(box.y >= Math.min(a.y, b.y) - 3 && box.y + box.height <= Math.max(a.y, b.y) + 3, 'arrow outside its two points')

  // Stepping to another move clears them.
  await page.getByRole('button', { name: 'Nước trước' }).click()
  assert.equal(await page.locator('[data-drawing]').count(), 0)
})

test('drawing: switched off for the account → nothing drawn, right-click menu not blocked', async (t) => {
  const ctx = await openMockedPage(app, t, {
    signedIn: true,
    settings: { soundEnabled: true, arrowsEnabled: false, recentGamesVisibility: 'PUBLIC', challengePermission: 'EVERYONE' },
  })
  if (!ctx) return
  const { page, settingsCalls } = ctx
  await page.goto(`${app.baseUrl}/game`)
  await page.locator('.piece').first().waitFor()
  for (let i = 0; i < 50 && settingsCalls.length === 0; i++) await page.waitForTimeout(50)
  await page.waitForTimeout(200)
  await rightDrag(page, [1, 9], [2, 7])
  await rightDrag(page, [4, 9], [4, 9])
  assert.equal(await page.locator('[data-drawing]').count(), 0)
  assert.equal(await contextMenuBlocked(page), false)
})

test('Academy board: no drawing, right-click menu not blocked', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/academy/course/pieces/rook/challenge/1`)
  await page.locator('.board-inner').waitFor()
  await page.locator('.piece').first().waitFor()
  assert.equal(await contextMenuBlocked(page), false)
  const box = await page.locator('.board-inner').boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' })
  assert.equal(await page.locator('[data-drawing]').count(), 0)
  assert.equal(await page.locator('.board-drawings').count(), 0)
})
