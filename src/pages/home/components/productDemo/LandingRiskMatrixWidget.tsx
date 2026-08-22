import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import {
  getMatrixColor,
  LABEL_KEYS,
  mapRiskToCell,
} from "@/utils/riskMatrixCalc"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import { SEVERITY_STYLES, type SeverityLevel } from "@/utils/severityStyles"

// Landing overhaul PR3: the clickable risk-matrix demo, built on top of
// riskMatrixCalc.ts's extraction so cell placement and color are the exact
// same real logic RiskMatrixView.tsx uses -- not a second hand-copied
// implementation like the deleted static RiskMatrixWidget used to (buckets
// by its own bucketIndex() and colors by top-risk-severity, a different,
// also-real, but different approach; see PR #1028's own removal note).
// Fixed size=5, no URL sync, no size toggle, no group-by-category, no site
// filter, no Escape handling -- a marketing demo doesn't need
// RiskMatrixPage's full chrome, and forking those out here (rather than
// threading them as optional props into the real page) avoids adding dead
// conditional branches to production code for a landing-only use case.
const GRID_SIZE = 5
const LABELS = LABEL_KEYS[GRID_SIZE]
// Longest per-cell entrance delay (last cell, see delayMs below) plus the
// cell's own transition duration -- the point at which every cell is
// guaranteed to have finished animating in, used to know when it's safe to
// drop the transitionDelay style (see ENTERED_AFTER_MS's own usage below).
const ENTERED_AFTER_MS = (GRID_SIZE * GRID_SIZE - 1) * 25 + 150

// Rendered top-to-bottom as "highest likelihood first" (row 0 = top),
// matching RiskMatrixView's own display order -- LABEL_KEYS[5].likelihood
// is stored low-to-high, so it's reversed here for display only, same
// convention the deleted static RiskMatrixWidget's own LIKELIHOOD_KEYS
// comment used to document.
const LIKELIHOOD_DISPLAY_KEYS = [...LABELS.likelihood].reverse()
const LEGEND_LEVELS: SeverityLevel[] = ["critical", "high", "medium", "low"]

// Each cell holds the MOCK_RISKS array indices of the risks that land in
// it -- not {row, col} pairs, which would confusingly overload the same
// field names the outer grid position already uses.
function buildGrid(): number[][][] {
  const grid: number[][][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => [])
  )
  MOCK_RISKS.forEach((risk, riskIndex) => {
    const { row, col } = mapRiskToCell(risk, GRID_SIZE)
    // Display row 0 = highest likelihood, but mapRiskToCell's row 0 = lowest
    // probability (see its own comment) -- flip for display, same as
    // LIKELIHOOD_DISPLAY_KEYS above.
    const displayRow = GRID_SIZE - 1 - row
    grid[displayRow][col].push(riskIndex)
  })
  return grid
}

// This widget mounts twice: once animated (the static 3-widget rail, which
// passes `animate={revealVisible}` for a staggered cell entrance) and once
// static (DemoMoment's "register"/"KRI" moments below, no animate prop --
// DemoMoment's own ancestor fade already handles that mount's reveal).
// Default true keeps the second mount at full visibility immediately.
export default function LandingRiskMatrixWidget({
  animate = true,
}: {
  animate?: boolean
} = {}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(
    null
  )

  // Review finding on PR #1028: the per-cell `transitionDelay` below is
  // only meaningful for the one-time staggered entrance -- without this,
  // `animate` (true for the rest of this component's life once the rail's
  // reveal fires, and true from the very first render in the DemoMoment
  // mount) kept the delay applied forever, so every later hover on a cell
  // inherited up to ENTERED_AFTER_MS of lag from `transition-all` covering
  // the hover scale/brightness too. `entered` flips once, after the
  // longest cell's entrance finishes, and from then on no cell gets an
  // inline transitionDelay regardless of `animate`.
  const [entered, setEntered] = useState(animate)
  useEffect(() => {
    if (!animate || entered) return
    const timer = setTimeout(() => setEntered(true), ENTERED_AFTER_MS)
    return () => clearTimeout(timer)
  }, [animate, entered])

  const grid = buildGrid()
  const selectedRisks =
    selected !== null
      ? grid[selected.row][selected.col].map((riskIndex) => MOCK_RISKS[riskIndex])
      : []

  return (
    <div className="rounded-[11px] bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        {/* Review finding on PR #1025: demoted from <h3> -- this widget only
            mounts under ProductDemoSection's DemoMoment, which already
            supplies the real section <h3> right above it. See
            KriThresholdSliderWidget's identical fix for the full
            reasoning. */}
        <p className="text-sm font-semibold text-foreground">
          {t("home.productDemo.riskMatrixClick.title")}
        </p>
        <span className="font-mono-data text-[10px] text-muted-foreground">
          {t("home.productDemo.riskMatrix.dimensions")}
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {t("home.productDemo.riskMatrixClick.hint")}
      </p>

      <p className="mb-1.5 text-right text-[10px] font-medium text-muted-foreground uppercase">
        {t("home.productDemo.riskMatrix.impact")} →
      </p>

      <div className="flex gap-1.5">
        <div className="flex flex-col justify-between py-0.5 text-[9px] leading-tight font-medium text-muted-foreground">
          {LIKELIHOOD_DISPLAY_KEYS.map((key) => (
            <span
              key={key}
              className="flex h-[calc((100%-4*0.375rem)/5)] items-center"
            >
              {t(`organization.riskMatrix.${key}`)}
            </span>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-5 gap-1.5">
          {grid.map((row, rowIdx) =>
            row.map((cellRisks, colIdx) => {
              const isSelected =
                selected?.row === rowIdx && selected?.col === colIdx
              const hasRisks = cellRisks.length > 0
              const delayMs = (rowIdx * GRID_SIZE + colIdx) * 25
              return (
                <button
                  key={`${rowIdx}-${colIdx}`}
                  type="button"
                  onClick={() =>
                    setSelected(isSelected ? null : { row: rowIdx, col: colIdx })
                  }
                  aria-pressed={isSelected}
                  aria-label={t("home.productDemo.riskMatrixClick.cellLabel", {
                    count: cellRisks.length,
                  })}
                  style={
                    entered ? undefined : { transitionDelay: `${delayMs}ms` }
                  }
                  className={`focus-ring flex aspect-square items-center justify-center rounded-md text-xs font-bold transition-all duration-150 ease-out motion-reduce:transition-none hover:scale-105 hover:brightness-110 ${
                    animate
                      ? "translate-y-0 scale-100 opacity-100"
                      : "translate-y-1 scale-90 opacity-0"
                  } ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""} ${
                    hasRisks
                      ? // Review finding on PR #1016: getMatrixColor's contract
                        // expects row 0 = lowest likelihood (same convention
                        // mapRiskToCell returns), but `rowIdx` here is the
                        // DISPLAY row (flipped so row 0 renders at the top =
                        // highest likelihood). Passing it straight through
                        // inverted the color ramp on the likelihood axis.
                        // RiskMatrixView.tsx un-flips the same way before its
                        // own getMatrixColor call (matrixSize - 1 - reversedRow).
                        `${getMatrixColor(GRID_SIZE - 1 - rowIdx, colIdx, GRID_SIZE)} text-foreground`
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {hasRisks ? cellRisks.length : ""}
                </button>
              )
            })
          )}
        </div>
      </div>

      <div
        className="mt-1.5 ml-[calc(2.5rem+0.375rem)] grid grid-cols-5 gap-1.5 text-center text-[8px] leading-tight text-muted-foreground"
        aria-hidden="true"
      >
        {LABELS.impact.map((key) => (
          <span key={key} className="break-words">
            {t(`organization.riskMatrix.${key}`)}
          </span>
        ))}
      </div>

      {/* Always-visible color legend -- this widget also stands in for the
          static rail's old non-interactive matrix (deleted in favor of this
          one, see PR #1028), which had its own always-visible severity
          legend. Without this, a visitor who never clicks a cell has no way
          to read what the color ramp means. */}
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

      <div className="mt-3 border-t border-border pt-3" aria-live="polite">
        {selected === null ? (
          <p className="text-xs text-muted-foreground">
            {t("home.productDemo.riskMatrixClick.emptyHint")}
          </p>
        ) : selectedRisks.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("home.productDemo.riskMatrixClick.noRisks")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {selectedRisks.map((risk) => {
              const severity = getRiskSeverityLevel(risk.residual_score)
              return (
                <li
                  key={risk.id}
                  className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_STYLES[severity].dot}`}
                  />
                  <span className="font-mono-data text-[10px] text-muted-foreground">
                    {risk.ref}
                  </span>
                  <span className="truncate text-xs text-foreground">
                    {risk.name}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
