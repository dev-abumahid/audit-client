import { Grid3x3 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import { SEVERITY_STYLES, type SeverityLevel } from "@/utils/severityStyles"

// Phase E redesign: a stylized, animated risk-matrix visual, not a literal
// embed of RiskMatrixPage. Cells are bucketed from the SAME real mock risk
// data (probability/inherent_score) using the SAME severity-scoring
// function the live app uses (getRiskSeverityLevel) -- real computation and
// real data shapes, matching HeroProductVisual's own established
// philosophy for this file, just at a larger scale with real motion.
//
// Visual-fidelity pass: the first version of this widget used flat 4-color
// cells with no axis labels or legend -- a much cruder abstraction than the
// real RiskMatrixView (5-band likelihood/impact labels, a Critical/High/
// Medium/Low legend, a grid icon in the header). This version borrows those
// exact real labels/legend/icon instead of inventing a simplified stand-in.
const GRID_SIZE = 5

// Review finding on PR #1011: these opacities weren't copied from the real
// RiskMatrixView.tsx (getRiskCellClass), which quality-bar-loop rounds
// 10-12 specifically retuned for a documented dark-mode WCAG contrast
// failure (bg-risk-medium's dark-mode tint at flat /45 measured below the
// 4.5:1 small-text floor) -- see that file's own round-10/11 comments for
// the full contrast math. Copied verbatim here instead of the earlier
// flat, pre-fix values.
const CELL_CLASS: Record<SeverityLevel, string> = {
  low: "bg-risk-low/55",
  medium: "bg-risk-medium/75 dark:bg-risk-medium/50",
  high: "bg-risk-high/80 dark:bg-risk-high/63",
  critical: "bg-risk-critical/90 dark:bg-risk-critical/85",
  info: "bg-risk-info/55",
  neutral: "bg-muted/30",
}

const SEVERITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

// Real 5-band likelihood/impact labels, same i18n keys + same 5x5 array
// RiskMatrixView.tsx's own LABEL_KEYS[5] uses (organization.riskMatrix.
// likelihood*/impact*) -- reused directly rather than inventing a shorter
// stand-in scale. RiskMatrixView's own array is low-to-high
// (likelihoodVeryUnlikely first); reversed here since this widget lists
// likelihood top-to-bottom (highest first), matching row 0 = highest
// likelihood band in buildGrid below.
const LIKELIHOOD_KEYS = [
  "likelihoodVeryLikely",
  "likelihoodProbable",
  "likelihoodModeratelyLikely",
  "likelihoodUnlikely",
  "likelihoodVeryUnlikely",
]
const IMPACT_KEYS = [
  "impactNegligible",
  "impactMinor",
  "impactModerate",
  "impactMajor",
  "impactCatastrophic",
]
const LEGEND_LEVELS: SeverityLevel[] = ["critical", "high", "medium", "low"]

function bucketIndex(score: number): number {
  // 0-100 scale quartered into 5 bands (0-19/20-39/.../80-100) -- one more
  // band than getRiskSeverityLevel's 4 severity levels, since a 5x5 grid
  // needs 5 likelihood/impact bands regardless of how many severity colors
  // those bands ultimately produce.
  return Math.min(GRID_SIZE - 1, Math.floor(score / 20))
}

interface GridCell {
  count: number
  topSeverity: SeverityLevel | null
  topRiskName: string | null
}

function buildGrid(): GridCell[][] {
  const grid: GridCell[][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({
      count: 0,
      topSeverity: null,
      topRiskName: null,
    }))
  )

  for (const risk of MOCK_RISKS) {
    // Row 0 = highest likelihood band (top row), matching the real
    // RiskMatrixView's row order (Very Likely at top, Very Unlikely at
    // bottom) -- this widget puts likelihood on rows and impact on
    // columns, the same axis assignment the real page uses.
    const row = GRID_SIZE - 1 - bucketIndex(risk.probability)
    const col = bucketIndex(risk.inherent_score)
    const severity = getRiskSeverityLevel(risk.inherent_score)
    const cell = grid[row][col]
    cell.count += 1
    if (
      !cell.topSeverity ||
      SEVERITY_RANK[severity] > SEVERITY_RANK[cell.topSeverity]
    ) {
      cell.topSeverity = severity
      cell.topRiskName = risk.name
    }
  }

  return grid
}

export default function RiskMatrixWidget({
  animate,
}: {
  animate: boolean
}) {
  const { t } = useTranslation()
  const grid = buildGrid()
  const criticalCount = MOCK_RISKS.filter(
    (r) => getRiskSeverityLevel(r.inherent_score) === "critical"
  ).length
  const highCount = MOCK_RISKS.filter(
    (r) => getRiskSeverityLevel(r.inherent_score) === "high"
  ).length

  return (
    <div className="rounded-[11px] bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Grid3x3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          {t("home.productDemo.riskMatrix.title")}
        </h3>
        <span className="ml-auto font-mono-data text-[10px] text-muted-foreground">
          {t("home.productDemo.riskMatrix.dimensions")}
        </span>
      </div>

      <p className="mb-1.5 text-right text-[10px] font-medium text-muted-foreground uppercase">
        {t("home.productDemo.riskMatrix.impact")} →
      </p>

      <div className="flex gap-1.5">
        <div className="flex flex-col justify-between py-0.5 text-[9px] leading-tight font-medium text-muted-foreground">
          {LIKELIHOOD_KEYS.map((key) => (
            <span key={key} className="flex h-[calc((100%-4*0.375rem)/5)] items-center">
              {t(`organization.riskMatrix.${key}`)}
            </span>
          ))}
        </div>

        <div
          className="grid flex-1 grid-cols-5 gap-1.5"
          role="img"
          aria-label={t("home.productDemo.riskMatrix.gridLabel", {
            total: MOCK_RISKS.length,
            critical: criticalCount,
            high: highCount,
          })}
        >
          {grid.map((row, rowIdx) =>
            row.map((cell, colIdx) => {
              const delayMs = animate ? (rowIdx * GRID_SIZE + colIdx) * 25 : 0
              const hasRisk = cell.count > 0
              return (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  aria-hidden="true"
                  title={cell.topRiskName ?? undefined}
                  style={
                    animate ? { transitionDelay: `${delayMs}ms` } : undefined
                  }
                  className={`flex aspect-square items-center justify-center rounded-md text-xs font-bold transition-all duration-500 ease-out motion-reduce:transition-none ${
                    animate
                      ? "translate-y-0 scale-100 opacity-100"
                      : "translate-y-1 scale-90 opacity-0"
                  } ${
                    hasRisk
                      ? `${CELL_CLASS[cell.topSeverity as SeverityLevel]} text-foreground`
                      : "bg-muted/30"
                  }`}
                >
                  {hasRisk ? cell.count : ""}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div
        className="mt-1.5 ml-[calc(2.5rem+0.375rem)] grid grid-cols-5 gap-1.5 text-center text-[8px] leading-tight text-muted-foreground"
        aria-hidden="true"
      >
        {/* Live-caught at mobile width: `truncate` clipped "Catastrophic"
            to "Catastrop..." with no way to recover it -- a title-tooltip
            fallback (this codebase's usual pattern) doesn't help here since
            there's no hover on a touch device. Wrapping to two lines
            instead keeps the full word visible for every input type. */}
        {IMPACT_KEYS.map((key) => (
          <span key={key} className="break-words">
            {t(`organization.riskMatrix.${key}`)}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3">
        {LEGEND_LEVELS.map((level) => (
          <span
            key={level}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span
              className={`h-2 w-2 rounded-full ${SEVERITY_STYLES[level].dot}`}
            />
            {t(`riskLevel.${level}`)}
          </span>
        ))}
      </div>
    </div>
  )
}
