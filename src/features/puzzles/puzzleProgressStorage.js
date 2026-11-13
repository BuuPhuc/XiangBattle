// Cờ thế progress, kept in this browser (guests and signed-in players
// alike): { [puzzleId]: { solved: boolean, viewedSolution: boolean } }.
// Read once when the Redux store is created (puzzlesSlice), written by the
// store subscription in store/index.js — never read during a render.
const KEY = 'xiangbattle_puzzle_progress'

export function loadPuzzleProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
    const clean = {}
    for (const [id, entry] of Object.entries(saved)) {
      if (entry && typeof entry === 'object') {
        clean[id] = { solved: entry.solved === true, viewedSolution: entry.viewedSolution === true }
      }
    }
    return clean
  } catch {
    return {}
  }
}

export function savePuzzleProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {
    // No storage (private mode, blocked site data): progress lasts this visit only.
  }
}
