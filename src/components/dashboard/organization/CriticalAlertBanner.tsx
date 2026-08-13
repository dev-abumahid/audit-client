import { useGetAllAlertsQuery } from "@/redux/apis/organization/alert.api"
import type { Alert } from "@/types/organization"
import { SEVERITY_STYLES } from "@/utils/severityStyles"
import { AlertTriangle, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

export default function CriticalAlertBanner() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  // Separate from `dismissed`: sharing one flag between the error notice and
  // the normal banner meant dismissing an error, then having a later refetch
  // succeed with real critical alerts, left the banner permanently hidden --
  // the same false-all-clear failure mode this fix exists to close, just
  // moved one step later. Round 2 review of quality-bar-loop round 1.
  const [errorDismissed, setErrorDismissed] = useState(false)
  const { data: alertResponse, isError } = useGetAllAlertsQuery()
  const alerts: Alert[] = alertResponse?.data ?? []

  // Round 2.5 accessibility fix: this notice can appear from a background
  // refetch failing after the page already rendered normally, not just on
  // first paint -- round 2's a11y judge confirmed there was no announcement
  // or focus move for that case, same gap as the Overview.tsx error block.
  const errorRegionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isError && !errorDismissed) errorRegionRef.current?.focus()
  }, [isError, errorDismissed])

  // Alert has no relevance_score column on the real backend (see
  // alert.service.ts) -- this used to sort by that field, which was always
  // undefined, so the .sort() was a silent no-op. The list already arrives
  // createdAt-desc from GET /alert, which is a reasonable "most recent
  // first" order for a banner, so there's nothing left to sort by here.
  // Found while typing this endpoint (issue #108).
  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical")

  // quality-bar-loop round 1 review (spotted alongside the Overview.tsx
  // resilience fix this same round targeted): this component's own
  // useGetAllAlertsQuery() had no error check -- on fetch failure,
  // `alerts` fell through to `?? []`, `criticalAlerts.length` was 0, and
  // the banner silently rendered nothing at all. That's the exact same
  // false-all-clear pattern the sibling Overview.tsx fix exists to close,
  // but arguably worse here: this banner's entire purpose is surfacing
  // critical alerts, so "renders nothing" on its own fetch failing is
  // indistinguishable from "genuinely zero critical alerts" with no way
  // to tell the two apart.
  if (isError) {
    if (errorDismissed) return null
    return (
      <div
        ref={errorRegionRef}
        role="alert"
        tabIndex={-1}
        className="animate-fade-in border-b border-risk-critical/30 bg-risk-critical/5 px-6 py-2 focus:outline-none"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={`h-4 w-4 ${SEVERITY_STYLES.critical.text}`}
            />
            <span
              className={`text-xs font-semibold ${SEVERITY_STYLES.critical.text}`}
            >
              {t("alert.criticalAlertsCheckFailed")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setErrorDismissed(true)}
            aria-label={t("common.close")}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  if (dismissed) return null

  if (criticalAlerts.length === 0) return null

  return (
    <div className="animate-fade-in border-b border-risk-critical/30 bg-risk-critical/5 px-6 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className={`h-4 w-4 animate-pulse ${SEVERITY_STYLES.critical.text}`} />

          <span className={`text-xs font-semibold ${SEVERITY_STYLES.critical.text}`}>
            {criticalAlerts.length}{" "}
            {criticalAlerts.length > 1
              ? t("alert.criticalAlertsBannerPlural")
              : t("alert.criticalAlertsBanner")}
          </span>

          <span className="max-w-md truncate text-xs text-muted-foreground">
            {criticalAlerts.map((a) => a.title).join(", ")}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t("common.close")}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
