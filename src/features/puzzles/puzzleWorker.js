// Runs the Cờ thế solver off the main thread, so judging a move (which
// searches every defence) never freezes the page. Plain data in and out —
// the page's own board can't be touched from here.
//   judge    { pieces, attacker, move, remaining } → { verdict, reply? }
//   hint     { pieces, attacker, remaining }       → { move }
//   solution { pieces, attacker, remaining }       → { line }
import { runPuzzleTask } from './engine/tasks.js'

self.onmessage = (event) => {
  const { id, type, payload } = event.data
  try {
    self.postMessage({ id, result: runPuzzleTask(type, payload) })
  } catch (error) {
    self.postMessage({ id, error: error.message || String(error) })
  }
}
