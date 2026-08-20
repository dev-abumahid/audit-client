import type { IAction } from "./finding"

// Issue #97 — "Three Lines of Defense" governance classification. Verified
// against the live aexa-server source (kri.validation.ts / risk.validation.ts
// / action.validation.ts's LINE_OF_DEFENSE_ENUM). Risk and Kri always have a
// value (DB defaults FIRST / SECOND respectively); it's nullable only on
// Action (see finding.d.ts's IAction).
//
// aexa-frontend#208/#209: GOVERNING_BODY added on top of the original three
// values, matching the 2020 IIA Three Lines Model's headline structural
// addition over the 2013 Three Lines of Defense (which #97 originally
// modeled) -- an explicit governing body sitting above the three lines, to
// which internal audit reports directly and independently of management
// (confirmed against the IIA's own published materials). No existing
// entity's default changes; this is purely an additional explicit
// selection for items that genuinely sit at governing-body oversight.
export type LineOfDefense = "FIRST" | "SECOND" | "THIRD" | "GOVERNING_BODY"

export interface Organization {
  id: string
  user_id: string
  name: string
  sector: string | null
  country_hq: string | null
  revenue_estimate: number | null
  ebitda: number | null
  employees_count: number | null
  currency: string
  ai_analysis: Record<string, unknown> | null
  dismissed_risk_refs: string[] | null
  appetite_policy: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Site {
  id: string
  org_account_id?: string
  name: string
  location?: string | null
  country?: string | null
  activity?: string | null
  // docs/design-docs/site-ai-risk-register-generation.md §3 -- fed into
  // the AI risk-generation prompt. Only present on the full-detail row
  // (GET /site/:id), same "list select is narrower" pattern as
  // site_type/lat/lng below (see SiteSummary's own comment).
  description?: string | null
  revenue: number
  employees_count: number
  site_type: string
  lat?: number | null
  lng?: number | null
  createdAt: string
  updatedAt: string
}

// GET /site's list `select` (see aexa-server site.service.ts
// get_all_site_from_db) is narrower than the full Site row returned by
// single-resource create/update/delete: it omits org_account_id, site_type,
// lat, lng entirely, so a list row's site_type/lat/lng are always absent,
// not just possibly-null. Modeled as optional (rather than adding a
// separate non-overlapping type) so existing `site.site_type || "..."`
// fallback call sites keep compiling; confirmed against the real backend
// select, not guessed.
//
// GET /site/:id (site_service.get_single_site_from_db) does return the full
// row, including site_type/lat/lng -- SitesEntities.tsx's openEdit fetches
// it (useLazyGetSiteByIdQuery) before showing the edit modal so site_type's
// pre-fill reflects the real stored value instead of always falling back to
// "production" (aexa-frontend#401).
export interface SiteSummary {
  id: string
  name: string
  location?: string | null
  country?: string | null
  activity?: string | null
  revenue: number
  employees_count: number
  site_type?: string
  lat?: number | null
  lng?: number | null
  createdAt: string
  updatedAt: string
}

export interface Risk {
  id: string
  org_account_id: string
  // aexa-frontend#142: human-readable reference code (e.g. "CYB-001"),
  // backfilled for every pre-existing row -- always present, never optional.
  // See aexa-server prisma/schema/risk.prisma's Risk.ref comment.
  ref: string
  name: string
  description: string
  category: string
  inherent_score: number
  // aexa-frontend#269 -- derive-with-override-and-staleness pattern, mirroring
  // aexa-server#247's inherent_score. Confirmed against the real
  // prisma/schema/risk.prisma Risk model: the four override-metadata columns
  // are all nullable (no override yet is the common case), the two booleans
  // both default to false. `inherent_overridden_by` is the raw accountId of
  // the overriding user (a plain string column, not an Account relation) --
  // there is no server endpoint to resolve it to a display name, matching the
  // same constraint CompliancePage.tsx's attested_by rendering already
  // documents for RiskApproval's submittedById/decidedById.
  inherent_is_override: boolean
  inherent_override_reason: string | null
  inherent_overridden_by: string | null
  inherent_overridden_at: string | null
  inherent_override_stale: boolean
  residual_score: number
  // aexa-frontend#269 -- same derive-with-override-and-staleness pattern,
  // mirroring aexa-server#241's residual_score. Same field shapes as the
  // inherent_* set above.
  residual_is_override: boolean
  residual_override_reason: string | null
  residual_overridden_by: string | null
  residual_overridden_at: string | null
  residual_override_stale: boolean
  pagerank_score: number
  financial_impact_min: number
  financial_impact_max: number
  probability: number
  // aexa-server#241: the real, independently-collected severity/impact axis
  // (0-100, same scale as probability) -- was missing from this type
  // entirely even though the backend model has had it since #241; added now
  // because aexa-server#347's EBITDA-at-risk formula maps the CEO's
  // "Severite" term onto this exact field (see aexa-server ebitda_risk.ts).
  impact: number
  velocity: string
  trend: string
  status: string
  ai_generated: boolean
  is_edited: boolean
  site_id: string
  site?: Site
  source_info?: string
  control_design_eff: number
  control_operating_eff: number
  // aexa-server#347 -- EBITDA-at-risk, same derive-with-override-and-
  // staleness shape as inherent/residual_score above. ebitda_at_risk is the
  // computed currency amount (CA du site x Marge benchmark x Probabilite x
  // Severite); ebitda_benchmark_sector/margin describe which sector
  // benchmark was used (or overridden to). See aexa-server's
  // prisma/schema/risk.prisma Risk model / ebitda_risk.ts for the full
  // writeup. All null until the risk has a resolvable site revenue +
  // probability + impact.
  ebitda_at_risk: number | null
  ebitda_benchmark_sector: string | null
  ebitda_benchmark_margin: number | null
  ebitda_is_override: boolean
  ebitda_override_reason: string | null
  ebitda_overridden_by: string | null
  ebitda_overridden_at: string | null
  ebitda_override_stale: boolean
  createdAt: string
  updatedAt: string
  // aexa-frontend#95: maker-checker approval state for this risk's current
  // assessment. Both are appended by GET /risk (the list serializer), not
  // stored columns — see risk.service.ts's get_all_risk_from_db. Optional
  // because other endpoints returning a Risk (create/update/single) don't
  // attach them.
  approval?: RiskApproval | null
  approvalStatus?: RiskApprovalDisplayState
  // Issue #97. Always set — DB default is FIRST for pre-existing rows.
  line_of_defense: LineOfDefense
  // docs/design-docs/site-ai-risk-register-generation.md §3: AI risk
  // register generation fields, added to the Prisma model in
  // aexa-server#369 but not previously surfaced anywhere in the frontend
  // type -- every Risk row already carries these (null on a manually
  // created risk), they just weren't typed/exported yet. legal_status
  // replaces a flawed binary mandatory/voluntary distinction (see the
  // design doc's table for the 5-value taxonomy); citation_confidence is
  // "the single most important trust signal" per that doc's review notes.
  legal_status:
    | "active_statutory"
    | "pending_statutory"
    | "conditional_statutory"
    | "recognized_standard"
    | "voluntary_best_practice"
    | null
  regulatory_framework_id: string | null
  regulatory_citation_note: string | null
  citation_confidence: "curated_verified" | "ai_estimate" | "none" | null
  // AI-suggested role hint (e.g. "HSE Manager"), not a real user identity --
  // deliberate scope decision, design-docs §3/§8.
  internal_pilot: string | null
  ai_generation_run_id: string | null
  // docs/design-docs/ai-risk-review-approval-workflow.md -- distinct from
  // approvalStatus above (that's the maker-checker sign-off on an already-
  // confirmed risk's assessment; this is whether the risk exists as a
  // confirmed register entry at all yet). Manually-created risks and every
  // pre-existing row default to APPROVED; AI-generated risks start
  // PENDING_REVIEW.
  review_status: "APPROVED" | "PENDING_REVIEW" | "DISMISSED"
}

// Mirrors aexa-server's RiskApproval Prisma model (issue #95). A risk's
// approval cycle is a SEPARATE concept from its operational `status` string
// (open/in_progress/...): it tracks whether the current assessment has been
// reviewed and signed off.
export type RiskApprovalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED"

// The display state the UI badges off. NOT_SUBMITTED covers both "never
// submitted" and "was approved/pending but a later edit invalidated it, so it
// needs resubmission" — the backend collapses those into one state.
export type RiskApprovalDisplayState = "NOT_SUBMITTED" | RiskApprovalStatus

export interface RiskApproval {
  id: string
  riskId: string
  status: RiskApprovalStatus
  submittedById: string
  decidedById: string | null
  decidedAt: string | null
  decisionNote: string | null
  invalidatedAt: string | null
  invalidatedById: string | null
  createdAt: string
  updatedAt: string
}

// GET /risk/:id/approval response shape (get_risk_approval_state).
export interface RiskApprovalState {
  riskId: string
  status: RiskApprovalDisplayState
  approval: RiskApproval | null
}

export type RiskLinkType = "CAUSES" | "AMPLIFIES" | "CORRELATES"

// Confirmed against the real merged aexa-server model (aexa-frontend#142,
// prisma/schema/risk.prisma's RiskLink + risk_link.service.ts). The previous
// shape here (organization_id/user_id/strength/created_at) never matched any
// real endpoint -- RiskLink didn't exist server-side until this PR. Fixed
// now that it's real: org_account_id (not organization_id), no user_id (no
// per-user ownership on this model), no strength (Fullbloom's own RiskLink
// doesn't carry one either), createdAt (camelCase, matching every other
// Prisma model's timestamp field in this codebase).
export interface RiskLink {
  id: string
  org_account_id: string
  source_ref: string
  target_ref: string
  link_type: RiskLinkType
  createdAt: string
}

// GET /risk/correlation-matrix response shape (risk.correlation.service.ts's
// get_correlation_matrix_data): everything the page needs in one call.
export interface CorrelationMatrixData {
  risks: Risk[]
  riskLinks: RiskLink[]
  actions: IAction[]
}

// POST /risk/root-cause-bucketing response shape, confirmed against
// risk.correlation.service.ts's RootCauseRiskBucket/RootCauseFindingBucket/
// RootCauseBucketingAiResponse interfaces exactly.
export interface RootCauseGroupedAction {
  description: string
  normReference: string
  owner: string
  priority: "immediate" | "short_term" | "medium_term" | "long_term"
  estimatedRiskReduction: number
  estimatedCost: string
  timeline: string
}

export interface RootCauseRiskBucket {
  bucketName: string
  rootCause: string
  rootCauseCategory:
    | "governance"
    | "process"
    | "technology"
    | "people"
    | "external"
    | "compliance"
  category: string
  riskRefs: string[]
  pageRankScore: number
  aggregatedImpactMin: number
  aggregatedImpactMax: number
  groupedAction: RootCauseGroupedAction
  dominoRisk: string | null
}

export interface RootCauseFindingBucket {
  bucketName: string
  rootCause: string
  findingRefs: string[]
  commonAction: {
    description: string
    normReference: string
    owner: string
    priority: string
  }
}

export interface RootCauseBucketingResult {
  methodology: string
  riskBuckets: RootCauseRiskBucket[]
  findingBuckets: RootCauseFindingBucket[]
}

// Confirmed against the real Kri Prisma model + kri.service.ts (issue
// #108). The model has no organization_id/user_id/is_edited/trend columns
// at all -- those were never real, this interface just hadn't been checked
// against the backend before. `status` isn't a column either: every
// endpoint (list/single/create/update/submit-value) computes it at
// response time via with_status()/compute_kri_status() and appends it, so
// it's always present on data returned from the API even though it's not
// part of the underlying row -- delete_kri_from_db is the one exception,
// returning the bare deleted row with no status.
export interface KRI {
  id: string
  org_account_id: string
  risk_id: string
  name: string
  // Free-text owner name (who's responsible for this KRI), matching
  // ComplianceObligation.owner's convention on the backend -- not a link to
  // an OrgMember/Account record.
  owner: string | null
  unit: string
  current_value: number
  alert_threshold: number
  target_value: number
  frequency: string | null
  createdAt: string
  updatedAt: string
  status: "OK" | "WARNING" | "ALERT"
  // Issue #97. Always set — DB default is SECOND for pre-existing rows.
  line_of_defense: LineOfDefense
  // aexa-server#242 — when current_value was last recorded (set at
  // creation and on every value submission).
  last_measured_at: string | null
  // aexa-server#242 — computed on every read from frequency +
  // last_measured_at (never a stored column). Always false when frequency
  // is unset, since there's no cadence to be overdue against.
  overdue: boolean
}

// aexa-server#242 — an append-only history of every value a KRI has ever
// been recorded at, never updated/deleted once written. GET /kri/:id/readings
// returns these newest-first.
export interface KriReading {
  id: string
  org_account_id: string
  kri_id: string
  value: number
  recorded_at: string
}

// Confirmed against the real Alert Prisma model + alert.service.ts (issue
// #108). organization_id/user_id/relevance_score/matched_risks/country/
// is_edited have no backend counterpart -- CriticalAlertBanner.tsx used to
// sort by relevance_score, a field that was always undefined, so the sort
// was a silent no-op (alerts already arrive createdAt-desc from the
// backend). Also `created_at` was wrong casing -- the real column is
// `createdAt` like everywhere else.
export interface Alert {
  id: string
  org_account_id: string
  kri_id: string | null
  source: string
  type: string
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string | null
  is_read: boolean
  ai_generated: boolean
  createdAt: string
  updatedAt: string
}

export interface AuditFinding {
  id: string
  organization_id: string
  user_id: string
  engagement_id: string
  ref: string
  title: string
  criteria: string | null
  condition: string | null
  effect: string | null
  cause: string | null
  recommendation: string | null
  severity: string
  status: string
  owner: string | null
  due_date: string | null
  closed_at: string | null
  linked_risk_id: string | null
  link_type: string | null
  delta: number
  ai_generated: boolean
  is_edited: boolean
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  organization_id: string
  user_id: string
  type: string
  title: string
  content: Record<string, unknown> | null
  status: "draft" | "published"
  pages: number
  author: string | null
  ai_generated: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  avatar_url: string | null
  job_title: string | null
  created_at: string
  updated_at: string
}

export interface Mitigation {
  id: string
  organization_id: string
  user_id: string
  risk_id: string | null
  title: string
  description: string | null
  mitigation_type: string
  status: string
  priority: string
  owner: string | null
  cost_estimate: number
  effectiveness_score: number
  risk_reduction: number
  due_date: string | null
  completed_date: string | null
  is_ai_suggested: boolean
  is_edited: boolean
  created_at: string
  updated_at: string
}

// Monte Carlo result type
export interface MonteCarloResult {
  p5: number
  p50: number
  p95: number
  var95: number
  distribution: { bucket: string; count: number }[]
}

export type TInspection = {
  id: string
  orgAccountId: string
  templateId: string
  siteId: string
  inspectorProfileId: string | null

  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DRAFT"

  createdAt: string
  updatedAt: string

  template: {
    id: string
    templateName: string
  }
  site: {
    id: string
    name: string
  }
  inspector: {
    id: string
    fullName: string
  }
  questionAnswers: {
    id: string
    inspectionId: string
    questionId: string

    answer: string
    note: string | null

    mediaFiles: {
      url: string
      type: string
    }[]

    question: {
      id: string
      question: string
      answerType: string
      value: string
    }
  }[]
}

// Mirrors aexa-server's IntelligenceItem Prisma model (intelligence.prisma,
// aexa-frontend#141 stage 2/3). A scraped RSS article, persisted by
// POST /intelligence/scrape and annotated in-place by POST /intelligence/analyze.
// The analysis fields are all nullable/undefined until analyzed_at is set --
// analyzed_at is the single source of truth for "has this item been
// analyzed" (drives GET /items?analyzed= and hiding/showing the
// Create-Risk button). created_risk_id being non-null means this item has
// already been promoted -- hide Create-Risk, show a link to the Risk
// instead.
export interface IntelligenceItem {
  id: string
  org_account_id: string

  title: string
  description: string | null
  link: string | null
  source_name: string
  source_category: string | null
  source_credibility: number | null
  source_language: string | null
  published_at: string | null
  scraped_at: string

  is_risk: boolean | null
  severity: "critical" | "high" | "medium" | "low" | null
  category: string | null
  relevance_score: number | null
  risk_summary: string | null
  root_cause: string | null
  potential_impact: string | null
  recommended_actions:
    | { action: string; priority: string; norm_reference?: string | null }[]
    | null
  confidence: number | null
  source_evidence: string | null
  analyzed_at: string | null

  created_risk_id: string | null
}

// Mirrors aexa-server's IntelligenceRun Prisma model. One point-in-time
// result from one of the 4 org-level actions (predict/mitigations/rcsa/
// resilience-scan). `result` is the raw aexa-ai response for that
// run_type -- see aexa-ai's threat_intelligence_schema.py for the exact
// per-action response shape (PredictResponse / MitigationsResponse /
// RcsaResponse / ResilienceScanResponse). Kept as `unknown` here (narrowed
// with per-panel type guards in IntelligencePage.tsx) rather than a union,
// since the caller already knows which run_type it asked for.
export interface IntelligenceRun {
  id: string
  org_account_id: string
  run_type: "PREDICT" | "MITIGATIONS" | "RCSA" | "RESILIENCE_SCAN"
  result: unknown
  createdAt: string
}
