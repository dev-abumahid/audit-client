import { useTranslation } from "react-i18next"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import { getRiskSeverityLevel } from "@/utils/riskScoring"

// Phase E redesign: a stylized, animated risk-matrix visual, not a literal
// embed of RiskMatrixPage. Cells are bucketed from the SAME real mock risk
// data (probability/inherent_score) using the SAME severity-scoring
// function the live app uses (getRiskSeverityLevel) -- real computation and
// real data shapes, matching HeroProductVisual's own established
// philosophy for this file, just at a larger scale with real motion.
const GRID_SIZE = 5

const CELL_CLASS: Record<string, string> = {
  low: "bg-risk-low/55",
  medium: "bg-risk-medium/45",
  high: "bg-risk-high/80",
  critical: "bg-risk-critical/90",
}

const SEVERITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

function bucketIndex(score: number): number {
  // 0-100 scale quartered into 5 bands (0-19/20-39/.../80-100) -- one more
  // band than getRiskSeverityLevel's 4 severity levels, since a 5x5 grid
  // needs 5 likelihood/impact bands regardless of how many severity colors
  // those bands ultimately produce.
  return Math.min(GRID_SIZE - 1, Math.floor(score / 20))
}

interface GridCell {
  count: number
  topSeverity: string | null
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
    const col = bucketIndex(risk.probability)
    // Impact axis reads bottom-to-top (row 0 = highest impact band), so the
    // score-derived row index is inverted. Review finding: this is this
    // widget's OWN convention, internally consistent (highest-severity risks
    // land top-right) but not literally the same axis assignment the real
    // RiskMatrixView uses there, likelihood is the row/Y axis and impact is
    // the column/X axis, the transpose of this widget. Noted here since an
    // earlier version of this comment claimed otherwise.
    const row = GRID_SIZE - 1 - bucketIndex(risk.inherent_score)
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
  // Review finding: the grid cells are plain non-interactive <div>s with
  // only a per-cell `title` attribute -- title isn't reliably exposed by
  // screen readers on a div with no implicit role, so a screen-reader user
  // got zero information about the actual distribution beyond the generic
  // caption below. role="img" + a real aria-label on the grid container
  // gives an actual summary, same pattern as the SVG widgets' aria-labels.
  const criticalCount = MOCK_RISKS.filter(
    (r) => getRiskSeverityLevel(r.inherent_score) === "critical"
  ).length
  const highCount = MOCK_RISKS.filter(
    (r) => getRiskSeverityLevel(r.inherent_score) === "high"
  ).length

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {t("home.productDemo.riskMatrix.title")}
        </h3>
        <span className="font-mono-data text-[10px] text-muted-foreground">
          {t("home.productDemo.riskMatrix.dimensions")}
        </span>
      </div>

      <div
        className="grid grid-cols-5 gap-1.5"
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
                  animate
                    ? { transitionDelay: `${delayMs}ms` }
                    : undefined
                }
                className={`flex aspect-square items-center justify-center rounded-md text-xs font-bold transition-all duration-500 ease-out motion-reduce:transition-none ${
                  animate
                    ? "translate-y-0 scale-100 opacity-100"
                    : "translate-y-1 scale-90 opacity-0"
                } ${
                  hasRisk
                    ? `${CELL_CLASS[cell.topSeverity as string]} text-foreground`
                    : "bg-muted/30"
                }`}
              >
                {hasRisk ? cell.count : ""}
              </div>
            )
          })
        )}
      </div>

      <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
        <span>{t("home.productDemo.riskMatrix.likelihood")}</span>
        <span>{t("home.productDemo.riskMatrix.impact")}</span>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {t("home.productDemo.riskMatrix.caption", {
          count: MOCK_RISKS.length,
        })}
      </p>
    </div>
  )
}
