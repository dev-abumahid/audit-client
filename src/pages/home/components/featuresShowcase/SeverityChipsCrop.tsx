import { useTranslation } from "react-i18next"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import { severityBadgeClasses, type SeverityLevel } from "@/utils/severityStyles"

// Landing overhaul PR7: a compact real crop of AlertsPage's own severity
// quick-filter chips (src/dashboard/organization/alerts/AlertsPage.tsx) --
// same severityBadgeClasses(sev, {border:true}) active-state colors, same
// h-11-touch-target-derived pill shape (scaled down here). Counts are
// genuinely computed from the shared MOCK_RISKS fixture via
// getRiskSeverityLevel -- the same real risk data and scoring function
// LandingRiskMatrixWidget and RoleScopedRegisterWidget already use, not
// fabricated numbers.
const LEVELS: SeverityLevel[] = ["critical", "high", "medium", "low"]

export default function SeverityChipsCrop() {
  const { t } = useTranslation()
  const counts = LEVELS.reduce(
    (acc, level) => {
      acc[level] = MOCK_RISKS.filter(
        (r) => getRiskSeverityLevel(r.residual_score) === level
      ).length
      return acc
    },
    {} as Record<SeverityLevel, number>
  )

  // Review finding on PR #1019: even though these counts are genuinely
  // computed (not fabricated), the chips are still a decorative
  // illustration inside a card whose real semantic content is just the
  // heading/description above -- aria-hidden avoids an orphaned "Critical
  // 1, High 5..." announcement with no navigable context, same reasoning
  // applied to the other three crops in this folder.
  return (
    <div aria-hidden="true" className="mt-4 flex flex-wrap gap-1.5">
      {LEVELS.map((level) => (
        <span
          key={level}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${severityBadgeClasses(level, { border: true })}`}
        >
          {t(`riskLevel.${level}`)}
          <span className="font-mono-data font-bold">{counts[level]}</span>
        </span>
      ))}
    </div>
  )
}
