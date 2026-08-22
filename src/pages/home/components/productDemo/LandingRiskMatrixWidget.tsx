import { MapPin, Tag } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  MOCK_RISKS,
  MOCK_SITES,
} from "@/dashboard/organization/risk/riskMatrixMockData"
import { riskCategoryLabel } from "@/utils/riskConfig"
import {
  getMatrixColor,
  LABEL_KEYS,
  mapRiskToCell,
} from "@/utils/riskMatrixCalc"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import {
  SEVERITY_STYLES,
  severityBadgeClasses,
  type SeverityLevel,
} from "@/utils/severityStyles"
import type { Risk } from "@/types/organization"

// The clickable risk-matrix demo, built on riskMatrixCalc.ts's extraction
// so cell placement and color are the exact same real logic
// RiskMatrixView.tsx uses. Fixed size=5, no URL sync, no size toggle, no
// group-by-category, no site filter, no Escape handling -- a marketing
// demo doesn't need RiskMatrixPage's full chrome.
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

// Mounts in ProductDemoSection's static rail, which passes
// `animate={revealVisible}` for a staggered cell entrance. `animate`
// defaults to true so cells render at full visibility if the prop is
// ever omitted.
export default function LandingRiskMatrixWidget({
  animate = true,
}: {
  animate?: boolean
} = {}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(
    null
  )

  // `entered` flips once, after the longest cell's staggered-entrance
  // delay finishes -- past that point no cell gets an inline
  // transitionDelay, so `transition-all` (which also covers hover
  // scale/brightness) never inherits a stale entrance delay on hover.
  const [entered, setEntered] = useState(animate)
  useEffect(() => {
    if (!animate || entered) return
    const timer = setTimeout(() => setEntered(true), ENTERED_AFTER_MS)
    return () => clearTimeout(timer)
  }, [animate, entered])

  const grid = buildGrid()
  const selectedRisks =
    selected !== null
      ? grid[selected.row][selected.col].map(
          (riskIndex) => MOCK_RISKS[riskIndex]
        )
      : []

  return (
    <div className="flex h-full flex-col rounded-[11px] bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        {/* <p>, not <h3> -- a card label, not a document heading; the
            section's own <h3> above this rail already carries that role. */}
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
                    setSelected(
                      isSelected ? null : { row: rowIdx, col: colIdx }
                    )
                  }
                  aria-pressed={isSelected}
                  aria-label={t("home.productDemo.riskMatrixClick.cellLabel", {
                    count: cellRisks.length,
                  })}
                  style={
                    entered ? undefined : { transitionDelay: `${delayMs}ms` }
                  }
                  // Design-team finding: this cell only got its heat-map
                  // color when it happened to contain a mock risk --
                  // everything else fell back to a flat gray "bg-muted/30",
                  // unlike RiskMatrixView.tsx (the real, authenticated
                  // matrix), which colors every cell unconditionally via
                  // this exact same getMatrixColor() and only dims empty
                  // ones with opacity (see that file's own
                  // `cellRisks.length ? "shadow-md" : "opacity-75"`). This
                  // widget already imports getMatrixColor specifically so
                  // its cell logic can't drift from the real page's --
                  // applying it unconditionally closes that one remaining
                  // gap. A small dot marks a cell that has real risk(s)
                  // rather than a bold count digit, since a busy 25-cell
                  // grid all showing digits was more visual noise than a
                  // marketing demo needs -- the full detail is one click
                  // away in the panel below.
                  className={`focus-ring relative flex aspect-square items-center justify-center rounded-md transition-all duration-150 ease-out hover:scale-105 hover:brightness-110 motion-reduce:transition-none ${
                    animate
                      ? "translate-y-0 scale-100 opacity-100"
                      : "translate-y-1 scale-90 opacity-0"
                  } ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""} ${
                    // getMatrixColor expects row 0 = lowest likelihood
                    // (mapRiskToCell's convention), but `rowIdx` here is
                    // the flipped DISPLAY row (row 0 = highest
                    // likelihood) -- un-flip before calling it, same as
                    // RiskMatrixView.tsx does.
                    getMatrixColor(GRID_SIZE - 1 - rowIdx, colIdx, GRID_SIZE)
                  } text-foreground ${hasRisks ? "shadow-sm" : "opacity-60"}`}
                >
                  {hasRisks && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-foreground/70"
                    />
                  )}
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

      {/* mt-auto wraps both trailing blocks together -- pushes them to the
          bottom of the card's stretched height as one unit, so the legend
          and results panel stay adjacent to each other instead of the
          legend alone floating mid-card. Legend: always-visible, so a
          visitor who never clicks a cell can still read the color ramp. */}
      <div className="mt-auto">
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

        {/* Design-team finding: this used to be a bare list of ref+name
            per risk -- clicking a cell answered "what's here" but not
            "why does it matter." Each risk now gets a real detail card
            (severity, location, category, description, residual score),
            matching the depth a click into the real risk register gives. */}
        <div
          className="mt-3 max-h-64 space-y-3 overflow-y-auto border-t border-border pt-3"
          aria-live="polite"
        >
          {selected === null ? (
            <p className="text-xs text-muted-foreground">
              {t("home.productDemo.riskMatrixClick.emptyHint")}
            </p>
          ) : selectedRisks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("home.productDemo.riskMatrixClick.noRisks")}
            </p>
          ) : (
            selectedRisks.map((risk) => (
              <RiskDetailCard key={risk.id} risk={risk} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function RiskDetailCard({ risk }: { risk: Risk }) {
  const { t } = useTranslation()
  const severity = getRiskSeverityLevel(risk.residual_score)
  const siteName = MOCK_SITES.find((s) => s.id === risk.site_id)?.name

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono-data text-[10px] text-muted-foreground">
          {risk.ref}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${severityBadgeClasses(
            severity,
            { border: true }
          )}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[severity].dot}`}
          />
          {t(`riskLevel.${severity}`)}
        </span>
        {risk.ai_generated && (
          <span className="rounded border border-sky-500/20 bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-medium text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/15 dark:text-sky-400">
            {t("organization.riskRegister.aiGenerated")}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-xs font-semibold text-balance text-foreground">
        {risk.name}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {siteName && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {siteName}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Tag className="h-3 w-3" />
          {riskCategoryLabel(t, risk.category)}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {risk.description}
      </p>

      <div className="mt-2 flex items-baseline gap-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
        {t("home.productDemo.riskMatrixClick.residualScoreLabel")}
        <span className="font-heading text-sm font-bold text-foreground">
          {risk.residual_score}
        </span>
        /100
      </div>
    </div>
  )
}
