// Shape of aexa-server's POST /risk/suggest-fields response -- passthrough
// of aexa-ai's RiskFieldSuggestion (app/schemas/risk_field_suggestion_schema.py).
// A partial object: only fields the caller requested (or all of them, for
// the bulk pre-fill path) are present, and aexa-ai/aexa-server both drop
// any value that fails its own validation rather than send a bad one.
export interface RiskFieldSuggestion {
  probability?: number
  impact?: number
  velocity?: string
  trend?: string
  control_design_eff?: number
  control_operating_eff?: number
  financial_impact_min?: number
  financial_impact_max?: number
}

// quality-bar-loop round 5: aexa-server's POST /risk/suggest-fields
// response shape, updated from a bare RiskFieldSuggestion to this wrapper
// -- `rationale` carries a one-sentence reason per SUGGESTED field, keyed
// by field name (aexa-ai's own normalization only includes an entry here
// for a field that also made it into `suggestions`, so every key in
// `rationale` is guaranteed to also be a key in `suggestions`).
export interface RiskFieldSuggestionResult {
  suggestions: RiskFieldSuggestion
  rationale: Record<string, string>
}
