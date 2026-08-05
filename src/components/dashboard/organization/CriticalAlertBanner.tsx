import { useGetAllAlertsQuery } from "@/redux/apis/organization/alert.api"
import type { Alert } from "@/types/organization"
import { SEVERITY_STYLES } from "@/utils/severityStyles"
import { AlertTriangle, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

export default function CriticalAlertBanner() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  const { data: alertResponse } = useGetAllAlertsQuery()
  const alerts: Alert[] = alertResponse?.data ?? []

  // Alert has no relevance_score column on the real backend (see
  // alert.service.ts) -- this used to sort by that field, which was always
  // undefined, so the .sort() was a silent no-op. The list already arrives
  // createdAt-desc from GET /alert, which is a reasonable "most recent
  // first" order for a banner, so there's nothing left to sort by here.
  // Found while typing this endpoint (issue #108).
  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical")

  if (dismissed || criticalAlerts.length === 0) return null

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
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
