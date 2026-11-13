// Cờ thế in Chrome, with a faked backend (openMockedPage — and the puzzles
// never need the backend at all). Which moves to click is worked out here
// with the same solver, so no answer is hard-coded into the test.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, soundsPlayed } from './browser.js'
import { PUZZLES } from '../../src/features/puzzles/data/puzzles.js'
import { buildPuzzlePieces } from '../../src/features/puzzles/engine/puzzle.js'
import { createSolver, solutionLine, applyMove } from '../../src/features/puzzles/engine/solver.js'
import { getAllLegalMoves } from '../../src/features/game/utils/moveUtils.js'
import { otherTurn } from '../../src/features/game/gameLogic.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const pathname = (page) => new URL(page.url()).pathname
const flippedFor = (puzzle) => puzzle.toMove === 'black'

// Click a board point given in REAL coordinates (the click targets are
// labelled by where they are drawn, so a flipped board is converted).
function clickReal(page, [col, row], flipped) {
  const c = flipped ? 8 - col : col
  const r = flipped ? 9 - row : row
  return page.getByRole('button', { name: `Ô cột ${c + 1} hàng ${r + 1}`, exact: true }).dispatchEvent('click')
}
async function play(page, move, flipped) {
  await clickReal(page, move.from, flipped)
  await clickReal(page, move.to, flipped)
}
const lastTo = (page) => page.locator('.last-move-to').getAttribute('data-square')
const sq = ([c, r]) => `${c},${r}`
// The puzzle panel's own status badge (solved / viewed), or of a list card.
const panel = (page) => page.locator('aside[aria-label="Thế cờ"]')
const status = (scope, which) => scope.locator(`[data-testid="puzzle-status"][data-status="${which}"]`)
const turnLine = (page) => page.getByTestId('puzzle-turn')

async function openPuzzle(t, id, options = {}) {
  const ctx = await openMockedPage(app, t, { signedIn: false, sounds: true, ...options })
  if (!ctx) return null
  const apiRequests = []
  const workers = []
  ctx.page.on('request', (r) => {
    if (/\/api\//.test(r.url())) apiRequests.push(r.url())
  })
  ctx.page.on('worker', (w) => workers.push(w.url()))
  await ctx.page.goto(`${app.baseUrl}/puzzles/${id}`)
  await ctx.page.locator('.piece').first().waitFor()
  return { ...ctx, apiRequests, workers }
}

const firstOf = (moves, toMove) => PUZZLES.find((p) => p.moves === moves && p.toMove === toMove)

test('sidebar "Cờ thế" → list of 24 puzzles in three levels, nothing solved yet', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/play`)
  await page.locator('aside').getByRole('link', { name: /Cờ thế/ }).click()
  await page.waitForURL((url) => url.pathname === '/puzzles')
  await page.getByRole('heading', { name: 'Cờ thế', level: 1 }).waitFor()
  for (const name of ['Chiếu bí 1 nước', 'Chiếu bí 2 nước', 'Chiếu bí 3 nước']) {
    assert.equal(await page.getByRole('heading', { name, level: 2 }).count(), 1, name)
  }
  assert.equal(await page.locator('[data-testid^="puzzle-card-"]').count(), 24)
  assert.match(await page.getByTestId('puzzle-progress').textContent(), /Đã giải 0 \/ 24/)
  assert.equal(await page.locator('[data-testid="puzzle-status"]').count(), 0)
  assert.deepEqual(errors, [])
})

test('solve a 2-move puzzle: key move → computer defends → mate; ✓ kept after reload', async (t) => {
  const puzzle = firstOf(2, 'red')
  const ctx = await openPuzzle(t, puzzle.id)
  if (!ctx) return
  const { page, apiRequests, workers, errors } = ctx
  const line = solutionLine(buildPuzzlePieces(puzzle), puzzle.toMove, puzzle.moves)

  assert.match(await page.getByTestId('puzzle-task').textContent(), /Đỏ đi trước, chiếu bí trong 2 nước/)
  await play(page, line[0], false)
  // The computer's answer is the solver's longest defence.
  await page.waitForFunction((want) => document.querySelector('.last-move-to')?.dataset.square === want, sq(line[1].to))
  await page.getByText(/Đến lượt bạn — còn 1 nước/).waitFor()
  await play(page, line[2], false)
  await page.getByText(/thế cờ đã được giải/).waitFor()
  assert.equal(await status(panel(page), 'solved').count(), 1)

  const sounds = await soundsPlayed(page)
  assert.equal(sounds.at(-1), 'game-end.mp3')
  assert.equal(sounds.length, 3, `one sound per move: ${sounds}`)

  // Puzzles run in a Web Worker and never call the backend.
  assert.ok(workers.some((url) => /puzzleWorker/.test(url)), `no puzzle worker: ${workers}`)
  assert.deepEqual(apiRequests, [], 'a puzzle called the backend')

  await page.goto(`${app.baseUrl}/puzzles`)
  await status(page.getByTestId(`puzzle-card-${puzzle.id}`), 'solved').waitFor()
  assert.match(await page.getByTestId('puzzle-progress').textContent(), /Đã giải 1 \/ 24/)
  assert.deepEqual(errors, [])
})

test('a wrong move is explained and taken back; then the right one still works', async (t) => {
  const puzzle = firstOf(2, 'red')
  const ctx = await openPuzzle(t, puzzle.id)
  if (!ctx) return
  const { page } = ctx
  const pieces = buildPuzzlePieces(puzzle)
  const line = solutionLine(pieces, puzzle.toMove, puzzle.moves)
  const wrong = getAllLegalMoves(pieces, puzzle.toMove)
    .map((m) => {
      const p = pieces.find((x) => x.id === m.pieceId)
      return { from: [p.col, p.row], to: [m.col, m.row] }
    })
    .find((m) => sq(m.from) !== sq(line[0].from) || sq(m.to) !== sq(line[0].to))

  await play(page, wrong, false)
  await page.getByText(/Chưa đúng: sau nước này đối phương vẫn có cách thoát/).waitFor()
  // Taken back: no last move on the board any more, and it's our turn again.
  await page.waitForFunction(() => document.querySelectorAll('.last-move-square').length === 0)
  await page.getByText(/Lượt của bạn \(Đỏ\) — còn 2 nước/).waitFor()
  assert.equal(await status(panel(page), 'solved').count(), 0)

  await play(page, line[0], false)
  await page.getByText(/Đến lượt bạn — còn 1 nước/).waitFor()
})

test('another winning route than the shown solution is accepted', async (t) => {
  // Find a puzzle where, after the key move and the computer's defence, more
  // than one move still wins — then play the one the solution does NOT use.
  let found = null
  for (const puzzle of PUZZLES.filter((p) => p.moves >= 2)) {
    const pieces = buildPuzzlePieces(puzzle)
    const solver = createSolver()
    const line = solutionLine(pieces, puzzle.toMove, puzzle.moves, solver)
    const afterReply = applyMove(applyMove(pieces, line[0]), line[1])
    const options = solver.winningMoves(afterReply, puzzle.toMove, puzzle.moves - 1)
    const other = options.find((m) => sq(m.from) !== sq(line[2].from) || sq(m.to) !== sq(line[2].to))
    if (other) {
      found = { puzzle, line, other, afterReply, solver }
      break
    }
  }
  assert.ok(found, 'no puzzle with an alternative winning route')
  const { puzzle, line, other, afterReply, solver } = found
  const ctx = await openPuzzle(t, puzzle.id)
  if (!ctx) return
  const { page } = ctx
  const flipped = flippedFor(puzzle)

  await play(page, line[0], flipped)
  await page.waitForFunction((want) => document.querySelector('.last-move-to')?.dataset.square === want, sq(line[1].to))
  await page.getByText(/Đến lượt bạn/).waitFor()
  await play(page, other, flipped)
  if (puzzle.moves === 2) {
    await page.getByText(/thế cờ đã được giải/).waitFor()
  } else {
    // Mate in 3: the alternative second move is accepted, the computer
    // defends, and the remaining mate is played out.
    const reply = solver.bestDefence(applyMove(afterReply, other), otherTurn(puzzle.toMove), puzzle.toMove, 1)
    await page.waitForFunction((want) => document.querySelector('.last-move-to')?.dataset.square === want, sq(reply.to))
    await turnLine(page).getByText(/còn 1 nước/).waitFor()
    const end = applyMove(applyMove(afterReply, other), reply)
    const mate = solver.winningMoves(end, puzzle.toMove, 1)[0]
    await play(page, mate, flipped)
    await page.getByText(/thế cờ đã được giải/).waitFor()
  }
  t.diagnostic(`alternative route on ${puzzle.id}: ${JSON.stringify(other)} instead of ${JSON.stringify(line[2])}`)
})

test('Gợi ý selects the piece to move', async (t) => {
  const puzzle = firstOf(3, 'red')
  const ctx = await openPuzzle(t, puzzle.id)
  if (!ctx) return
  const { page } = ctx
  const line = solutionLine(buildPuzzlePieces(puzzle), puzzle.toMove, puzzle.moves)
  await page.getByRole('button', { name: /Gợi ý/ }).click()
  await page.getByText(/Gợi ý: hãy đi quân/).waitFor()
  const selected = await page.locator('.piece.selected').boundingBox()
  const target = await page
    .getByRole('button', { name: `Ô cột ${line[0].from[0] + 1} hàng ${line[0].from[1] + 1}`, exact: true })
    .boundingBox()
  assert.ok(
    Math.abs(selected.x + selected.width / 2 - (target.x + target.width / 2)) < 3 &&
      Math.abs(selected.y + selected.height / 2 - (target.y + target.height / 2)) < 3,
    'the hinted piece is not the one that has to move'
  )
})

test('Xem lời giải → "Đã xem lời giải" (not solved); solving it afterwards → "Đã giải"', async (t) => {
  const puzzle = firstOf(1, 'red')
  const ctx = await openPuzzle(t, puzzle.id)
  if (!ctx) return
  const { page } = ctx
  const line = solutionLine(buildPuzzlePieces(puzzle), puzzle.toMove, puzzle.moves)

  await page.getByRole('button', { name: /Xem lời giải/ }).click()
  await page.getByText(/Đây là một lời giải/).waitFor()
  assert.equal(await lastTo(page), sq(line[0].to), 'the solution was not played on the board')
  assert.equal(await status(panel(page), 'viewed').count(), 1)
  assert.equal(await status(panel(page), 'solved').count(), 0, 'viewing the solution counted as solved')

  await page.goto(`${app.baseUrl}/puzzles`)
  const card = page.getByTestId(`puzzle-card-${puzzle.id}`)
  await status(card, 'viewed').waitFor()
  assert.match(await page.getByTestId('puzzle-progress').textContent(), /Đã giải 0 \/ 24/)

  // Play it again unaided and solve it: now it counts.
  await card.click()
  await page.locator('.piece').first().waitFor()
  await play(page, line[0], false)
  await page.getByText(/thế cờ đã được giải/).waitFor()
  await page.goto(`${app.baseUrl}/puzzles`)
  await status(page.getByTestId(`puzzle-card-${puzzle.id}`), 'solved').waitFor()
  assert.match(await page.getByTestId('puzzle-progress').textContent(), /Đã giải 1 \/ 24/)
})

test('Black to move: board turned (Black at the bottom) and solvable', async (t) => {
  const puzzle = firstOf(2, 'black')
  const ctx = await openPuzzle(t, puzzle.id)
  if (!ctx) return
  const { page } = ctx
  assert.match(await page.getByTestId('puzzle-task').textContent(), /Đen đi trước/)
  const redGeneral = await page.locator('.piece.red', { hasText: '帥' }).boundingBox()
  const blackGeneral = await page.locator('.piece.black', { hasText: '將' }).boundingBox()
  assert.ok(blackGeneral.y > redGeneral.y, 'board not turned for Black')

  const line = solutionLine(buildPuzzlePieces(puzzle), puzzle.toMove, puzzle.moves)
  await play(page, line[0], true)
  await page.waitForFunction((want) => document.querySelector('.last-move-to')?.dataset.square === want, sq(line[1].to))
  await page.getByText(/Đến lượt bạn — còn 1 nước/).waitFor()
  await play(page, line[2], true)
  await page.getByText(/thế cờ đã được giải/).waitFor()
})

test('Làm lại restarts; an unknown puzzle id shows a way back', async (t) => {
  const puzzle = firstOf(2, 'red')
  const ctx = await openPuzzle(t, puzzle.id)
  if (!ctx) return
  const { page } = ctx
  const line = solutionLine(buildPuzzlePieces(puzzle), puzzle.toMove, puzzle.moves)
  await play(page, line[0], false)
  await page.getByText(/Đến lượt bạn — còn 1 nước/).waitFor()
  await page.getByRole('button', { name: /Làm lại/ }).click()
  await page.getByText(/Lượt của bạn \(Đỏ\) — còn 2 nước/).waitFor()
  assert.equal(await page.locator('.last-move-square').count(), 0)

  await page.goto(`${app.baseUrl}/puzzles/khong-co`)
  await page.getByText('Không tìm thấy thế cờ này.').waitFor()
  await page.getByRole('link', { name: 'Về danh sách cờ thế' }).click()
  await page.waitForURL((url) => url.pathname === '/puzzles')
  assert.equal(pathname(page), '/puzzles')
})
