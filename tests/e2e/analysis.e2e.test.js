// Phân tích ván in Chrome, on a faked backend (no server, no database — see
// openMockedPage in ./browser.js); the analysis itself is the real bot,
// running in its Web Worker.
//
// Covers: the "Phân tích" button on every recent-match card, analysing a
// game from the Replay page (progress, advantage bar, ?! / ? / ?? marks,
// the verdict on a move with the better move, the green best-move arrow,
// the per-side summary), the analysis being remembered after a reload,
// ?analyze=1 starting it straight away, and the home page naming it.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json, TEST_USER as USER } from './browser.js'
import { INITIAL_PIECES } from '../../src/features/game/initialPosition.js'
import { createMoveEntry } from '../../src/features/game/utils/moveEntry.js'

// A short game in which red gives its cannon away for a pawn (move 3).
function replayGame(id) {
  let pieces = INITIAL_PIECES
  const moves = [
    ['r-c2', 4, 7], // P2-5
    ['b-h1', 2, 2],
    ['r-c2', 4, 3], // takes the centre pawn…
    ['b-h1', 4, 3], // …and is taken back
  ].map(([pieceId, col, row], i) => {
    const entry = createMoveEntry(pieces, pieces.find((p) => p.id === pieceId), col, row, i + 1)
    pieces = entry.piecesAfter
    return {
      moveNumber: i + 1,
      fromPosition: `${entry.from.col},${entry.from.row}`,
      toPosition: `${entry.to.col},${entry.to.row}`,
      piece: entry.piece.type,
      capturedPiece: entry.captured ? entry.captured.type : null,
      notation: entry.notation,
    }
  })
  return {
    id,
    redPlayer: { id: USER.id, username: USER.username, displayName: null },
    blackPlayer: { id: 100, username: 'opponent_a', displayName: null },
    winner: { id: 100, username: 'opponent_a', displayName: null },
    result: 'BLACK_WIN',
    endReason: 'RESIGN',
    initialTime: 600,
    increment: 0,
    moves,
  }
}

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const panel = (page) => page.getByTestId('analysis-panel')
const waitDone = (page) => panel(page).getByTestId('analysis-summary').waitFor({ timeout: 60_000 })

test('every recent-match card has "Phân tích" next to "Xem"', async (t) => {
  const games = [41, 42].map((gameId) => ({
    gameId,
    opponent: { id: 100 + gameId, username: `opp_${gameId}`, displayName: null, avatarUrl: null },
    result: 'WIN',
    color: 'red',
    winner: null,
    endReason: 'CHECKMATE',
    initialTime: 600,
    increment: 0,
    moveCount: 30,
    startedAt: '2026-11-01T10:00:00.000Z',
    endedAt: '2026-11-01T10:20:00.000Z',
  }))
  const ctx = await openMockedPage(app, t, { games: () => json({ success: true, games }), replay: replayGame })
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/play`)
  const section = page.getByTestId('recent-matches')
  await section.getByText('vs opp_41').waitFor()
  const analyse = section.getByRole('link', { name: /^Phân tích ván với/ })
  assert.equal(await analyse.count(), 2)
  assert.deepEqual(
    await analyse.evaluateAll((links) => links.map((a) => a.getAttribute('href'))),
    ['/replay/41?analyze=1', '/replay/42?analyze=1']
  )
  assert.equal(await section.getByRole('link', { name: 'Xem', exact: true }).count(), 2)

  // Clicking it opens the replay and starts right away; the address loses ?analyze=1.
  await analyse.first().click()
  await page.waitForURL(/\/replay\/41$/)
  await waitDone(page)
  assert.deepEqual(errors, [])
})

test('Replay: analyse a game — bar, marks, verdict, arrow, summary; remembered after a reload', async (t) => {
  const ctx = await openMockedPage(app, t, { replay: replayGame })
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/replay/7`)

  // Not analysed yet: just the button, no bar, no marks.
  const start = panel(page).getByRole('button', { name: 'Phân tích ván' })
  await start.waitFor()
  assert.equal(await page.getByTestId('eval-bar').count(), 0)
  assert.equal(await page.locator('[data-grade]').count(), 0)

  await start.click()
  await panel(page).getByText(/Đang phân tích…|Đỏ|Đen/).first().waitFor()
  await waitDone(page)

  // Move 3 (red's cannon for a pawn) is marked ?? in the list.
  const marks = await page.locator('[data-grade]').evaluateAll((els) => els.map((el) => el.dataset.grade))
  assert.ok(marks.includes('??'), `marks: ${JSON.stringify(marks)}`)
  assert.equal(await page.getByTestId('eval-bar').count(), 1)

  // The game opens on its last position; step to move 3 in the list.
  await page.locator('[data-grade="??"]').first().click()
  const verdict = panel(page).getByTestId('analysis-move')
  await verdict.waitFor()
  const text = await verdict.innerText()
  assert.match(text, /Nước 2 · Đỏ/)
  assert.match(text, /\?\? Nước hớ/)
  assert.match(text, /Nên đi: \S+/)

  // The bot's next move is drawn as a green arrow, and named.
  assert.equal(await page.locator('.board-drawings-hint [data-drawing]').count(), 1)
  assert.match(await panel(page).innerText(), /Máy đề xuất đi tiếp: \S+/)
  // Black is a cannon up after move 3 — the bar leans black.
  assert.ok(Number(await page.getByTestId('eval-bar').getAttribute('data-red-share')) < 40)

  // Summary: red has at least that one blunder.
  const summary = panel(page).getByTestId('analysis-summary')
  const blunderRow = summary.locator('tr', { hasText: 'Nước hớ' })
  assert.ok(Number((await blunderRow.locator('td').nth(1).innerText()).trim()) >= 1)
  assert.match(await panel(page).innerText(), /chỉ mang tính tham khảo/)

  // Reload: shown at once from this browser, no button, no new run.
  await page.reload()
  await waitDone(page)
  assert.equal(await panel(page).getByRole('button', { name: 'Phân tích ván' }).count(), 0)
  assert.equal(await panel(page).getByRole('progressbar').count(), 0)
  assert.ok((await page.locator('[data-grade="??"]').count()) >= 1)
  assert.deepEqual(errors, [])
})

test('Replay: "Dừng" stops an analysis and goes back to the button', async (t) => {
  // A longer game, so there's time to stop it: shuffle the horses back and forth.
  const longGame = (id) => {
    let pieces = INITIAL_PIECES
    const shuffle = [
      ['r-h2', 6, 7],
      ['b-h2', 6, 2],
      ['r-h2', 7, 9],
      ['b-h2', 7, 0],
    ]
    const moves = Array.from({ length: 24 }, (_, i) => shuffle[i % 4]).map(([pieceId, col, row], i) => {
      const entry = createMoveEntry(pieces, pieces.find((p) => p.id === pieceId), col, row, i + 1)
      pieces = entry.piecesAfter
      return {
        moveNumber: i + 1,
        fromPosition: `${entry.from.col},${entry.from.row}`,
        toPosition: `${entry.to.col},${entry.to.row}`,
        piece: entry.piece.type,
        capturedPiece: null,
        notation: entry.notation,
      }
    })
    return { ...replayGame(id), result: 'DRAW', endReason: 'DRAW_AGREEMENT', winner: null, moves }
  }
  const ctx = await openMockedPage(app, t, { replay: longGame })
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/replay/8`)
  await panel(page).getByRole('button', { name: 'Phân tích ván' }).click()
  await panel(page).getByRole('progressbar').waitFor()
  await panel(page).getByRole('button', { name: 'Dừng' }).click()
  await panel(page).getByRole('button', { name: 'Phân tích ván' }).waitFor()
  assert.equal(await page.getByTestId('eval-bar').count(), 0)
  assert.deepEqual(errors, [])
})

test('the home page names the feature', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/`)
  // The badge reads "<icon name>Phân tích ván", so match its end.
  await page.getByText(/Phân tích ván$/).first().waitFor()
  await page.getByText(/chỉ ra nước hớ/).waitFor()
  assert.equal(await page.getByText('Engine Analysis').count(), 0)
})
