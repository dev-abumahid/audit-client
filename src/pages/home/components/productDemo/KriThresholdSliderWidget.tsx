import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  MOCK_KRIS,
  MOCK_RISKS,
} from "@/dashboard/organization/overview/overviewMockData"
import {
  formatKriNumber,
  kriStatusMeta,
} from "@/dashboard/organization/kri/kriConfig"
import { useValueChangeFlash } from "@/hooks/useValueChangeFlash"
import { computeKriStatus } from "@/utils/kriStatus"
import { riskCategoryLabel } from "@/utils/riskConfig"
import { SEVERITY_STYLES, severityBadgeClasses } from "@/utils/severityStyles"

// Drags the CURRENT READING, not the threshold -- with target_value(0) <
// alert_threshold(5) < current_value(14) all fixed, dragging only the
// threshold could never reach OK (current > target always). Also the more
// realistic product moment: watching a live value cross configured
// thresholds, not watching the thresholds themselves move.
const KRI = MOCK_KRIS[0]
// Same risk (CYB-014/risk-1) as ConnectedDataModelSection/RiskGraphWidget --
// only used here for its real category label in the eyebrow, keeping this
// widget's "KRI · Cyber" tag truthful instead of inventing a category.
const RISK = MOCK_RISKS[0]
const SLIDER_MAX = 20

// Reworked to match a design exploration the user pointed at directly: a
// two-column layout (reading + colored-zone slider on the left, a status
// explainer card on the right) instead of the original single-column
// compact widget. Real data throughout -- KRI/RISK above, same mock
// records every other widget in this section uses -- rather than the
// exploration's own placeholder "Badge deactivation" scenario, which
// doesn't exist in this codebase's mock data and would be the first
// fabricated content on this page (every other section explicitly avoids
// that, see e.g. RiskGraphWidget's and ConnectedDataModelSection's own
// comments on using real PageRank/mock records instead of invented ones).
//
// Zone-legend minimum width: target_value is 0 for this KRI (a
// zero-tolerance "unpatched CVEs" metric), so the real OK zone is a single
// point at the very start of the track. MIN_ZONE_PCT gives it a small but
// visible sliver in the decorative gradient so the legend's 3 colors all
// read clearly -- purely a rendering floor, it never changes the actual
// status computation below (computeKriStatus still uses the real
// target/alert values, not the clamped display percentages).
const MIN_ZONE_PCT = 6

// selectedRefs/onSelectionChange: user request -- link this widget into
// the same shared cross-highlight selection LandingRiskMatrixWidget and
// RiskGraphWidget already share, so the whole page keeps telling the
// story that every demo (matrix, graph, and this KRI) is the same
// company's real data, not three independent fixtures. Unlike those two
// widgets, this one always shows the exact same fixed KRI (there's no
// list to click through) -- so instead of changing WHAT renders, a click
// on its own ref badge toggles CYB-014 into/out of the shared selection,
// and the card gets a highlight ring when CYB-014 is selected from
// elsewhere (the matrix or the graph). Optionally controlled, same
// pattern as the other two widgets: falls back to local state when no
// selectedRefs prop is given (this widget's own standalone tests).
export default function KriThresholdSliderWidget({
  selectedRefs: controlledSelectedRefs,
  onSelectionChange,
}: {
  selectedRefs?: Set<string>
  onSelectionChange?: (refs: Set<string>) => void
} = {}) {
  const { t, i18n } = useTranslation()
  const [localSelectedRefs, setLocalSelectedRefs] = useState<Set<string>>(
    new Set()
  )
  const selectedRefs = controlledSelectedRefs ?? localSelectedRefs
  const isSelected = selectedRefs.has(RISK.ref)

  function toggleSelect() {
    const next = isSelected ? new Set<string>() : new Set([RISK.ref])
    setLocalSelectedRefs(next)
    onSelectionChange?.(next)
  }

  const [currentValue, setCurrentValue] = useState(KRI.current_value)
  const status = computeKriStatus(
    currentValue,
    KRI.alert_threshold,
    KRI.target_value
  )
  const meta = kriStatusMeta(status)

  // useValueChangeFlash wants a referentially-stable `items` array; this
  // inline array literal isn't memoized. Not a functional bug -- the hook
  // diffs by value internally, so an unstable reference just re-runs the
  // diff effect redundantly, never incorrectly.
  const { flashingKeys } = useValueChangeFlash(
    [{ key: "kri-slider-status", status }],
    (item) => item.key,
    (item) => item.status
  )
  const isFlashing = flashingKeys.has("kri-slider-status")

  // Small 2-3px vertical dip on the status label, on top of the shared
  // value-flash background, so a threshold crossing never reads as a hard
  // snap -- a cheap approximation of a full crossfade.
  //
  // Design-team finding: the CSS transition below was duration-150 while
  // this hold timer was 140ms -- shorter than the rAF delay (~16ms) plus
  // the transition's own 150ms, so the timer fired and reversed the dip
  // mid-animation on every crossing, producing a visible stutter instead
  // of a clean down-then-up motion. Widened the hold to 160ms (paired with
  // the CSS transition dropping to duration-100 below) so the down phase
  // always finishes (~116ms) before the up phase starts.
  const [labelDipping, setLabelDipping] = useState(false)
  const prevStatusRef = useRef(status)
  useEffect(() => {
    if (prevStatusRef.current === status) return
    prevStatusRef.current = status
    // requestAnimationFrame defers the state update out of the effect
    // body, avoiding a synchronous cascading render (same pattern
    // useCountUp.ts uses).
    const frame = requestAnimationFrame(() => setLabelDipping(true))
    const timer = setTimeout(() => setLabelDipping(false), 160)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [status])

  const higherIsBetter = KRI.target_value > KRI.alert_threshold
  const targetPct = (KRI.target_value / SLIDER_MAX) * 100
  const alertPct = (KRI.alert_threshold / SLIDER_MAX) * 100

  // Hard-stop gradient built from the real target/alert thresholds, each
  // zone floored at MIN_ZONE_PCT so a thin real gap (like this KRI's
  // target=0) still renders as a visible stripe.
  //
  // Review finding on PR #1040: the previous okEnd/warningEnd naming
  // silently assumed lower-is-better's left-to-right order (OK, then
  // Warning, then Alert). For a higher-is-better KRI the real order
  // reads the other way (Alert, then Warning, then OK) -- target_value
  // sits to the RIGHT of alert_threshold, not the left -- so writing the
  // gradient stops as "okEnd% then warningEnd%" produced a decreasing
  // stop sequence CSS silently clamps, collapsing the warning zone to
  // nothing. boundary1/boundary2 are named for their actual left-to-right
  // position instead, computed per direction, so the gradient stops are
  // always increasing.
  const rawBoundary1 = higherIsBetter ? alertPct : targetPct
  const rawBoundary2 = higherIsBetter ? targetPct : alertPct
  const boundary1 = Math.max(rawBoundary1, MIN_ZONE_PCT)
  const boundary2 = Math.min(
    Math.max(rawBoundary2, boundary1 + MIN_ZONE_PCT),
    100 - MIN_ZONE_PCT
  )
  const [zoneStartColor, zoneMidColor, zoneEndColor] = higherIsBetter
    ? [
        "hsl(var(--risk-critical))",
        "hsl(var(--risk-medium))",
        "hsl(var(--risk-low))",
      ]
    : [
        "hsl(var(--risk-low))",
        "hsl(var(--risk-medium))",
        "hsl(var(--risk-critical))",
      ]
  const trackGradient = `linear-gradient(to right, ${zoneStartColor} 0%, ${zoneStartColor} ${boundary1}%, ${zoneMidColor} ${boundary1}%, ${zoneMidColor} ${boundary2}%, ${zoneEndColor} ${boundary2}%, ${zoneEndColor} 100%)`

  // Same direction-blindness as the gradient above: the warning range and
  // the OK/Alert comparison symbols only read correctly for lower-is-
  // better. Fixed alongside the gradient fix since it's the same root
  // cause -- only MOCK_KRIS[0] (lower-is-better) renders here today, but
  // a future higher-is-better KRI shouldn't silently show an inverted
  // "Warning 61–29"-style range.
  const warningMin = higherIsBetter
    ? KRI.alert_threshold + 1
    : KRI.target_value + 1
  const warningMax = higherIsBetter
    ? KRI.target_value - 1
    : KRI.alert_threshold - 1
  const okComparator = higherIsBetter ? "≥" : "≤"
  const alertComparator = higherIsBetter ? "≤" : "≥"

  const frequencyLabel = t(`organization.kri.frequency.${KRI.frequency}`)

  return (
    <div
      className={`rounded-[11px] bg-card p-5 transition-shadow duration-300 ease-out motion-reduce:transition-none sm:grid sm:grid-cols-[1.3fr_1fr] sm:items-start sm:gap-6 sm:p-6 ${
        isSelected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : ""
      }`}
    >
      <div>
        {/* Status shows once, in the right-hand card below -- not
            duplicated up here too. An earlier draft of this rework put a
            second copy of the same pill in this corner, which also broke
            the a11y story: a screen reader user would hear "Alert" twice
            with no indication they're the same fact. */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {t("home.productDemo.kriSlider.eyebrow", {
              category: riskCategoryLabel(t, RISK.category),
            })}
          </span>
          {/* Same real risk (CYB-014) the matrix and correlation graph
              above show -- clicking this badge cross-highlights it there
              too, same shared selection those two widgets already
              participate in. */}
          <button
            type="button"
            onClick={toggleSelect}
            aria-pressed={isSelected}
            aria-label={t("home.productDemo.kriSlider.refButtonLabel", {
              ref: RISK.ref,
            })}
            className={`focus-ring font-mono-data rounded-full border px-2 py-0.5 text-[10px] transition-colors duration-150 ease-out ${
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {RISK.ref}
          </button>
        </div>
        {/* <p>, not <h3> -- this widget only mounts under DemoMoment, which
            already supplies the real <h3> section heading above it. */}
        <p className="mb-4 font-heading text-base font-bold text-balance text-foreground sm:text-lg">
          {KRI.name}
        </p>

        <div className="mb-2 flex items-baseline gap-1.5">
          <span className="font-heading text-5xl font-bold text-foreground sm:text-6xl">
            {formatKriNumber(currentValue, i18n.language)}
          </span>
          <span className="text-sm text-muted-foreground">{KRI.unit}</span>
        </div>

        <div className="relative h-4">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full"
            style={{ background: trackGradient }}
          />
          <input
            type="range"
            min={0}
            max={SLIDER_MAX}
            step={1}
            value={currentValue}
            onChange={(e) => setCurrentValue(Number(e.target.value))}
            className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-foreground [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:shadow-sm [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-0 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm"
            aria-label={t("home.productDemo.kriSlider.sliderLabel", {
              name: KRI.name,
            })}
          />
        </div>

        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>0</span>
          <span>{SLIDER_MAX}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES.low.dot}`}
            />
            {t("home.productDemo.kriSlider.zoneOkLabel", {
              symbol: okComparator,
              value: KRI.target_value,
            })}
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES.medium.dot}`}
            />
            {t("home.productDemo.kriSlider.zoneWarningLabel", {
              min: warningMin,
              max: warningMax,
            })}
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES.critical.dot}`}
            />
            {t("home.productDemo.kriSlider.zoneAlertLabel", {
              symbol: alertComparator,
              value: KRI.alert_threshold,
            })}
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-background/40 p-4 text-center sm:mt-0 sm:p-5">
        <div
          className={`value-flash inline-block rounded-full px-1 ${isFlashing ? "is-flashing" : ""}`}
        >
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase transition-all duration-100 ease-out motion-reduce:transition-none ${severityBadgeClasses(
              meta.severityLevel,
              { border: true }
            )} ${labelDipping ? "translate-y-0.5 opacity-70" : "translate-y-0 opacity-100"}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[meta.severityLevel].dot}`}
            />
            {t(meta.labelKey)}
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {status === "OK" && t("home.productDemo.kriSlider.explanationOk")}
          {status === "WARNING" &&
            t("home.productDemo.kriSlider.explanationWarning", {
              owner: KRI.owner,
            })}
          {status === "ALERT" &&
            t("home.productDemo.kriSlider.explanationAlert", {
              owner: KRI.owner,
            })}
        </p>
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs font-semibold text-foreground">
            {t("organization.kri.ownerLabel", { owner: KRI.owner })}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {t("home.productDemo.kriSlider.targetLabel", {
              value: KRI.target_value,
            })}
            {" · "}
            {t("home.productDemo.kriSlider.thresholdLabel", {
              value: KRI.alert_threshold,
            })}
            {" · "}
            {t("home.productDemo.kriSlider.reviewedLabel", {
              frequency: frequencyLabel,
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
