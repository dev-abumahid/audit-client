// Risk.inherent_score/residual_score/probability are all documented as a
// 0-100 scale (aexa-ai's risk-generation prompts explicitly spec
// "inherent_risk_score: number 0-100" / "residual_risk_score: number 0-100"
// -- see app/prompts/threat_intelligence.py), not the 1-25 (5x5 likelihood x
// impact) scale a risk matrix band is more commonly quoted against. Four
// call sites (RiskMatrixPage, CorrelationMatrixPage, Overview,
// SitesEntities) each independently guessed a small-scale threshold set
// (>12/>8/>4, or >14/>10/>6) against this 0-100 data, so almost every real
// risk rendered as "critical". Centralized here on the real 0-100 scale,
// quartered evenly, so every consumer classifies severity consistently.
export type RiskSeverityLevel = "critical" | "high" | "medium" | "low"

export function getRiskSeverityLevel(
  score: number | null | undefined
): RiskSeverityLevel {
  const value = Number(score) || 0
  if (value > 75) return "critical"
  if (value > 50) return "high"
  if (value > 25) return "medium"
  return "low"
}
