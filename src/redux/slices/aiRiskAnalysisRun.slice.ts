import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

// Replaces the old aiSuggestions slice's role (aexa-frontend#924: survive
// in-session navigation away and back) with a much smaller shape -- the
// new flow's actual progress state lives server-side on the
// AiRiskAnalysisRun row, polled via aiRiskAnalysis.api.ts, so this only
// needs to remember WHICH run to keep polling, not any of its data.
// Single site at a time, same "only one panel realistically drives this at
// once" reasoning the old slice documented.
interface AiRiskAnalysisRunState {
  siteId: string | null
  runId: string | null
}

const initialState: AiRiskAnalysisRunState = {
  siteId: null,
  runId: null,
}

const aiRiskAnalysisRunSlice = createSlice({
  name: "aiRiskAnalysisRun",
  initialState,
  reducers: {
    setActiveAiRiskAnalysisRun(
      state,
      action: PayloadAction<{ siteId: string; runId: string }>
    ) {
      state.siteId = action.payload.siteId
      state.runId = action.payload.runId
    },
    clearActiveAiRiskAnalysisRun(state) {
      state.siteId = null
      state.runId = null
    },
  },
})

export const { setActiveAiRiskAnalysisRun, clearActiveAiRiskAnalysisRun } =
  aiRiskAnalysisRunSlice.actions
export const aiRiskAnalysisRunReducer = aiRiskAnalysisRunSlice.reducer
