// Curated compliance-domain taxonomy for the scorecard's site×domain matrix.
// Follows the same convention Risk.category uses (riskConfig.ts's
// RISK_CATEGORIES): a plain string field on the model paired with a curated
// frontend constant of { label, color } per entry — not a DB enum. The keys
// are what get persisted in ComplianceObligation.domain; the labels are what
// the UI renders (and should be routed through t() at the call site rather than
// used raw).
export const COMPLIANCE_DOMAINS: Record<
  string,
  { label: string; color: string }
> = {
  data_protection: { label: "Data Protection", color: "hsl(199, 89%, 48%)" },
  health_safety: { label: "Health & Safety", color: "hsl(142, 71%, 45%)" },
  financial: { label: "Financial", color: "hsl(25, 95%, 53%)" },
  environmental: { label: "Environmental", color: "hsl(120, 55%, 40%)" },
  labor_employment: { label: "Labor & Employment", color: "hsl(330, 80%, 60%)" },
  anti_corruption: { label: "Anti-Corruption", color: "hsl(0, 72%, 51%)" },
  export_control: { label: "Export Control", color: "hsl(240, 60%, 60%)" },
  industry_specific: {
    label: "Industry-Specific",
    color: "hsl(280, 65%, 60%)",
  },
}
