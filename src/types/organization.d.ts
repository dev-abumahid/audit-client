// Issue #97 — "Three Lines of Defense" governance classification. Verified
// against the live aexa-server source (kri.validation.ts / risk.validation.ts
// / action.validation.ts's LINE_OF_DEFENSE_ENUM). Risk and Kri always have a
// value (DB defaults FIRST / SECOND respectively); it's nullable only on
// Action (see finding.d.ts's IAction).
export type LineOfDefense = "FIRST" | "SECOND" | "THIRD"

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
// lat, lng entirely. There is no single-site GET endpoint on the frontend to
// fall back on for those fields, so a list row's site_type/lat/lng are
// always absent, not just possibly-null — SitesEntities.tsx's edit form
// pre-fill for site_type silently falls back to its "production" default
// for every site as a result. Modeled as optional (rather than adding a
// separate non-overlapping type) so existing `site.site_type || "..."`
// fallback call sites keep compiling; confirmed against the real backend
// select, not guessed. Worth a backend ticket to widen the list select if
// the edit form's pre-fill accuracy ever matters.
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
  name: string
  description: string
  category: string
  inherent_score: number
  residual_score: number
  pagerank_score: number
  financial_impact_min: number
  financial_impact_max: number
  probability: number
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

export interface RiskLink {
  id: string
  organization_id: string
  user_id: string
  source_ref: string
  target_ref: string
  link_type: "CAUSES" | "AMPLIFIES" | "CORRELATES"
  strength: number
  created_at: string
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
