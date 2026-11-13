import { createSlice } from '@reduxjs/toolkit'
import { loadPuzzleProgress } from '../../features/puzzles/puzzleProgressStorage'

// Cờ thế progress per puzzle. "Đã giải" (solved) only comes from the player
// finding a win themselves; "Đã xem lời giải" (viewedSolution) is recorded
// separately and never counts as solved — but a puzzle whose solution was
// viewed can still be solved afterwards by playing it out unaided.
const puzzlesSlice = createSlice({
  name: 'puzzles',
  initialState: () => ({ progress: loadPuzzleProgress() }),
  reducers: {
    markPuzzleSolved: (state, action) => {
      const id = action.payload
      state.progress[id] = { viewedSolution: false, ...state.progress[id], solved: true }
    },
    markSolutionViewed: (state, action) => {
      const id = action.payload
      state.progress[id] = { solved: false, ...state.progress[id], viewedSolution: true }
    },
  },
})

export const selectPuzzleProgress = (state) => state.puzzles.progress

export const { markPuzzleSolved, markSolutionViewed } = puzzlesSlice.actions
export default puzzlesSlice.reducer
