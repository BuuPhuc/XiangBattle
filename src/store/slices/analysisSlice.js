import { createSlice } from '@reduxjs/toolkit'
import { loadAnalyses, MAX_SAVED } from '../../features/analysis/analysisStorage.js'
import { ANALYSIS_VERSION } from '../../features/analysis/analysis.js'

// Phân tích ván results that finished, by game id (see analysisStorage.js) —
// what the Replay page shows straight away for a game analysed before.
const analysisSlice = createSlice({
  name: 'analysis',
  initialState: () => ({ byGameId: loadAnalyses() }),
  reducers: {
    // payload: { gameId, evals, savedAt } — savedAt passed in by the caller
    // (reducers stay pure), used to drop the oldest beyond MAX_SAVED.
    saveGameAnalysis: (state, action) => {
      const { gameId, evals, savedAt } = action.payload
      state.byGameId[String(gameId)] = { version: ANALYSIS_VERSION, savedAt, evals }
      const ids = Object.keys(state.byGameId)
      if (ids.length > MAX_SAVED) {
        ids
          .sort((a, b) => state.byGameId[a].savedAt - state.byGameId[b].savedAt)
          .slice(0, ids.length - MAX_SAVED)
          .forEach((id) => delete state.byGameId[id])
      }
    },
  },
})

export const selectGameAnalysis = (state, gameId) => state.analysis.byGameId[String(gameId)] ?? null

export const { saveGameAnalysis } = analysisSlice.actions
export default analysisSlice.reducer
