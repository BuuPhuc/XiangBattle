// Cờ thế — the puzzles. Each one: `toMove` forces checkmate in exactly
// `moves` of its own moves, there is no faster win, and only one first move
// works. No solution is stored: the solver (engine/solver.js) works it out,
// so a hand-written answer can never be wrong — and tests/rules/puzzles.test.js
// re-proves every claim above for every puzzle (plus legal piece counts and
// squares, generals not facing, the side not to move not in check).
//
// The positions were composed for XiangBattle with the search tool in
// scripts/puzzles (same rules and solver; not copied from any book or site),
// then reviewed by eye: no attacking piece is superfluous, so each title
// names exactly the pieces the mate needs. Three of each eight have Black to
// move. `npm run puzzles:check` re-validates them; `npm run puzzles:find`
// proposes new ones (it never writes into this folder — adding a puzzle is
// always a deliberate edit here).
//
// Coordinates: col 0-8 left to right, row 0-9 from Black's back rank (top)
// to Red's (bottom), as everywhere in the game.
import { red, black } from '../../academy/data/helpers.js'

export const PUZZLE_LEVELS = [
  { moves: 1, title: 'Chiếu bí 1 nước' },
  { moves: 2, title: 'Chiếu bí 2 nước' },
  { moves: 3, title: 'Chiếu bí 3 nước' },
]

export const PUZZLES = [
  { id: 'm1-1', moves: 1, toMove: 'red', title: 'Song Mã', pieces: [black('general', 4, 2), red('general', 3, 8), red('horse', 4, 6), red('horse', 7, 1), red('advisor', 5, 7), black('advisor', 5, 0), black('pawn', 5, 9), black('advisor', 4, 1)] },
  { id: 'm1-2', moves: 1, toMove: 'black', title: 'Xe – lộ mặt Tướng', pieces: [red('general', 3, 8), black('general', 4, 1), black('rook', 8, 4), black('advisor', 3, 2), red('advisor', 5, 7)] },
  { id: 'm1-3', moves: 1, toMove: 'red', title: 'Mã – Pháo', pieces: [black('general', 4, 1), red('general', 5, 7), red('horse', 6, 4), red('cannon', 4, 5), red('advisor', 5, 9), black('advisor', 5, 0)] },
  { id: 'm1-4', moves: 1, toMove: 'red', title: 'Xe – Pháo', pieces: [black('general', 4, 0), red('general', 3, 7), red('rook', 3, 2), red('cannon', 1, 0), black('advisor', 5, 0), black('elephant', 8, 2), black('advisor', 4, 1)] },
  { id: 'm1-5', moves: 1, toMove: 'black', title: 'Song Pháo', pieces: [red('general', 3, 7), black('general', 4, 1), black('cannon', 5, 6), black('cannon', 3, 5), red('advisor', 4, 8)] },
  { id: 'm1-6', moves: 1, toMove: 'red', title: 'Xe – Mã', pieces: [black('general', 3, 0), red('general', 5, 9), red('rook', 1, 2), red('horse', 5, 2), black('advisor', 5, 0), black('elephant', 4, 2)] },
  { id: 'm1-7', moves: 1, toMove: 'red', title: 'Xe – Pháo', pieces: [black('general', 3, 2), red('general', 4, 9), red('rook', 0, 6), red('cannon', 1, 4), black('advisor', 4, 1), black('rook', 3, 1), black('cannon', 1, 5)] },
  { id: 'm1-8', moves: 1, toMove: 'black', title: 'Xe – Pháo', pieces: [red('general', 5, 7), black('general', 5, 1), black('rook', 2, 5), black('cannon', 5, 3), black('advisor', 3, 2), red('elephant', 6, 9), red('advisor', 4, 8), red('elephant', 4, 7)] },
  { id: 'm2-1', moves: 2, toMove: 'red', title: 'Xe – Mã – Pháo', pieces: [black('general', 3, 2), red('general', 4, 7), red('rook', 8, 5), red('horse', 2, 1), red('cannon', 4, 4), red('advisor', 4, 8), black('elephant', 8, 2), black('horse', 5, 4), black('horse', 2, 5), black('cannon', 1, 2)] },
  { id: 'm2-2', moves: 2, toMove: 'black', title: 'Mã – Pháo – Tốt', pieces: [red('general', 3, 9), black('general', 3, 1), black('horse', 7, 8), black('cannon', 7, 3), black('pawn', 6, 9), red('horse', 0, 5), red('pawn', 3, 4)] },
  { id: 'm2-3', moves: 2, toMove: 'red', title: 'Xe – Mã', pieces: [black('general', 4, 0), red('general', 4, 9), red('rook', 7, 6), red('horse', 4, 1), black('rook', 0, 1), black('cannon', 6, 3), black('advisor', 5, 2), black('pawn', 1, 9)] },
  { id: 'm2-4', moves: 2, toMove: 'red', title: 'Mã – Pháo', pieces: [black('general', 3, 2), red('general', 4, 7), red('horse', 1, 4), red('cannon', 8, 2), red('advisor', 4, 8), black('advisor', 3, 0)] },
  { id: 'm2-5', moves: 2, toMove: 'black', title: 'Song Mã', pieces: [red('general', 4, 7), black('general', 3, 2), black('horse', 8, 6), black('horse', 4, 5), black('advisor', 4, 1), red('advisor', 5, 9)] },
  { id: 'm2-6', moves: 2, toMove: 'red', title: 'Song Xe', pieces: [black('general', 5, 0), red('general', 3, 7), red('rook', 3, 3), red('rook', 6, 2), red('advisor', 5, 7), black('elephant', 2, 0), black('elephant', 6, 0)] },
  { id: 'm2-7', moves: 2, toMove: 'red', title: 'Mã – Tốt', pieces: [black('general', 4, 0), red('general', 5, 7), red('horse', 7, 0), red('pawn', 3, 1), black('advisor', 3, 2), black('horse', 3, 0)] },
  { id: 'm2-8', moves: 2, toMove: 'black', title: 'Pháo – Tốt', pieces: [red('general', 3, 8), black('general', 5, 0), black('cannon', 6, 5), black('pawn', 3, 6), black('advisor', 5, 2), red('elephant', 2, 5)] },
  { id: 'm3-1', moves: 3, toMove: 'red', title: 'Mã – Pháo', pieces: [black('general', 5, 1), red('general', 4, 8), red('horse', 6, 4), red('cannon', 0, 5), red('advisor', 5, 7), black('elephant', 0, 2), black('advisor', 5, 0)] },
  { id: 'm3-2', moves: 3, toMove: 'black', title: 'Xe – Tốt', pieces: [red('general', 4, 9), black('general', 5, 2), black('rook', 0, 5), black('pawn', 6, 9), black('advisor', 4, 1), red('advisor', 3, 9), red('advisor', 3, 7)] },
  { id: 'm3-3', moves: 3, toMove: 'red', title: 'Xe – lộ mặt Tướng', pieces: [black('general', 5, 2), red('general', 3, 8), red('rook', 4, 0), black('pawn', 6, 7)] },
  { id: 'm3-4', moves: 3, toMove: 'red', title: 'Xe – Mã', pieces: [black('general', 4, 0), red('general', 3, 7), red('rook', 2, 5), red('horse', 5, 3), red('advisor', 3, 9), black('elephant', 2, 4), black('horse', 3, 5), black('elephant', 2, 0)] },
  { id: 'm3-5', moves: 3, toMove: 'black', title: 'Song Mã', pieces: [red('general', 5, 7), black('general', 3, 2), black('horse', 4, 7), black('horse', 1, 4), red('pawn', 7, 3), red('elephant', 2, 9)] },
  { id: 'm3-6', moves: 3, toMove: 'red', title: 'Song Xe', pieces: [black('general', 3, 0), red('general', 4, 7), red('rook', 6, 1), red('rook', 1, 3), black('rook', 2, 0), black('advisor', 3, 2), black('horse', 3, 3), black('cannon', 8, 4)] },
  { id: 'm3-7', moves: 3, toMove: 'red', title: 'Mã – Pháo', pieces: [black('general', 5, 0), red('general', 4, 9), red('horse', 8, 2), red('cannon', 6, 4), red('advisor', 3, 9), black('rook', 6, 1), black('elephant', 2, 0)] },
  { id: 'm3-8', moves: 3, toMove: 'black', title: 'Song Pháo – Mã', pieces: [red('general', 3, 7), black('general', 5, 1), black('cannon', 0, 3), black('cannon', 4, 4), black('horse', 4, 6), black('advisor', 3, 0), red('advisor', 3, 9), red('advisor', 4, 8), red('cannon', 6, 8)] },
]

export function getPuzzle(id) {
  return PUZZLES.find((puzzle) => puzzle.id === id) ?? null
}

// The puzzle after `id` in the list (wrapping to the first), for "Thế tiếp theo".
export function nextPuzzleId(id) {
  const index = PUZZLES.findIndex((puzzle) => puzzle.id === id)
  return PUZZLES[(index + 1) % PUZZLES.length].id
}
