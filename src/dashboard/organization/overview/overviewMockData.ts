import type { EbitdaAtRiskSummary } from "@/redux/apis/organization/risk.api"
import type { IAction } from "@/types/finding"
import type { InspectionSummary } from "@/types/inspection"
import type {
  Alert,
  CorrelationMatrixData,
  KRI,
  Risk,
  RiskLink,
  SiteSummary,
} from "@/types/organization"

// PREVIEW-PROTO fixtures for OverviewPreview.tsx. Every KPI card on
// OverviewView is DERIVED from these arrays (counts/sums/filters), never a
// separately hand-typed number -- so the numbers below are the single
// source of truth for what the preview shows, and they can't drift out of
// sync with each other the way independently-typed placeholder numbers
// would. E.g. the "Active Risks" KPI card is `risks.filter(status===open).length`
// computed from MOCK_RISKS below, not a hardcoded "7" living somewhere
// else -- change a risk's status here and the KPI card updates with it.

export const MOCK_ORG_NAME = "Meridian Industrial Group"

export const MOCK_SITES: SiteSummary[] = [
  {
    id: "site-lagos",
    name: "Lagos Distribution Hub",
    country: "Nigeria",
    revenue: 3_200_000,
    employees_count: 140,
    site_type: "distribution",
    createdAt: "2025-01-10T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "site-rotterdam",
    name: "Rotterdam Plant",
    country: "Netherlands",
    revenue: 4_500_000,
    employees_count: 210,
    site_type: "manufacturing",
    createdAt: "2024-11-02T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "site-austin",
    name: "Austin Data Center",
    country: "United States",
    revenue: 1_800_000,
    employees_count: 45,
    site_type: "technology",
    createdAt: "2025-03-18T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "site-singapore",
    name: "Singapore Regional HQ",
    country: "Singapore",
    revenue: 2_100_000,
    employees_count: 68,
    site_type: "office",
    createdAt: "2025-06-05T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  },
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
      | "status"
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

// 12 risks (mirrors riskMatrixMockData.ts's own MOCK_RISKS exactly -- same
// real records, not a second independently-authored set, so the landing
// page's matrix/graph widgets and this file's own Overview KPI cards/
// correlation preview all agree on the same risks), 10 open / 2 closed --
// the "Active Risks" KPI card reads risks.filter(r => r.status ===
// "open").length, so this set is what makes that card show 10, not a
// hand-typed number living somewhere else.
//
// Rebuilt down to 3 categories -- cyber, operational, supply_chain -- see
// riskMatrixMockData.ts's own comment on MOCK_RISKS for the full reasoning
// (was 12 different categories, one per risk, which made the landing
// page's category legend an unreadable 12-swatch row).
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
    status: "open",
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
    status: "open",
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
    status: "open",
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
    status: "open",
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
    status: "open",
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
    status: "open",
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
    status: "open",
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
    status: "closed",
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
    status: "closed",
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
    status: "open",
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
    status: "open",
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
    status: "open",
  }),
]

// RiskLink edges feeding the Tipping Points / PageRank section, and the
// landing page's own correlation graph (RiskGraphWidget.tsx). Rebuilt
// alongside MOCK_RISKS above for real correlation depth -- 11 edges
// forming one connected tree (three real multi-hop chains, up to 3 hops
// deep) that all eventually feed into CYB-014, instead of the previous
// flat 3-edge star.
//
// Deliberately NOT built as several small islands (e.g. an isolated pair
// of risks correlating only with each other): PageRank concentrates a
// disconnected pair's rank between just those two nodes with nothing
// leaking out, which -- verified by computing this fixture's actual
// scores before settling on this shape -- let a same-site correlated
// PAIR outrank the real hub. Every risk here is reachable from CYB-014
// via at least one directed edge, keeping it the unambiguous top-
// PageRank node (real computed value ~0.20 vs. the runner-up's ~0.15,
// not a close call). CYB-014 itself still has zero outgoing edges --
// it's the graph's sink, matching how a systemic risk should accumulate
// rank rather than pass it along.
export const MOCK_RISK_LINKS: RiskLink[] = [
  {
    id: "link-1",
    org_account_id: "org-demo",
    source_ref: "CYB-009",
    target_ref: "CYB-014",
    link_type: "CAUSES",
    createdAt: "2026-06-14T00:00:00.000Z",
  },
  {
    id: "link-2",
    org_account_id: "org-demo",
    source_ref: "SUP-007",
    target_ref: "CYB-014",
    link_type: "AMPLIFIES",
    createdAt: "2026-06-15T00:00:00.000Z",
  },
  {
    id: "link-3",
    org_account_id: "org-demo",
    source_ref: "CYB-006",
    target_ref: "CYB-014",
    link_type: "AMPLIFIES",
    createdAt: "2026-06-16T00:00:00.000Z",
  },
  {
    id: "link-4",
    org_account_id: "org-demo",
    source_ref: "OPS-018",
    target_ref: "CYB-014",
    link_type: "AMPLIFIES",
    createdAt: "2026-06-17T00:00:00.000Z",
  },
  {
    id: "link-5",
    org_account_id: "org-demo",
    source_ref: "SUP-014",
    target_ref: "OPS-018",
    link_type: "CAUSES",
    createdAt: "2026-06-18T00:00:00.000Z",
  },
  {
    id: "link-6",
    org_account_id: "org-demo",
    source_ref: "OPS-031",
    target_ref: "OPS-011",
    link_type: "CORRELATES",
    createdAt: "2026-06-19T00:00:00.000Z",
  },
  {
    id: "link-7",
    org_account_id: "org-demo",
    source_ref: "OPS-011",
    target_ref: "CYB-006",
    link_type: "AMPLIFIES",
    createdAt: "2026-06-20T00:00:00.000Z",
  },
  {
    id: "link-8",
    org_account_id: "org-demo",
    source_ref: "SUP-003",
    target_ref: "SUP-002",
    link_type: "CORRELATES",
    createdAt: "2026-06-21T00:00:00.000Z",
  },
  {
    id: "link-9",
    org_account_id: "org-demo",
    source_ref: "SUP-002",
    target_ref: "SUP-007",
    link_type: "AMPLIFIES",
    createdAt: "2026-06-22T00:00:00.000Z",
  },
  {
    id: "link-10",
    org_account_id: "org-demo",
    source_ref: "OPS-004",
    target_ref: "OPS-009",
    link_type: "CORRELATES",
    createdAt: "2026-06-23T00:00:00.000Z",
  },
  {
    id: "link-11",
    org_account_id: "org-demo",
    source_ref: "OPS-009",
    target_ref: "OPS-018",
    link_type: "CORRELATES",
    createdAt: "2026-06-24T00:00:00.000Z",
  },
]

export const MOCK_CORRELATION_MATRIX_DATA: CorrelationMatrixData = {
  risks: MOCK_RISKS,
  riskLinks: MOCK_RISK_LINKS,
  actions: [],
}

// 5 KRIs, 2 in ALERT -- the "KRI Alerts" KPI card reads
// kris.filter(k => k.status === "ALERT").length.
export const MOCK_KRIS: KRI[] = [
  {
    id: "kri-1",
    org_account_id: "org-demo",
    risk_id: "risk-1",
    name: "Unpatched critical CVEs on internet-facing systems",
    owner: "Security Engineering",
    unit: "count",
    current_value: 14,
    alert_threshold: 5,
    target_value: 0,
    frequency: "weekly",
    createdAt: "2025-09-01T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    status: "ALERT",
    line_of_defense: "SECOND",
    last_measured_at: "2026-08-10T00:00:00.000Z",
    overdue: false,
  },
  {
    id: "kri-2",
    org_account_id: "org-demo",
    risk_id: "risk-2",
    name: "Resin supplier lead-time variance",
    owner: "Procurement",
    unit: "days",
    current_value: 18,
    alert_threshold: 21,
    target_value: 7,
    frequency: "monthly",
    createdAt: "2025-09-01T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    status: "WARNING",
    line_of_defense: "FIRST",
    last_measured_at: "2026-08-05T00:00:00.000Z",
    overdue: false,
  },
  {
    id: "kri-3",
    org_account_id: "org-demo",
    // Rebuilt to match risk-5's own rebuilt content (SUP-014, no
    // qualified backup enclosure supplier) -- was "USD/NGN hedge
    // coverage ratio," a theme that no longer exists anywhere in
    // MOCK_RISKS after the 3-category manufacturing rebuild.
    risk_id: "risk-5",
    name: "Qualified backup suppliers for critical enclosures",
    owner: "Procurement",
    unit: "count",
    current_value: 0,
    alert_threshold: 1,
    target_value: 2,
    frequency: "quarterly",
    createdAt: "2025-09-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    status: "ALERT",
    line_of_defense: "SECOND",
    last_measured_at: "2026-08-01T00:00:00.000Z",
    overdue: false,
  },
  {
    id: "kri-4",
    org_account_id: "org-demo",
    // Rebuilt to match risk-6's own rebuilt content (CYB-009,
    // unsegmented OT network) -- was "Austin generator failover test
    // pass rate," a facilities theme that no longer exists anywhere in
    // MOCK_RISKS after the 3-category manufacturing rebuild.
    risk_id: "risk-6",
    name: "OT/IT network segmentation coverage",
    owner: "IT Security",
    unit: "%",
    current_value: 65,
    alert_threshold: 50,
    target_value: 90,
    frequency: "quarterly",
    createdAt: "2025-09-01T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    // Review finding on PR #1044: higher-is-better here (target 90 >
    // alert 50, matching computeKriStatus's own direction convention in
    // src/utils/kriStatus.ts) -- 65 is neither >= target(90) nor
    // <= alert(50), so it's WARNING, not OK.
    status: "WARNING",
    line_of_defense: "FIRST",
    last_measured_at: "2026-07-20T00:00:00.000Z",
    overdue: false,
  },
  {
    id: "kri-5",
    org_account_id: "org-demo",
    risk_id: "risk-7",
    name: "Cross-trained heavy-lift operators",
    owner: "Rotterdam Ops",
    unit: "count",
    current_value: 1,
    alert_threshold: 2,
    target_value: 3,
    frequency: "quarterly",
    createdAt: "2025-09-01T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    status: "WARNING",
    line_of_defense: "FIRST",
    last_measured_at: "2026-07-15T00:00:00.000Z",
    overdue: false,
  },
]

// 6 alerts, 2 critical -- the "Critical Alerts" KPI card reads
// alerts.filter(a => a.severity === "critical").length. Recent Alerts shows
// the first 4 (createdAt-desc, matching what GET /alert returns).
export const MOCK_ALERTS: Alert[] = [
  {
    id: "alert-1",
    org_account_id: "org-demo",
    kri_id: "kri-1",
    source: "KRI Monitor",
    type: "threshold",
    severity: "critical",
    title: "Unpatched CVE count breached alert threshold (14 vs. 5)",
    description: null,
    is_read: false,
    ai_generated: false,
    createdAt: "2026-08-19T09:15:00.000Z",
    updatedAt: "2026-08-19T09:15:00.000Z",
  },
  {
    id: "alert-2",
    org_account_id: "org-demo",
    kri_id: "kri-3",
    source: "KRI Monitor",
    type: "threshold",
    severity: "critical",
    title:
      "Qualified backup enclosure suppliers fell to 0, below the 1-supplier threshold",
    description: null,
    is_read: false,
    ai_generated: false,
    createdAt: "2026-08-18T14:40:00.000Z",
    updatedAt: "2026-08-18T14:40:00.000Z",
  },
  {
    id: "alert-3",
    org_account_id: "org-demo",
    kri_id: null,
    source: "Risk AI",
    type: "new_risk",
    severity: "high",
    title: "New AI-generated risk flagged for Singapore HQ (CYB-014)",
    description: null,
    is_read: true,
    ai_generated: true,
    createdAt: "2026-08-17T08:00:00.000Z",
    updatedAt: "2026-08-17T08:00:00.000Z",
  },
  {
    id: "alert-4",
    org_account_id: "org-demo",
    kri_id: "kri-5",
    source: "KRI Monitor",
    type: "threshold",
    severity: "medium",
    title: "Cross-trained crane operators dropped below target (1 vs. 2)",
    description: null,
    is_read: true,
    ai_generated: false,
    createdAt: "2026-08-15T11:22:00.000Z",
    updatedAt: "2026-08-15T11:22:00.000Z",
  },
  {
    id: "alert-5",
    org_account_id: "org-demo",
    kri_id: null,
    source: "Compliance Monitor",
    type: "obligation_due",
    severity: "medium",
    title: "Backup enclosure supplier qualification review due in 30 days",
    description: null,
    is_read: true,
    ai_generated: false,
    createdAt: "2026-08-12T09:00:00.000Z",
    updatedAt: "2026-08-12T09:00:00.000Z",
  },
  {
    id: "alert-6",
    org_account_id: "org-demo",
    kri_id: "kri-2",
    source: "KRI Monitor",
    type: "threshold",
    severity: "low",
    title: "Resin supplier lead-time variance trending upward",
    description: null,
    is_read: true,
    ai_generated: false,
    createdAt: "2026-08-09T16:30:00.000Z",
    updatedAt: "2026-08-09T16:30:00.000Z",
  },
]

function makeFinding(
  partial: Partial<IAction> &
    Pick<IAction, "id" | "actionTitle" | "status" | "priority">
): IAction {
  return {
    orgAccountId: "org-demo",
    inspectionId: "insp-1",
    siteId: "site-lagos",
    questionId: null,
    actionDisc: null,
    dueDate: "2026-09-01T00:00:00.000Z",
    site: null,
    messages: [],
    assignBy: [],
    attachments: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  } as IAction
}

// 8 findings/actions -- TO_DO(3) + IN_PROGRESS(2) = 5 "Open Actions" on the
// KPI card (openActions reads status TO_DO or IN_PROGRESS), COMPLETE(2) and
// CANT_DO(1) are the terminal states the card deliberately excludes.
export const MOCK_FINDINGS: IAction[] = [
  makeFinding({
    id: "action-1",
    actionTitle: "Patch Singapore VPN concentrator to latest firmware",
    status: "TO_DO",
    priority: "High",
  }),
  makeFinding({
    id: "action-2",
    actionTitle: "Qualify backup resin supplier for Rotterdam plant",
    status: "TO_DO",
    priority: "High",
  }),
  makeFinding({
    id: "action-3",
    actionTitle:
      "Qualify second-source vendor for Austin control-panel enclosures",
    status: "TO_DO",
    priority: "Medium",
  }),
  makeFinding({
    id: "action-4",
    actionTitle: "Negotiate SLA penalty clause with forklift contractor",
    status: "IN_PROGRESS",
    priority: "Medium",
  }),
  makeFinding({
    id: "action-5",
    actionTitle: "Segment plant-floor PLCs from the Austin office LAN",
    status: "IN_PROGRESS",
    priority: "High",
  }),
  makeFinding({
    id: "action-6",
    actionTitle: "Complete OT/IT network segmentation rollout at Austin plant",
    status: "COMPLETE",
    priority: "Low",
  }),
  makeFinding({
    id: "action-7",
    actionTitle: "Re-log confined-space entry permits at Lagos hub",
    status: "COMPLETE",
    priority: "Medium",
  }),
  makeFinding({
    id: "action-8",
    actionTitle: "Evaluate alternate Singapore transshipment route",
    status: "CANT_DO",
    priority: "Low",
  }),
]

// 6 inspections -- DRAFT(1) + IN_PROGRESS(2) = 3 "Active Inspections" on the
// KPI card, COMPLETED(2)/CANCELLED(1) are the terminal states it excludes.
export const MOCK_INSPECTIONS: InspectionSummary[] = [
  {
    id: "insp-1",
    status: "DRAFT",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    template: { id: "tpl-1", templateName: "Fire Safety" },
    site: { id: "site-lagos", name: "Lagos Distribution Hub" },
    inspector: { id: "user-1", fullName: "Amara Okafor" },
  },
  {
    id: "insp-2",
    status: "IN_PROGRESS",
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    template: { id: "tpl-2", templateName: "ISO 27001 Access Review" },
    site: { id: "site-singapore", name: "Singapore Regional HQ" },
    inspector: { id: "user-2", fullName: "Wei Tan" },
  },
  {
    id: "insp-3",
    status: "IN_PROGRESS",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
    template: { id: "tpl-3", templateName: "Confined Space Entry" },
    site: { id: "site-lagos", name: "Lagos Distribution Hub" },
    inspector: { id: "user-1", fullName: "Amara Okafor" },
  },
  {
    id: "insp-4",
    status: "COMPLETED",
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    template: { id: "tpl-4", templateName: "Crane Operations Safety" },
    site: { id: "site-rotterdam", name: "Rotterdam Plant" },
    inspector: { id: "user-3", fullName: "Lars van Dijk" },
  },
  {
    id: "insp-5",
    status: "COMPLETED",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z",
    template: { id: "tpl-5", templateName: "Data Center Power Failover" },
    site: { id: "site-austin", name: "Austin Data Center" },
    inspector: { id: "user-4", fullName: "Priya Nair" },
  },
  {
    id: "insp-6",
    status: "CANCELLED",
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z",
    template: { id: "tpl-1", templateName: "Fire Safety" },
    site: { id: "site-rotterdam", name: "Rotterdam Plant" },
    inspector: { id: "user-3", fullName: "Lars van Dijk" },
  },
]

// EBITDA-at-risk distribution: 10 of the 12 mock risks (risksWithData) carry
// a computed value, matching MOCK_RISKS' own 12-risk total (risksTotal).
// Review finding: this stayed at the old 9-risk total after MOCK_RISKS grew
// to 12 during the manufacturing-categories rebuild -- risksTotal renders
// directly on the dashboard (OverviewView.tsx), so it would have visibly
// disagreed with the Active Risks KPI card right next to it.
export const MOCK_EBITDA_SUMMARY: EbitdaAtRiskSummary = {
  data: [
    { name: "P5", value: 14_200_000 },
    { name: "P10", value: 16_100_000 },
    { name: "P25", value: 18_500_000 },
    { name: "P50", value: 20_800_000 },
    { name: "P75", value: 22_400_000 },
    { name: "P90", value: 23_100_000 },
    { name: "P95", value: 23_800_000 },
  ],
  p5: 14_200_000,
  p50: 20_800_000,
  totalEstimatedEbitda: 22_000_000,
  risksWithData: 10,
  risksTotal: 12,
}
