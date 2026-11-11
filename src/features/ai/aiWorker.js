// Runs the bot's search off the main thread so the page never freezes while
// it thinks. Receives a position (plain data — postMessage copies it, so the
// game's real board can't be touched from here), answers with a move.
import { chooseMove } from './engine/search.js'
import { AI_LEVELS } from './engine/levels.js'

self.onmessage = (event) => {
  const { id, pieces, side, levelId, history } = event.data
  try {
    const level = AI_LEVELS[levelId] ?? AI_LEVELS.medium
    const result = chooseMove(pieces, side, { ...level, history })
    self.postMessage({ id, result })
  } catch (error) {
    self.postMessage({ id, error: error.message || String(error) })
  }
}
