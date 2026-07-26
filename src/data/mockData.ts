import type { RiskLink } from "@/types/organization"

// Colors aren't language-dependent, so they stay in a plain lookup here.
// Labels are i18n keys under organization.riskCategories.<labelKey> in
// en.json/fr.json, resolved with t() at the call site (Overview.tsx) --
// this table used to hardcode the labels directly with a mix of English
// and French strings that never went through i18n at all (aexa-frontend#197).
export const riskCategories: Record<string, { labelKey: string; color: string }> =
  {
    supply_chain: { labelKey: "catSupplyChain", color: "#EF4444" },
    financial: { labelKey: "catFinancial", color: "#F97316" },
    regulatory: { labelKey: "catRegulatory", color: "#8B5CF6" },
    cyber: { labelKey: "catCyber", color: "#06B6D4" },
    operational: { labelKey: "catOperational", color: "#EAB308" },
    hr: { labelKey: "catHr", color: "#EC4899" },
    strategic: { labelKey: "catStrategic", color: "#6366F1" },
    ehs: { labelKey: "catEhs", color: "#22C55E" },
  }
export const DUMMY_LINKS: RiskLink[] = [
  {
    id: "rl_001",
    org_account_id: "org_123",
    source_ref: "risk_fire",
    target_ref: "risk_property_damage",
    link_type: "CAUSES",
    createdAt: "2026-04-17T10:00:00Z",
  },
  {
    id: "rl_002",
    org_account_id: "org_123",
    source_ref: "risk_flood",
    target_ref: "risk_supply_chain",
    link_type: "AMPLIFIES",
    createdAt: "2026-04-16T08:30:00Z",
  },
  {
    id: "rl_003",
    org_account_id: "org_456",
    source_ref: "risk_cyber_attack",
    target_ref: "risk_data_breach",
    link_type: "CAUSES",
    createdAt: "2026-04-15T14:20:00Z",
  },
  {
    id: "rl_004",
    org_account_id: "org_789",
    source_ref: "risk_employee_turnover",
    target_ref: "risk_productivity_loss",
    link_type: "CORRELATES",
    createdAt: "2026-04-14T11:45:00Z",
  },
  {
    id: "rl_005",
    org_account_id: "org_456",
    source_ref: "risk_inflation",
    target_ref: "risk_operational_cost",
    link_type: "AMPLIFIES",
    createdAt: "2026-04-13T09:15:00Z",
  },
]
