import { Loader2, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { KRI } from "@/types/organization"
import { useModalA11y } from "@/hooks/useModalA11y"

interface TrendModalProps {
  kri: KRI | null | undefined
  chartData: { value: number; recorded_at: string }[]
  summary: string
  isLoading: boolean
  isError: boolean
  onClose: () => void
}

// Trend modal (aexa-server#242 / aexa-frontend#211). Only ever mounted
// while `trendKriId` is set, so useModalA11y here is always called with
// isOpen=true -- see UpdateValueModal's own comment for why that's
// equivalent to the previous isOpen-toggling-in-a-persistently-mounted-
// component behavior.
export default function TrendModal({
  kri,
  chartData,
  summary,
  isLoading,
  isError,
  onClose,
}: TrendModalProps) {
  const { t } = useTranslation()
  const modalRef = useModalA11y(true, onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kri-trend-title"
        className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="kri-trend-title" className="text-lg font-bold text-foreground">
            {t("organization.kri.trend.modalTitle", { name: kri?.name ?? "" })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("organization.kri.cancel")}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Fresh full-panel re-score (resilience finding): a failed
            readings fetch fell through to the same empty-state message as
            "this KRI genuinely has no readings yet" -- indistinguishable
            from a real outage.
            Round-1 review of PR #847: gated on chartData.length === 0 too
            -- getKriReadings' providesTags: ["KRI"] means a background
            refetch (e.g. triggered by submitting a new value while this
            modal is open) can fail while the prior successful fetch's
            chart data is still cached. The original version hid that
            still-valid stale chart behind this error message
            unconditionally, the same stale-but-valid-data anti-pattern
            already fixed on Alerts/Intelligence this session. */}
        {!isLoading && isError && chartData.length === 0 && (
          <p role="alert" className="py-8 text-center text-sm text-destructive">
            {t("organization.kri.trend.loadError")}
          </p>
        )}

        {!isLoading && !isError && chartData.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("organization.kri.trend.empty")}
          </p>
        )}

        {!isLoading && isError && chartData.length > 0 && (
          <p role="alert" className="mb-2 text-xs text-destructive">
            {t("organization.kri.trend.refetchFailedStale")}
          </p>
        )}

        {!isLoading && chartData.length > 0 && (
          <div className="h-64">
            {/* Round 9 (accessibility finding): a concise text summary
                conveys the same "what's the trend" signal the chart exists
                to show, without needing a full data-table fallback.
                Round 11 (fresh full-panel re-score): recharts v3's
                accessibilityLayer (on by default) makes the chart's <svg>
                keyboard-focusable with role="application", but it had no
                accessible name of its own -- passing the same summary as
                LineChart's `title` prop (below) renders an <svg><title>
                element, the standard accessible-name mechanism. */}
            <p className="sr-only">{summary}</p>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} title={summary}>
                <XAxis
                  dataKey="recorded_at"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                />
                {kri && (
                  <ReferenceLine
                    y={Number(kri.alert_threshold)}
                    stroke="hsl(var(--risk-critical))"
                    strokeDasharray="4 4"
                    label={{
                      value: t("organization.kri.thresholdLabel"),
                      fontSize: 10,
                      fill: "hsl(var(--risk-critical))",
                    }}
                  />
                )}
                {kri && (
                  <ReferenceLine
                    y={Number(kri.target_value)}
                    stroke="hsl(var(--risk-low))"
                    strokeDasharray="4 4"
                    label={{
                      value: t("organization.kri.targetLabel"),
                      fontSize: 10,
                      fill: "hsl(var(--risk-low))",
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
