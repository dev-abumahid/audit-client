// IntelligenceRun.result (aexa-frontend#141 stage 3) is typed `unknown` on
// the frontend (see src/types/organization.d.ts) because aexa-server stores
// aexa-ai's raw JSON response as-is, keyed only by run_type. These interfaces
// mirror aexa-ai's Pydantic response models exactly (app/schemas/
// threat_intelligence_schema.py, PredictResponse / MitigationsResponse /
// RcsaResponse / ResilienceScanResponse) -- confirmed against the real
// schema in a fresh clone of aexa-ai's main branch, not guessed. The type
// guards below are the only place `result: unknown` gets narrowed, so a
// malformed/older run row fails the guard and the panel falls back to an
// empty state instead of throwing on missing fields.

export interface EmergingRisk {
  title: string
  category: string
  probability: number
  estimated_impact: string
  early_indicators: string[]
}

export interface PredictResult {
  score_7d: number
  score_30d: number
  trend: "worsening" | "stable" | "improving"
  confidence: number
  emerging_risks: EmergingRisk[]
  key_drivers: string[]
  board_summary: string
}

export const isPredictResult = (value: unknown): value is PredictResult =>
  !!value &&
  typeof value === "object" &&
  typeof (value as PredictResult).score_7d === "number" &&
  typeof (value as PredictResult).score_30d === "number" &&
  typeof (value as PredictResult).trend === "string" &&
  Array.isArray((value as PredictResult).emerging_risks) &&
  // Round-1 review of PR #842: this panel now also renders key_drivers,
  // but the guard never validated it -- a row missing/null key_drivers
  // used to pass this guard and then crash on `.length` in the panel.
  Array.isArray((value as PredictResult).key_drivers)

export interface MitigationAction {
  title: string
  description: string
  mitigation_type: "prevent" | "detect" | "correct" | "transfer" | "accept"
  owner: string
  priority: "critical" | "high" | "medium" | "low"
  norm_reference?: string | null
  effectiveness_score: number
  risk_reduction: number
}

export interface RiskMitigations {
  risk_id: string
  risk_name: string
  actions: MitigationAction[]
}

export interface MitigationsResult {
  mitigations: RiskMitigations[]
}

export const isMitigationsResult = (
  value: unknown
): value is MitigationsResult =>
  !!value &&
  typeof value === "object" &&
  Array.isArray((value as MitigationsResult).mitigations) &&
  (value as MitigationsResult).mitigations.every(
    (entry) => !!entry && Array.isArray(entry.actions)
  )

export interface RiskUniverseEntry {
  risk_category: string
  inherent_risk_score: number
  control_effectiveness: number
  residual_risk_score: number
  control_gaps: string[]
  recommended_controls: string[]
}

export interface RcsaResult {
  rcsa_date: string
  assessment_period: string
  risk_universe: RiskUniverseEntry[]
  control_environment_score: number
  overall_risk_appetite: string
  key_control_deficiencies: string[]
  management_actions: string[]
}

export const isRcsaResult = (value: unknown): value is RcsaResult =>
  !!value &&
  typeof value === "object" &&
  Array.isArray((value as RcsaResult).risk_universe) &&
  Array.isArray((value as RcsaResult).key_control_deficiencies) &&
  // Round-1 review of PR #842: this panel now also renders
  // management_actions, but the guard never validated it -- a row
  // missing/null management_actions used to pass this guard and then
  // crash on `.length` in the panel.
  Array.isArray((value as RcsaResult).management_actions)

export interface ImmediateAlert {
  type: string
  severity: "critical" | "high" | "medium"
  title: string
  description: string
  source: string
  affected_sites: string[]
  corrective_action: string
  financial_impact?: string | null
}

export interface ResilienceScore {
  overall: number
  supply_chain: number
  financial: number
  geopolitical: number
  trend: "improving" | "stable" | "deteriorating"
  top_vulnerabilities: string[]
}

// The full ResilienceScanResponse also carries daily_plan/monthly_horizon/
// quarterly_vision/market_indicators (raw-material prices, energy, contract
// renewals, supply-chain pivots...). Deliberately out of scope for this
// panel's first render: the top-level resilience_score + immediate_alerts
// already surface the actionable signal a risk team needs at a glance, and
// rendering the full nested horizon breakdown would make this one panel
// larger than the rest of the page combined. Flagged in the PR description
// as a scope call, not an oversight -- easy to extend once product wants the
// deeper drill-down.
export interface ResilienceScanResult {
  analysis_date: string
  company_context: string
  immediate_alerts: ImmediateAlert[]
  resilience_score: ResilienceScore
}

export const isResilienceScanResult = (
  value: unknown
): value is ResilienceScanResult =>
  !!value &&
  typeof value === "object" &&
  Array.isArray((value as ResilienceScanResult).immediate_alerts) &&
  !!(value as ResilienceScanResult).resilience_score &&
  typeof (value as ResilienceScanResult).resilience_score.overall === "number" &&
  Array.isArray(
    (value as ResilienceScanResult).resilience_score.top_vulnerabilities
  )
