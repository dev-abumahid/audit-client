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

function makeRisk(
  partial: Partial<Risk> &
    Pick<
      Risk,
      | "id"
      | "ref"
      | "name"
      | "description"
      | "category"
      | "site_id"
      | "probability"
      | "inherent_score"
      | "residual_score"
    >
): Risk {
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

// Rebuilt down to 3 categories -- cyber, operational, supply_chain -- the
// ones that actually recur for a manufacturing org, instead of the
// original spread across 12 different categories (one per risk), which
// made RiskGraphWidget's category legend an unreadable 12-swatch row for
// no real informational gain. Also deliberately more interlinked now (see
// MOCK_RISK_LINKS in overviewMockData.ts, the only place those live): 11
// real correlation edges forming one connected tree, up to 3 hops deep in
// places, instead of the previous flat star (3 edges, all pointing at one
// hub with no other structure between the other risks).
//
// CYB-014 and SUP-007 (risk-1/risk-2) are kept byte-for-byte identical:
// both are hard-pinned elsewhere (ConnectedDataModelSection's whole
// "click a risk, watch it show up everywhere" interaction plus its own
// mock audit finding/mitigation records, and MOCK_KRIS[0], all key off
// risk-1 specifically) and both already fit the 3-category set with no
// content changes needed.
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
    ref: "OPS-018",
    name: "Deferred preventive maintenance on the Rotterdam Line 3 stamping press",
    description:
      "The plant's highest-throughput stamping press is running past its scheduled service interval to avoid a planned production stop, raising the odds of an unplanned one instead.",
    category: "operational",
    site_id: "site-rotterdam",
    probability: 58,
    inherent_score: 62,
    residual_score: 50,
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
    ref: "SUP-014",
    name: "No qualified backup supplier for Austin control-panel enclosures",
    description:
      "The Austin facility's sole enclosure fabricator has an 11-week lead time; a disruption there halts every control-panel build behind it with no second source to fall back on.",
    category: "supply_chain",
    site_id: "site-austin",
    probability: 48,
    inherent_score: 58,
    residual_score: 45,
  }),
  makeRisk({
    id: "risk-6",
    ref: "CYB-009",
    name: "Unsegmented OT network exposes plant-floor PLCs to the office LAN",
    description:
      "Austin's production-line PLCs sit on the same flat network as office workstations, so a single compromised laptop can reach the plant-floor control systems directly.",
    category: "cyber",
    site_id: "site-austin",
    probability: 66,
    inherent_score: 75,
    residual_score: 63,
  }),
  makeRisk({
    id: "risk-7",
    ref: "OPS-004",
    name: "Key-person dependency on sole certified crane operator",
    description:
      "Only one crane operator at the Rotterdam plant holds the required heavy-lift certification; no succession or cross-training plan exists.",
    category: "operational",
    site_id: "site-rotterdam",
    probability: 40,
    inherent_score: 35,
    residual_score: 30,
  }),
  makeRisk({
    id: "risk-8",
    ref: "OPS-011",
    name: "Confined-space entry procedure gaps at Lagos hub",
    description:
      "Recent internal audit found confined-space entry permits were not consistently logged for tank-cleaning work at the Lagos site.",
    category: "operational",
    site_id: "site-lagos",
    probability: 35,
    inherent_score: 55,
    residual_score: 42,
  }),
  makeRisk({
    id: "risk-9",
    ref: "SUP-003",
    name: "Port congestion on the Singapore transshipment lane delays raw-material receipt",
    description:
      "Recurring congestion on Singapore-bound transshipments has added 5-9 days of transit delay to the raw-material lane feeding two downstream plants.",
    category: "supply_chain",
    site_id: "site-singapore",
    probability: 50,
    inherent_score: 45,
    residual_score: 38,
  }),
  makeRisk({
    id: "risk-10",
    ref: "SUP-002",
    name: "Single qualified vendor for Austin precision-machined components",
    description:
      "The tolerances Austin's assembly line requires are only currently qualified with one machining vendor, with no second source in the approved-supplier list.",
    category: "supply_chain",
    site_id: "site-austin",
    probability: 42,
    inherent_score: 60,
    residual_score: 55,
  }),
  makeRisk({
    id: "risk-11",
    ref: "CYB-006",
    name: "ISO 27001 surveillance audit finding on plant access review not yet remediated",
    description:
      "A minor nonconformity from the Singapore HQ's last ISO 27001 surveillance audit (plant-floor access-review cadence) remains open past its committed close date.",
    category: "cyber",
    site_id: "site-singapore",
    probability: 20,
    inherent_score: 30,
    residual_score: 22,
  }),
  makeRisk({
    id: "risk-12",
    ref: "OPS-009",
    name: "Manual work-order handoffs cause unplanned changeover downtime at Lagos hub",
    description:
      "Line changeovers at the Lagos hub are still coordinated by handwritten work orders passed between shifts, a common source of missed or duplicated setup steps.",
    category: "operational",
    site_id: "site-lagos",
    probability: 28,
    inherent_score: 40,
    residual_score: 33,
  }),
]
