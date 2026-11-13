import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import settingsReducer from './slices/settingsSlice'
import puzzlesReducer from './slices/puzzlesSlice'
import { savePuzzleProgress } from '../features/puzzles/puzzleProgressStorage'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    settings: settingsReducer,
    puzzles: puzzlesReducer,
  },
})

// Cờ thế progress lives in this browser: save it whenever it changes.
let lastProgress = store.getState().puzzles.progress
store.subscribe(() => {
  const progress = store.getState().puzzles.progress
  if (progress !== lastProgress) {
    lastProgress = progress
    savePuzzleProgress(progress)
  }
})

export default store
