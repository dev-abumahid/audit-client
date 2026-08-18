// Shape of aexa-server's POST /ai/analyze-site-risks response — a direct
// passthrough of aexa-ai's RiskItem (app/schemas/risk_analysis_schema.py),
// field casing included, since the server doesn't reshape it. Confirmed
// against ai.validation.ts's risk_analysis_response zod schema, which
// aexa-server validates the upstream aexa-ai response against before
// returning it (issue #108).
export interface RiskSuggestion {
  risk_id: string
  title: string
  description: string
  category: string
  site: string
  inherent_risk_score: string
  residual_risk_score: string
  Probability: number
  minimum_Impact: string
  maximum_impact: string
  Velocity: string
  Trend: string
  Responsable: string
  score: number
}

// aexa-frontend#922: shape of the rows aexa-server persists for the
// AI-suggestion lifecycle (dismiss / mark-imported), one row per
// (siteId, fingerprint) pair, upserted on POST /ai/suggestions/dismiss and
// /ai/suggestions/mark-imported, listed via GET /ai/suggestions/site/:siteId.
export interface AiSuggestionState {
  id: string
  siteId: string
  fingerprint: string
  title: string
  category: string
  suggestion: RiskSuggestion
  status: "DISMISSED" | "IMPORTED"
  actedById: string
  actedAt: string
  createdAt: string
  updatedAt: string
}

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
