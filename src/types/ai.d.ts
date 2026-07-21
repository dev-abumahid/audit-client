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
