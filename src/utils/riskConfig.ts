// Labels are i18n keys under organization.riskCategories.<labelKey> in
// en.json/fr.json, resolved with t() at each call site -- this table used to
// hardcode every label directly in English with no i18n at all, despite
// being the canonical category list for RiskGraphPage/RiskRegisterPage/
// RiskMatrixPage/SitesEntities (aexa-frontend#199). Colors aren't
// language-dependent, so they stay in this plain lookup.
export const RISK_CATEGORIES: Record<string, { labelKey: string; color: string }> =
  {
    supply_chain: { labelKey: "catSupplyChain", color: "hsl(0, 72%, 51%)" },
    financial: { labelKey: "catFinancial", color: "hsl(25, 95%, 53%)" },
    regulatory: { labelKey: "catRegulatory", color: "hsl(280, 65%, 60%)" },
    cyber: { labelKey: "catCyber", color: "hsl(199, 89%, 48%)" },
    operational: { labelKey: "catOperational", color: "hsl(38, 92%, 50%)" },
    hr: { labelKey: "catHr", color: "hsl(330, 80%, 60%)" },
    strategic: { labelKey: "catStrategic", color: "hsl(240, 60%, 60%)" },
    ehs: { labelKey: "catEhs", color: "hsl(142, 71%, 45%)" },
    geopolitical: { labelKey: "catGeopolitical", color: "hsl(210, 70%, 50%)" },
    natural_disaster: {
      labelKey: "catNaturalDisaster",
      color: "hsl(30, 80%, 45%)",
    },
    technology: { labelKey: "catTechnology", color: "hsl(190, 75%, 45%)" },
    reputational: { labelKey: "catReputational", color: "hsl(350, 70%, 55%)" },
    compliance: { labelKey: "catCompliance", color: "hsl(270, 55%, 50%)" },
    ai_emerging: {
      labelKey: "catAiEmerging",
      color: "hsl(160, 60%, 40%)",
    },
    fire: { labelKey: "catFire", color: "hsl(10, 85%, 50%)" },
    electrical: { labelKey: "catElectrical", color: "hsl(45, 90%, 50%)" },
    atex: { labelKey: "catAtex", color: "hsl(15, 90%, 55%)" },
    machine_safety: {
      labelKey: "catMachineSafety",
      color: "hsl(200, 60%, 50%)",
    },
    environmental: { labelKey: "catEnvironmental", color: "hsl(120, 55%, 40%)" },
    security_physical: {
      labelKey: "catSecurityPhysical",
      color: "hsl(0, 50%, 40%)",
    },
  }

// Issue #362: shared translated-label resolver for a risk category value,
// extracted from ThreeLinesOfDefensePage.tsx so RiskMultiSelect.tsx (the
// linked-risk picker on the Audit Missions form) can render the same
// translated label instead of the raw backend category value. Falls back to
// the raw category for anything not in RISK_CATEGORIES, same convention as
// getEnumLabel() in enumLabel.ts.
export function riskCategoryLabel(
  t: (key: string) => string,
  category: string
): string {
  const cat = RISK_CATEGORIES[category as keyof typeof RISK_CATEGORIES]
  return cat ? t(`organization.riskCategories.${cat.labelKey}`) : category
}
