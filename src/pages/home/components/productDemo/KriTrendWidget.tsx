import { useTranslation } from "react-i18next"
import { MOCK_KRIS } from "@/dashboard/organization/overview/overviewMockData"
import { KRI_STATUS_META } from "@/dashboard/organization/kri/kriConfig"
import { useCountUp } from "@/hooks/useCountUp"
import { SEVERITY_STYLES } from "@/utils/severityStyles"

// Phase E redesign: KRI unit is "count", the current_value is real mock
// data (MOCK_KRIS[0]), but there's no historical time-series in the mock
// fixtures to plot a real trend line from -- KRIs only ever store a single
// current_value snapshot. This hand-authored point sequence is an
// illustrative trend SHAPE (rising toward the real current_value, crossing
// the real alert_threshold partway through), not derived data -- same
// "real endpoint, illustrative path" approach as HeroProductVisual's own
// CATEGORY_BARS heights.
const KRI = MOCK_KRIS[0]
const TREND_POINTS = [4, 5, 6, 6, 9, 11, 12, KRI.current_value]

// Review finding: this card was the only one of the 3-widget rail with no
// closing border-t legend/caption row (the rail's risk-matrix card has its
// own selected-risks result panel, RiskGraphWidget has a caption), so the
// CSS grid's default
// items-stretch left a large blank block below its shorter content once
// stretched to match its taller siblings' height. Real content, not
// padding: the same KRI_STATUS_META the live KRI dashboard uses for its
// own status badges, keyed the same OK/WARNING/ALERT order the threshold
// slider demo's own target/alert copy already implies.
const STATUS_LEGEND_ORDER = ["OK", "WARNING", "ALERT"] as const

const CHART_WIDTH = 280
const CHART_HEIGHT = 120
const PADDING = 12

function toPath(points: number[], maxValue: number): string {
  const stepX = (CHART_WIDTH - PADDING * 2) / (points.length - 1)
  const usableHeight = CHART_HEIGHT - PADDING * 2
  return points
    .map((value, i) => {
      const x = PADDING + i * stepX
      const y = PADDING + usableHeight - (value / maxValue) * usableHeight
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

export default function KriTrendWidget({ animate }: { animate: boolean }) {
  const { t } = useTranslation()
  const maxValue = Math.max(...TREND_POINTS, KRI.alert_threshold) * 1.15
  const path = toPath(TREND_POINTS, maxValue)
  const thresholdY =
    PADDING +
    (CHART_HEIGHT - PADDING * 2) -
    (KRI.alert_threshold / maxValue) * (CHART_HEIGHT - PADDING * 2)
  const currentValue = useCountUp(KRI.current_value, animate, 1400)

  return (
    <div className="flex h-full flex-col rounded-[11px] bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {t("home.productDemo.kriTrend.title")}
        </h3>
        <span className="rounded-full bg-risk-critical/15 px-2 py-0.5 text-[10px] font-semibold text-red-700 uppercase dark:text-red-400">
          {t("home.productDemo.kriTrend.alertBadge")}
        </span>
      </div>
      <p className="mb-3 truncate text-xs text-muted-foreground">{KRI.name}</p>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={t("home.productDemo.kriTrend.chartLabel", {
          value: KRI.current_value,
          unit: KRI.unit,
        })}
      >
        {/* Threshold line -- dashed, drawn first so the trend line and its
            fill sit visually on top. */}
        <line
          x1={PADDING}
          x2={CHART_WIDTH - PADDING}
          y1={thresholdY}
          y2={thresholdY}
          className="stroke-risk-critical/50"
          strokeWidth={1}
          strokeDasharray="4 3"
        />

        {/* Area fill under the line, fading in slightly after the line
            draws so it reads as "filling in behind" the drawn path. */}
        <path
          d={`${path} L${CHART_WIDTH - PADDING},${CHART_HEIGHT - PADDING} L${PADDING},${CHART_HEIGHT - PADDING} Z`}
          className={`fill-primary/10 transition-opacity delay-700 duration-700 ease-out motion-reduce:transition-none ${
            animate ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* The trend line itself: a fixed-length dash array equal to the
            path's own approximate length, offset to fully hidden, then
            animated back to 0 -- the classic SVG "draw-in" technique.
            pathLength="1" normalizes the path to a 0-1 length regardless of
            its real geometry, so the dasharray/offset can use simple
            round numbers instead of measuring the path in JS. */}
        <path
          d={path}
          fill="none"
          pathLength={1}
          className={`stroke-primary transition-[stroke-dashoffset] duration-[1400ms] ease-out motion-reduce:transition-none ${
            animate ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:1]"
          }`}
          strokeWidth={2.5}
          strokeDasharray={1}
          strokeLinecap="round"
        />
      </svg>

      <div className="mt-2 flex items-baseline justify-between">
        <div>
          <span className="font-mono-data text-2xl font-bold text-foreground">
            {currentValue}
          </span>
          <span className="ml-1 text-xs text-muted-foreground">{KRI.unit}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {t("home.productDemo.kriTrend.thresholdLabel", {
            value: KRI.alert_threshold,
          })}
        </span>
      </div>

      {/* mt-auto -- pushes the legend to the bottom of the card's stretched
          height (the rail grid uses items-stretch, so this card is often
          taller than its own content), instead of leaving a trailing gap
          below it. */}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3">
        {STATUS_LEGEND_ORDER.map((status) => {
          const meta = KRI_STATUS_META[status]
          return (
            <span
              key={status}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                className={`h-2 w-2 rounded-full ${SEVERITY_STYLES[meta.severityLevel].dot}`}
              />
              {t(meta.labelKey)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
