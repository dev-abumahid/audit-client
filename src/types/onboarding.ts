// Types for the zero-input onboarding wizard (#96). Mirror the aexa-server
// onboarding module's request/response shapes.

export interface OnboardingSiteInfo {
  site_name?: string | null
  site_location?: string | null
  site_legal_entity?: string | null
  site_primary_activity?: string | null
  site_country?: string | null
  site_revenue?: string | null
  site_employees?: string | null
  site_type?: string | null
  source_info?: string | null
}

// Stage 1 (Identify) proposal. Each identity field carries a source snippet
// so the confirm screen can show why the value was proposed.
export interface CompanyProfile {
  sector: string | null
  sector_source: string | null
  hq_country: string | null
  hq_country_source: string | null
  employee_band: string | null
  employee_band_source: string | null
  sites: number
  country: string
  number_of_employe: number
  sites_information: OnboardingSiteInfo[]
}

export interface DraftKri {
  name: string
  unit: string
  current_value: number
  alert_threshold: number
  target_value: number
  frequency?: string | null
  direction?: string | null
  is_suggested_threshold?: boolean
}

export interface DraftRisk {
  name: string
  description?: string | null
  category: string
  inherent_score?: number | null
  residual_score?: number | null
  probability?: number | null
  velocity?: string | null
  trend?: string | null
  status: string
  source_info?: string | null
  financial_impact_min?: number | null
  financial_impact_max?: number | null
  inherent_label?: string | null
  residual_label?: string | null
  responsible?: string | null
  kris: DraftKri[]
}

export interface DraftSite extends OnboardingSiteInfo {
  risks: DraftRisk[]
}

export interface GenerateResponse {
  sites: DraftSite[]
}

export interface CommitResult {
  account: { id: string; email: string }
  organization: { id: string; name: string }
  counts: { sites: number; risks: number; kris: number }
}

// The Stage-2-confirmed profile sent into generation.
export interface GenerateRequest {
  sector?: string | null
  country?: string | null
  sites: OnboardingSiteInfo[]
}

// The user's edited/selected subset of the Stage 3 draft, sent to commit.
export interface CommitRequest {
  organizationName: string
  email: string
  password: string
  sector?: string | null
  country?: string | null
  sites: Array<{
    name: string
    location?: string | null
    country?: string | null
    activity?: string | null
    revenue?: number
    employees_count?: number
    site_type?: string
    source_info?: string | null
    risks: Array<{
      name: string
      description?: string | null
      category: string
      inherent_score?: number | null
      residual_score?: number | null
      probability?: number | null
      velocity?: string | null
      trend?: string | null
      status?: string
      source_info?: string | null
      kris: Array<{
        name: string
        unit?: string
        current_value?: number
        alert_threshold?: number
        target_value?: number
        frequency?: string | null
      }>
    }>
  }>
}
