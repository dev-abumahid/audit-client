import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { MOCK_KRIS } from "@/dashboard/organization/overview/overviewMockData"
import { formatKriNumber, kriStatusMeta } from "@/dashboard/organization/kri/kriConfig"
import { useValueChangeFlash } from "@/hooks/useValueChangeFlash"
import { computeKriStatus } from "@/utils/kriStatus"
import { SEVERITY_STYLES, severityBadgeClasses } from "@/utils/severityStyles"

// Landing overhaul PR2 (theme-improvement-initiative): the plan describes
// this as "drag a threshold." Built it as dragging the CURRENT READING
// instead, against the KRI's real fixed target/alert_threshold -- with
// target_value(0) < alert_threshold(5) < current_value(14) all fixed,
// dragging only alert_threshold can never reach OK (current > target
// always, and OK depends solely on current vs target, not the threshold).
// Dragging the reading is also the more realistic product moment: watching
// a live value cross configured thresholds, not watching the thresholds
// themselves move.
const KRI = MOCK_KRIS[0]
const SLIDER_MAX = 20

// Same two-phase background flash as the real KRI dashboard
// (useValueChangeFlash + .value-flash / .is-flashing in index.css) --
// reused as a single-item list (this hook's documented shape is "any list
// of items keyed by id with a comparable value," and one status counts).
export default function KriThresholdSliderWidget() {
  const { t, i18n } = useTranslation()
  const [currentValue, setCurrentValue] = useState(KRI.current_value)
  const status = computeKriStatus(currentValue, KRI.alert_threshold, KRI.target_value)
  const meta = kriStatusMeta(status)

  // Review finding on PR #1014: useValueChangeFlash's own doc comment says
  // `items` should be a referentially-stable array so a new reference alone
  // doesn't trigger the hook's "check for changes" diff. An explicit
  // useMemo here conflicts with this codebase's React Compiler (it flags
  // "existing manual memoization could not be preserved" and skips
  // optimizing the component) -- the compiler already auto-memoizes this
  // array literal by its `status` dependency, same as every other inline
  // array/object in this codebase relies on it for. Not a functional bug
  // either way: the hook diffs by value internally, so a non-memoized
  // reference just means the diff effect re-runs redundantly, never
  // incorrectly.
  const { flashingKeys } = useValueChangeFlash(
    [{ key: "kri-slider-status", status }],
    (item) => item.key,
    (item) => item.status
  )
  const isFlashing = flashingKeys.has("kri-slider-status")

  // Small 2-3px vertical dip on the status label itself, on top of the
  // shared value-flash background -- v3 motion plan: "the status text does
  // a tiny 2-3px vertical swap ... while the chip background softly
  // changes," so a threshold crossing never reads as a hard snap. A true
  // crossfade would need the old and new label mounted simultaneously;
  // this dip-and-settle is the cheap, honest approximation of that same
  // "not a hard snap" intent.
  const [labelDipping, setLabelDipping] = useState(false)
  const prevStatusRef = useRef(status)
  useEffect(() => {
    if (prevStatusRef.current === status) return
    prevStatusRef.current = status
    // Deferred via requestAnimationFrame rather than called synchronously in
    // the effect body -- same React Compiler cascading-render rule
    // (react-hooks/set-state-in-effect) useCountUp.ts's own effect runs
    // into, same fix.
    const frame = requestAnimationFrame(() => setLabelDipping(true))
    const timer = setTimeout(() => setLabelDipping(false), 140)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [status])

  return (
    <div className="rounded-[11px] bg-card p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t("home.productDemo.kriSlider.title")}
        </h3>
        <div
          className={`value-flash rounded-full px-1 ${isFlashing ? "is-flashing" : ""}`}
        >
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase transition-all duration-150 ease-out motion-reduce:transition-none ${severityBadgeClasses(
              meta.severityLevel
            )} ${labelDipping ? "translate-y-0.5 opacity-70" : "translate-y-0 opacity-100"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[meta.severityLevel].dot}`} />
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
