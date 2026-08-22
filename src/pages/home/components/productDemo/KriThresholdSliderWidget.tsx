import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { MOCK_KRIS } from "@/dashboard/organization/overview/overviewMockData"
import {
  formatKriNumber,
  kriStatusMeta,
} from "@/dashboard/organization/kri/kriConfig"
import { useValueChangeFlash } from "@/hooks/useValueChangeFlash"
import { computeKriStatus } from "@/utils/kriStatus"
import { SEVERITY_STYLES, severityBadgeClasses } from "@/utils/severityStyles"

// Drags the CURRENT READING, not the threshold -- with target_value(0) <
// alert_threshold(5) < current_value(14) all fixed, dragging only the
// threshold could never reach OK (current > target always). Also the more
// realistic product moment: watching a live value cross configured
// thresholds, not watching the thresholds themselves move.
const KRI = MOCK_KRIS[0]
const SLIDER_MAX = 20

// Same two-phase background flash as the real KRI dashboard
// (useValueChangeFlash + .value-flash/.is-flashing), reused as a
// single-item list -- the hook's shape is "items keyed by id with a
// comparable value," and one status counts.
export default function KriThresholdSliderWidget() {
  const { t, i18n } = useTranslation()
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

  return (
    <div className="rounded-[11px] bg-card p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        {/* <p>, not <h3> -- this widget only mounts under DemoMoment, which
            already supplies the real <h3> section heading above it. */}
        <p className="text-sm font-semibold text-foreground">
          {t("home.productDemo.kriSlider.title")}
        </p>
        <div
          className={`value-flash rounded-full px-1 ${isFlashing ? "is-flashing" : ""}`}
        >
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase transition-all duration-100 ease-out motion-reduce:transition-none ${severityBadgeClasses(
              meta.severityLevel
            )} ${labelDipping ? "translate-y-0.5 opacity-70" : "translate-y-0 opacity-100"}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[meta.severityLevel].dot}`}
            />
            {t(meta.labelKey)}
          </span>
        </div>
      </div>
      <p className="mb-4 truncate text-xs text-muted-foreground">{KRI.name}</p>

      <div className="mb-2 flex items-baseline gap-1">
        <span className="font-mono-data text-2xl font-bold text-foreground">
          {formatKriNumber(currentValue, i18n.language)}
        </span>
        <span className="text-xs text-muted-foreground">{KRI.unit}</span>
      </div>

      <input
        type="range"
        min={0}
        max={SLIDER_MAX}
        step={1}
        value={currentValue}
        onChange={(e) => setCurrentValue(Number(e.target.value))}
        className="w-full accent-primary"
        aria-label={t("home.productDemo.kriSlider.sliderLabel", {
          name: KRI.name,
        })}
      />

      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>
          {t("home.productDemo.kriSlider.targetLabel", {
            value: KRI.target_value,
          })}
        </span>
        <span>
          {t("home.productDemo.kriSlider.thresholdLabel", {
            value: KRI.alert_threshold,
          })}
        </span>
        <span>{SLIDER_MAX}</span>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {t("home.productDemo.kriSlider.caption")}
      </p>
    </div>
  )
}
