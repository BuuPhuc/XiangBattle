import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import settingsReducer from './slices/settingsSlice'
import puzzlesReducer from './slices/puzzlesSlice'
import analysisReducer from './slices/analysisSlice'
import { savePuzzleProgress } from '../features/puzzles/puzzleProgressStorage'
import { saveTimeControlId } from '../features/settings/timeControlStorage'
import { saveAnalyses } from '../features/analysis/analysisStorage'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    settings: settingsReducer,
    puzzles: puzzlesReducer,
    analysis: analysisReducer,
  },
})

// Cờ thế progress lives in this browser: save it whenever it changes.
// The picked online time control and finished game analyses too
// (timeControlStorage.js, analysisStorage.js).
let lastProgress = store.getState().puzzles.progress
let lastTimeControlId = store.getState().settings.timeControlId
let lastAnalyses = store.getState().analysis.byGameId
store.subscribe(() => {
  const state = store.getState()
  const progress = state.puzzles.progress
  if (progress !== lastProgress) {
    lastProgress = progress
    savePuzzleProgress(progress)
  }
  const timeControlId = state.settings.timeControlId
  if (timeControlId !== lastTimeControlId) {
    lastTimeControlId = timeControlId
    saveTimeControlId(timeControlId)
  }
  const analyses = state.analysis.byGameId
  if (analyses !== lastAnalyses) {
    lastAnalyses = analyses
    saveAnalyses(analyses)
  }
})

export default store
