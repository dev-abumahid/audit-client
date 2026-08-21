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

// 9 risks, 7 open / 2 closed -- the "Active Risks" KPI card reads
// risks.filter(r => r.status === "open").length, so this set is what makes
// that card show 7, not a hand-typed number living somewhere else.
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
    ref: "REG-022",
    name: "Pending EU deforestation regulation (EUDR) non-compliance",
    description:
      "Rotterdam plant's palm-derivative inputs are not yet traceable to plot-level origin as EUDR due-diligence requires ahead of the enforcement date.",
    category: "regulatory",
    site_id: "site-rotterdam",
    probability: 60,
    inherent_score: 65,
    residual_score: 52,
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
    ref: "FIN-009",
    name: "USD/NGN currency exposure on imported spare parts",
    description:
      "Lagos hub sources critical spare parts in USD while revenue is collected in NGN, with no hedging instrument currently in place.",
    category: "financial",
    site_id: "site-lagos",
    probability: 70,
    inherent_score: 60,
    residual_score: 55,
    status: "open",
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
    status: "open",
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
    status: "open",
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
    status: "closed",
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
    status: "closed",
  }),
]

// RiskLink edges feeding the Tipping Points / PageRank section. CYB-014 is
// the deliberate hub here (three risks point at it via CAUSES/AMPLIFIES),
// matching the earlier-remediated-first item's own real-world plausibility
// (a VPN compromise plausibly amplifies supply-chain and financial risk at
// the sites it touches).
export const MOCK_RISK_LINKS: RiskLink[] = [
  {
    id: "link-1",
    org_account_id: "org-demo",
    source_ref: "SUP-007",
    target_ref: "CYB-014",
    link_type: "AMPLIFIES",
    createdAt: "2026-06-15T00:00:00.000Z",
  },
  {
    id: "link-2",
    org_account_id: "org-demo",
    source_ref: "FIN-009",
    target_ref: "CYB-014",
    link_type: "CAUSES",
    createdAt: "2026-06-16T00:00:00.000Z",
  },
  {
    id: "link-3",
    org_account_id: "org-demo",
    source_ref: "GEO-003",
    target_ref: "CYB-014",
    link_type: "CORRELATES",
    createdAt: "2026-06-17T00:00:00.000Z",
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
    risk_id: "risk-5",
    name: "USD/NGN hedge coverage ratio",
    owner: "Treasury",
    unit: "%",
    current_value: 12,
    alert_threshold: 30,
    target_value: 60,
    frequency: "monthly",
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
    risk_id: "risk-6",
    name: "Austin generator failover test pass rate",
    owner: "Facilities",
    unit: "%",
    current_value: 96,
    alert_threshold: 90,
    target_value: 100,
    frequency: "quarterly",
    createdAt: "2025-09-01T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    status: "OK",
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
    title: "USD/NGN hedge coverage fell to 12%, below the 30% threshold",
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
    title: "EUDR traceability obligation due in 30 days",
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
    actionTitle: "Draft EUDR plot-level traceability plan",
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
    actionTitle: "Set up USD/NGN forward contract hedge",
    status: "IN_PROGRESS",
    priority: "High",
  }),
  makeFinding({
    id: "action-6",
    actionTitle: "Cross-train second Austin facilities engineer",
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

// EBITDA-at-risk distribution: 7 of the 9 mock risks (risksWithData) carry
// a computed value, matching MOCK_RISKS' own 9-risk total (risksTotal).
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
  risksWithData: 7,
  risksTotal: 9,
}
