// Finished game analyses, kept in this browser so reopening a game shows its
// analysis at once instead of running the bot again:
//   { [gameId]: { version, savedAt, evals } }
// A saved game never changes, so an analysis stays valid — unless the
// analysis itself changed (ANALYSIS_VERSION), which drops the old ones.
// Only the most recent MAX_SAVED are kept (~6 KB each).
//
// Read once when the Redux store is created (analysisSlice), written by the
// store subscription in store/index.js — never read during a render.
import { ANALYSIS_VERSION } from './analysis.js'

const KEY = 'xiangbattle_game_analysis'
export const MAX_SAVED = 20

const isEvaluation = (e) => e && typeof e === 'object' && Number.isFinite(e.score)

export function loadAnalyses() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
    const clean = {}
    for (const [gameId, entry] of Object.entries(saved)) {
      if (
        entry &&
        entry.version === ANALYSIS_VERSION &&
        Number.isFinite(entry.savedAt) &&
        Array.isArray(entry.evals) &&
        entry.evals.every(isEvaluation)
      ) {
        clean[gameId] = { version: entry.version, savedAt: entry.savedAt, evals: entry.evals }
      }
    }
    return clean
  } catch {
    return {}
  }
}

export function saveAnalyses(byGameId) {
  try {
    localStorage.setItem(KEY, JSON.stringify(byGameId))
  } catch {
    // No storage, or full: the analysis lasts this visit only.
  }
}
