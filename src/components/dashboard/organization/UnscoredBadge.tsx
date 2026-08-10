import { AlertTriangle } from "lucide-react"
import { useTranslation } from "react-i18next"

// Shared "this risk's score is missing/malformed, don't trust the computed
// severity" flag -- first built local to RiskMatrixPage.tsx (aexa-frontend
// #636), then extracted here once the same treatment was needed at every
// other consumer of getRiskSeverityLevel (RiskDetails, RiskRegisterPage,
// CorrelationMatrixPage, Overview, SitesEntities). A real, focusable button
// (not a plain span) so the explanation reaches keyboard/screen-reader
// users too, not just mouse-hover.
export default function UnscoredBadge() {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      title={t("organization.riskMatrix.unscoredRiskWarning")}
      aria-label={t("organization.riskMatrix.unscoredRiskWarning")}
      className="focus-ring flex items-center gap-0.5 rounded bg-amber-100 px-1.5 text-[9px] text-amber-800 dark:bg-amber-950 dark:text-amber-300"
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      {t("organization.riskMatrix.unscoredRiskBadge")}
    </button>
  )
}
