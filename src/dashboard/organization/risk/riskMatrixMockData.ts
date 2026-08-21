import type { Risk } from "@/types/organization"

// PREVIEW-PROTO fixtures for RiskMatrixPreview.tsx. Category values match
// RISK_CATEGORIES' real keys (src/utils/riskConfig.ts) and severity is
// derived the same way the real app derives it (getRiskSeverityLevel,
// src/utils/riskScoring.ts: probability/inherent_score/residual_score are
// all a 0-100 scale, quartered at >75/>50/>25/else into
// critical/high/medium/low) so this mock set exercises every color band a
// real dataset would.

export const MOCK_SITES: { id: string; name: string; country?: string }[] = [
  { id: "site-lagos", name: "Lagos Distribution Hub", country: "Nigeria" },
  { id: "site-rotterdam", name: "Rotterdam Plant", country: "Netherlands" },
  { id: "site-austin", name: "Austin Data Center", country: "United States" },
  { id: "site-singapore", name: "Singapore Regional HQ", country: "Singapore" },
]

function makeRisk(partial: Partial<Risk> & Pick<Risk, "id" | "ref" | "name" | "description" | "category" | "site_id" | "probability" | "inherent_score" | "residual_score">): Risk {
  return {
    org_account_id: "org-demo",
    inherent_is_override: false,
    inherent_override_reason: null,
    inherent_overridden_by: null,
    inherent_overridden_at: null,
    inherent_override_stale: false,
    residual_is_override: false,
    residual_override_reason: null,
    residual_overridden_by: null,
    residual_overridden_at: null,
    residual_override_stale: false,
    pagerank_score: 0,
    financial_impact_min: 0,
    financial_impact_max: 0,
    impact: partial.inherent_score,
    velocity: "medium",
    trend: "stable",
    status: "open",
    ai_generated: false,
    is_edited: false,
    control_design_eff: 0,
    control_operating_eff: 0,
    ebitda_at_risk: null,
    ebitda_benchmark_sector: null,
    ebitda_benchmark_margin: null,
    ebitda_is_override: false,
    ebitda_override_reason: null,
    ebitda_overridden_by: null,
    ebitda_overridden_at: null,
    ebitda_override_stale: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    line_of_defense: "FIRST",
    legal_status: null,
    regulatory_framework_id: null,
    regulatory_citation_note: null,
    citation_confidence: null,
    internal_pilot: null,
    ai_generation_run_id: null,
    review_status: "APPROVED",
    ...partial,
  } as Risk
}

export const MOCK_RISKS: Risk[] = [
  makeRisk({
    id: "risk-1",
    ref: "CYB-014",
    name: "Ransomware exposure via unpatched VPN gateway",
    description:
      "Legacy VPN concentrator at the Singapore HQ is three major versions behind vendor patches, exposing a known remote-code-execution path used in recent ransomware campaigns.",
    category: "cyber",
    site_id: "site-singapore",
    probability: 82,
    inherent_score: 88,
    residual_score: 79,
    ai_generated: true,
  }),
  makeRisk({
    id: "risk-2",
    ref: "SUP-007",
    name: "Single-source dependency on Rotterdam resin supplier",
    description:
      "Over 70% of polymer resin for the Rotterdam plant comes from one supplier with no qualified backup, creating a hard production stop if that contract lapses.",
    category: "supply_chain",
    site_id: "site-rotterdam",
    probability: 55,
    inherent_score: 70,
    residual_score: 58,
  }),
  makeRisk({
    id: "risk-3",
    ref: "REG-022",
    name: "Pending EU deforestation regulation (EUDR) non-compliance",
    description:
      "Rotterdam plant's palm-derivative inputs are not yet traceable to plot-level origin as EUDR due-diligence requires ahead of the enforcement date.",
    category: "regulatory",
    site_id: "site-rotterdam",
    probability: 60,
    inherent_score: 65,
    residual_score: 52,
  }),
  makeRisk({
    id: "risk-4",
    ref: "OPS-031",
    name: "Single forklift fleet maintenance contractor at Lagos hub",
    description:
      "All material-handling equipment at the Lagos Distribution Hub is serviced under one contractor with no penalty clause for missed SLAs.",
    category: "operational",
    site_id: "site-lagos",
    probability: 45,
    inherent_score: 40,
    residual_score: 33,
  }),
  makeRisk({
    id: "risk-5",
    ref: "FIN-009",
    name: "USD/NGN currency exposure on imported spare parts",
    description:
      "Lagos hub sources critical spare parts in USD while revenue is collected in NGN, with no hedging instrument currently in place.",
    category: "financial",
    site_id: "site-lagos",
    probability: 70,
    inherent_score: 60,
    residual_score: 55,
  }),
  makeRisk({
    id: "risk-6",
    ref: "TEC-018",
    name: "Austin data center single-utility power feed",
    description:
      "The Austin facility runs on a single utility feed with generator backup rated for 8 hours; a longer outage would exceed failover capacity.",
    category: "technology",
    site_id: "site-austin",
    probability: 30,
    inherent_score: 72,
    residual_score: 61,
  }),
  makeRisk({
    id: "risk-7",
    ref: "HR-004",
    name: "Key-person dependency on sole certified crane operator",
    description:
      "Only one crane operator at the Rotterdam plant holds the required heavy-lift certification; no succession or cross-training plan exists.",
    category: "hr",
    site_id: "site-rotterdam",
    probability: 40,
    inherent_score: 35,
    residual_score: 30,
  }),
  makeRisk({
    id: "risk-8",
    ref: "EHS-011",
    name: "Confined-space entry procedure gaps at Lagos hub",
    description:
      "Recent internal audit found confined-space entry permits were not consistently logged for tank-cleaning work at the Lagos site.",
    category: "ehs",
    site_id: "site-lagos",
    probability: 35,
    inherent_score: 55,
    residual_score: 42,
  }),
  makeRisk({
    id: "risk-9",
    ref: "GEO-003",
    name: "Port congestion risk on Singapore transshipment lane",
    description:
      "Geopolitical tension in a key shipping lane has repeatedly forced rerouting of Singapore-bound transshipments, adding 5-9 days of transit delay.",
    category: "geopolitical",
    site_id: "site-singapore",
    probability: 50,
    inherent_score: 45,
    residual_score: 38,
  }),
  makeRisk({
    id: "risk-10",
    ref: "STR-002",
    name: "Overreliance on top-2 customers for 48% of Austin revenue",
    description:
      "Two enterprise customers together represent 48% of the Austin facility's contracted revenue, with no diversification plan tracked.",
    category: "strategic",
    site_id: "site-austin",
    probability: 25,
    inherent_score: 68,
    residual_score: 63,
  }),
  makeRisk({
    id: "risk-11",
    ref: "CMP-006",
    name: "ISO 27001 surveillance audit finding not yet remediated",
    description:
      "A minor nonconformity from the Singapore HQ's last ISO 27001 surveillance audit (access-review cadence) remains open past its committed close date.",
    category: "compliance",
    site_id: "site-singapore",
    probability: 20,
    inherent_score: 30,
    residual_score: 22,
  }),
  makeRisk({
    id: "risk-12",
    ref: "REP-001",
    name: "Social media scrutiny of Lagos hub community relations",
    description:
      "Local community groups have raised public concerns over noise levels from the Lagos hub's expanded night-shift operations.",
    category: "reputational",
    site_id: "site-lagos",
    probability: 28,
    inherent_score: 22,
    residual_score: 18,
  }),
]
