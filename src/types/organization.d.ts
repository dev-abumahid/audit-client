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
  organization_id: string
  user_id: string
  name: string
  location: string | null
  country: string | null
  activity: string | null
  revenue: number
  employees_count: number
  site_type: string
  risk_level: string
  is_active: boolean
  ai_generated: boolean
  is_edited: boolean
  custom_fields: Record<string, unknown>
  lat: number | null
  lng: number | null
  certifications: string[]
  is_headquarters: boolean
  revenue_contribution: number
  created_at: string
  updated_at: string
}

export interface Risk {
  id: string
  organization_id: string
  user_id: string
  ref: string
  name: string
  description: string | null
  category: string
  inherent_score: number
  residual_score: number
  pagerank_score: number
  is_tipping_point: boolean
  financial_impact_min: number
  financial_impact_max: number
  probability: number
  velocity: string
  trend: string
  status: string
  owner: string | null
  color_hex: string
  ai_generated: boolean
  is_edited: boolean
  site_id: string | null
  source_info: string | null
  control_design_eff: number
  control_operating_eff: number
  created_at: string
  updated_at: string
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

export interface KRI {
  id: string
  organization_id: string
  user_id: string
  risk_ref: string
  name: string
  unit: string | null
  current_value: number
  alert_threshold: number
  target_value: number
  status: "ok" | "warning" | "alert"
  trend: number[]
  frequency: string
  is_edited: boolean
  created_at: string
  updated_at: string
}

export interface Alert {
  id: string
  organization_id: string
  user_id: string
  source: string
  type: string | null
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string | null
  relevance_score: number
  matched_risks: string[]
  country: string | null
  is_read: boolean
  ai_generated: boolean
  is_edited: boolean
  created_at: string
}

export interface AuditEngagement {
  id: string
  organization_id: string
  user_id: string
  ref: string
  title: string
  scope: string | null
  status: "planned" | "in_progress" | "completed"
  lead_auditor: string | null
  priority_score: number
  findings_count: number
  started_at: string | null
  closed_at: string | null
  ai_generated: boolean
  is_edited: boolean
  linked_risk_refs: string[]
  report_url: string | null
  created_at: string
  updated_at: string
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

export interface ComplianceObligation {
  id: string
  organization_id: string
  user_id: string
  regulation: string
  jurisdiction: string | null
  description: string | null
  deadline: string | null
  status: "compliant" | "partial" | "non_compliant" | "pending"
  penalty_estimate: number
  owner: string | null
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
