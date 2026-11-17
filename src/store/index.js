import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import settingsReducer from './slices/settingsSlice'
import puzzlesReducer from './slices/puzzlesSlice'
import { savePuzzleProgress } from '../features/puzzles/puzzleProgressStorage'
import { saveTimeControlId } from '../features/settings/timeControlStorage'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    settings: settingsReducer,
    puzzles: puzzlesReducer,
  },
})

// Cờ thế progress lives in this browser: save it whenever it changes.
// The picked online time control too (timeControlStorage.js).
let lastProgress = store.getState().puzzles.progress
let lastTimeControlId = store.getState().settings.timeControlId
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
})

export default store
