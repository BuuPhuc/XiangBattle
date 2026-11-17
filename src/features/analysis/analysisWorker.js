// Runs Phân tích ván off the main thread: one bot search per position of the
// game, posting each result as soon as it's ready so the page can fill in
// while the rest is still being worked out. Stopping = terminating the worker.
//   in:  { moveHistory }  (the replay's reconstructed moves — plain data)
//   out: { type: 'progress', index, evaluation } per position, in order,
//        then { type: 'done' }; or { type: 'error', message }
import { gamePositions, analyzePosition } from './analysis.js'

self.onmessage = (event) => {
  try {
    const { moveHistory } = event.data
    const positions = gamePositions(moveHistory)
    for (let index = 0; index < positions.length; index++) {
      const evaluation = analyzePosition(positions, index, moveHistory[index] ?? null)
      self.postMessage({ type: 'progress', index, evaluation })
    }
    self.postMessage({ type: 'done' })
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || String(error) })
  }
}
