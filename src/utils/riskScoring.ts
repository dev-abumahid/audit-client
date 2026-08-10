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

// `getRiskSeverityLevel`'s `Number(x) || 0` silently maps a missing or
// malformed score to 0 -- "low" severity, indistinguishable from a
// genuinely-confirmed low-risk score. First caught on RiskMatrixPage
// (aexa-frontend#636), then found unfixed at every other consumer of this
// function during a full-codebase audit -- most notably SitesEntities.tsx,
// where the same silent-0 fallback doesn't just mis-color a badge but can
// exclude a risk from the "critical risks" count entirely. Exported here
// (rather than reimplemented per-page, as RiskMatrixPage originally did)
// so every consumer flags an invalid score instead of trusting a computed
// severity that was never really computed.
// `Number(x)` alone isn't enough: `Number("")`, `Number(null)`, and
// `Number([])` all coerce to 0 (a *finite* number), so a naive
// `Number.isFinite(Number(x))` check would call an empty string or null
// "valid" -- exactly the malformed values this function exists to catch.
export function isValidScoreValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === "string" && value.trim() === "") return false
  if (Array.isArray(value)) return false
  return Number.isFinite(Number(value))
}

export function getRiskSeverityLevel(
  score: number | null | undefined
): RiskSeverityLevel {
  const value = Number(score) || 0
  if (value > 75) return "critical"
  if (value > 50) return "high"
  if (value > 25) return "medium"
  return "low"
}
