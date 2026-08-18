import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { RiskSuggestion } from "@/types/ai"

// aexa-frontend#924: SitesEntities.tsx previously held AI-suggested risks in
// component-local useState, discarded every time the page unmounted (e.g.
// navigating to a different route and back), forcing a full re-run of the
// (slow, costly) AI analysis to see the same suggestions again. This slice
// lives in the top-level store instead, so the result survives navigation
// within the app for the rest of the session -- same rationale as why
// user/externalUser live here rather than in a page component, just not
// persisted to localStorage since it's fine to lose on a hard reload.
interface AiSuggestionsState {
  analyzingSiteId: string | null
  suggestions: RiskSuggestion[]
  selectedSuggestionIds: string[]
}

const initialState: AiSuggestionsState = {
  analyzingSiteId: null,
  suggestions: [],
  selectedSuggestionIds: [],
}

const aiSuggestionsSlice = createSlice({
  name: "aiSuggestions",
  initialState,
  reducers: {
    startSiteAnalysis(state, action: PayloadAction<string>) {
      state.analyzingSiteId = action.payload
      state.suggestions = []
      state.selectedSuggestionIds = []
    },
    setSiteSuggestions(state, action: PayloadAction<RiskSuggestion[]>) {
      state.suggestions = action.payload
    },
    // Analysis failed -- hide the panel (matches the pre-existing
    // setAnalyzingSiteId(null) behavior in the catch block) without
    // touching suggestions, which was already cleared to [] at the start
    // of this analysis run.
    failSiteAnalysis(state) {
      state.analyzingSiteId = null
    },
    toggleSuggestionSelected(state, action: PayloadAction<string>) {
      const id = action.payload
      const idx = state.selectedSuggestionIds.indexOf(id)
      if (idx === -1) {
        state.selectedSuggestionIds.push(id)
      } else {
        state.selectedSuggestionIds.splice(idx, 1)
      }
    },
    // Drops only the suggestions that actually imported successfully (see
    // handleImportSuggestions's own comment on why a failed import must
    // stay visible for retry) and clears selection, mirroring the two
    // setState calls this replaces.
    removeImportedSuggestions(state, action: PayloadAction<string[]>) {
      const importedIds = new Set(action.payload)
      state.suggestions = state.suggestions.filter(
        (s) => !importedIds.has(s.risk_id)
      )
      state.selectedSuggestionIds = []
    },
  },
})

export const {
  startSiteAnalysis,
  setSiteSuggestions,
  failSiteAnalysis,
  toggleSuggestionSelected,
  removeImportedSuggestions,
} = aiSuggestionsSlice.actions
export const aiSuggestionsReducer = aiSuggestionsSlice.reducer
