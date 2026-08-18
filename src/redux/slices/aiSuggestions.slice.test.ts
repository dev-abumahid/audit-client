import type { RiskSuggestion } from "@/types/ai"
import {
  aiSuggestionsReducer,
  removeSuggestion,
  toggleSuggestionSelected,
} from "./aiSuggestions.slice"

function makeSuggestion(overrides: Partial<RiskSuggestion> = {}): RiskSuggestion {
  return {
    risk_id: "sugg-1",
    title: "Supplier concentration",
    description: "Single supplier for a critical part",
    category: "Operational",
    site: "HQ",
    inherent_risk_score: "High",
    residual_risk_score: "Medium",
    Probability: 0.6,
    minimum_Impact: "€500K",
    maximum_impact: "€2M",
    Velocity: "fast",
    Trend: "increasing",
    Responsable: "Supply Chain Manager",
    score: 14,
    ...overrides,
  }
}

// aexa-frontend#922: dismiss's single-suggestion reducer, added alongside
// the existing (bulk, import-flow) removeImportedSuggestions -- see this
// reducer's own comment in aiSuggestions.slice.ts for why it's separate.
describe("aiSuggestions.slice removeSuggestion", () => {
  it("removes only the suggestion with the matching risk_id", () => {
    const state = {
      analyzingSiteId: "site-1",
      suggestions: [makeSuggestion({ risk_id: "sugg-1" }), makeSuggestion({ risk_id: "sugg-2" })],
      selectedSuggestionIds: [],
    }
    const next = aiSuggestionsReducer(state, removeSuggestion("sugg-1"))
    expect(next.suggestions.map((s) => s.risk_id)).toEqual(["sugg-2"])
  })

  it("also drops the removed id from selectedSuggestionIds", () => {
    const state = {
      analyzingSiteId: "site-1",
      suggestions: [makeSuggestion({ risk_id: "sugg-1" }), makeSuggestion({ risk_id: "sugg-2" })],
      selectedSuggestionIds: ["sugg-1", "sugg-2"],
    }
    const next = aiSuggestionsReducer(state, removeSuggestion("sugg-1"))
    expect(next.selectedSuggestionIds).toEqual(["sugg-2"])
  })

  it("leaves other selected ids untouched when the removed suggestion wasn't selected", () => {
    const state = {
      analyzingSiteId: "site-1",
      suggestions: [makeSuggestion({ risk_id: "sugg-1" }), makeSuggestion({ risk_id: "sugg-2" })],
      selectedSuggestionIds: ["sugg-2"],
    }
    const next = aiSuggestionsReducer(state, removeSuggestion("sugg-1"))
    expect(next.suggestions.map((s) => s.risk_id)).toEqual(["sugg-2"])
    expect(next.selectedSuggestionIds).toEqual(["sugg-2"])
  })

  it("is a no-op when the id doesn't match any suggestion", () => {
    const state = {
      analyzingSiteId: "site-1",
      suggestions: [makeSuggestion({ risk_id: "sugg-1" })],
      selectedSuggestionIds: [],
    }
    const next = aiSuggestionsReducer(state, removeSuggestion("does-not-exist"))
    expect(next.suggestions.map((s) => s.risk_id)).toEqual(["sugg-1"])
  })
})

// Sanity check that this test file's reducer wiring matches the existing
// slice (guards against a stale import if the slice's other reducers ever
// get renamed).
describe("aiSuggestions.slice toggleSuggestionSelected", () => {
  it("adds then removes an id on repeated toggles", () => {
    const initial = {
      analyzingSiteId: null,
      suggestions: [],
      selectedSuggestionIds: [],
    }
    const afterFirst = aiSuggestionsReducer(
      initial,
      toggleSuggestionSelected("sugg-1")
    )
    expect(afterFirst.selectedSuggestionIds).toEqual(["sugg-1"])
    const afterSecond = aiSuggestionsReducer(
      afterFirst,
      toggleSuggestionSelected("sugg-1")
    )
    expect(afterSecond.selectedSuggestionIds).toEqual([])
  })
})
