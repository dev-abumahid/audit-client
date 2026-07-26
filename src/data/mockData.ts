import type { RiskLink } from "@/types/organization"

export const riskCategories: Record<string, { label: string; color: string }> =
  {
    supply_chain: { label: "Supply Chain", color: "#EF4444" },
    financial: { label: "Financier", color: "#F97316" },
    regulatory: { label: "Réglementaire", color: "#8B5CF6" },
    cyber: { label: "Cyber", color: "#06B6D4" },
    operational: { label: "Opérationnel", color: "#EAB308" },
    hr: { label: "Ressources Humaines", color: "#EC4899" },
    strategic: { label: "Stratégique", color: "#6366F1" },
    ehs: { label: "EHS / Environnement", color: "#22C55E" },
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
