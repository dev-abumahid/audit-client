/* eslint-disable @typescript-eslint/no-explicit-any */
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import {
  useGetAllAlertsQuery,
  useMarkAlertReadMutation,
} from "@/redux/apis/organization/alert.api"
import { getEnumLabel } from "@/utils/enumLabel"
import { formatLocaleDate } from "@/utils/formatDate"
import { SEVERITY_STYLES, severityBadgeClasses } from "@/utils/severityStyles"
import { Bell, Clock, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { toast } from "sonner"

type Severity = "critical" | "high" | "medium" | "low"

// aexa-frontend round-3 audit bug #5: `Alert.type` is a free-form string
// column (see aexa-server prisma/schema/alert.prisma) with no backend enum
// -- the only confirmed system-generated value is 'kri_threshold_breach'
// (kri.service.ts's alert.create call), while the manual-entry endpoint
// (alert.service.ts's create_alert_into_db) lets an ADMIN/LEAD_AUDITOR type
// anything into `type`. So, same convention as getEnumLabel's other
// callers, this maps the one known value to a humanized label and falls
// back to the raw string for anything else instead of crashing or hiding
// unrecognized types.
const ALERT_TYPE_LABEL_KEYS: Record<string, string> = {
  kri_threshold_breach: "organization.alerts.type.kriThresholdBreach",
}

// Active-state classes for each severity's quick-filter chip, matching
// RiskBadge's own bg/text color per level rather than one shared "active"
// color for all 4 chips -- 4 different severities collapsing into a single
// active color made it harder to tell at a glance which chip is selected.
const SEVERITY_ACTIVE_CLASSES: Record<Severity, string> = {
  critical: severityBadgeClasses("critical", { border: true }),
  high: severityBadgeClasses("high", { border: true }),
  medium: severityBadgeClasses("medium", { border: true }),
  low: severityBadgeClasses("low", { border: true }),
}

export default function AlertsPage() {
  const { t, i18n } = useTranslation()
  const {
    data: alertResponse,
    isLoading,
    error,
  } = useGetAllAlertsQuery(undefined)
  const [markAlertRead, { isLoading: isMarkingRead }] =
    useMarkAlertReadMutation()
  const [severityFilter, setSeverityFilter] = useState<Severity | null>(null)

  const allAlerts = alertResponse?.data ?? []
  const alerts = severityFilter
    ? allAlerts.filter((a: any) => a.severity === severityFilter)
    : allAlerts

  const criticalCount = allAlerts.filter(
    (a: any) => a.severity === "critical"
  ).length
  const highCount = allAlerts.filter((a: any) => a.severity === "high").length
  const mediumCount = allAlerts.filter(
    (a: any) => a.severity === "medium"
  ).length
  const lowCount = allAlerts.filter((a: any) => a.severity === "low").length

  const handleMarkRead = async (id: string) => {
    try {
      await markAlertRead(id).unwrap()
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.alerts.markReadFailed")
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          {t("organization.alerts.loadFailed")}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-6">
      <div className="animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {t("organization.alerts.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {/* Always the true org-wide total, not the severity-filtered
                count below -- a severity filter narrows what's *shown*, it
                shouldn't make the header lie about how many alerts exist. */}
            {t("organization.alerts.activeCount", { count: allAlerts.length })}
          </p>
        </div>
      </div>

      {/* Severity Quick Filters */}
      <div className="animate-slide-up flex gap-2">
        {(["critical", "high", "medium", "low"] as const).map((sev) => {
          const count =
            sev === "critical"
              ? criticalCount
              : sev === "high"
                ? highCount
                : sev === "medium"
                  ? mediumCount
                  : lowCount

          const isActive = severityFilter === sev

          return (
            <button
              key={sev}
              type="button"
              aria-pressed={isActive}
              onClick={() =>
                setSeverityFilter((prev) => (prev === sev ? null : sev))
              }
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? SEVERITY_ACTIVE_CLASSES[sev]
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <RiskBadge level={sev} />
              <span className="font-mono-data">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Alerts List */}
      <div className="animate-slide-up stagger-2 space-y-3">
        <h2 className="sr-only">{t("organization.alerts.listHeading")}</h2>
        {alerts.map((alert: any) => (
          <div
            key={alert.id}
            className={`group rounded-xl border bg-card p-5 transition-all hover:shadow-md ${
              alert.severity === "critical"
                ? "border-risk-critical/30"
                : "border-border"
            } ${alert.is_read ? "opacity-60" : ""}`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  alert.severity === "critical"
                    ? "bg-risk-critical/10"
                    : alert.severity === "high"
                      ? "bg-risk-high/10"
                      : alert.severity === "medium"
                        ? "bg-risk-medium/10"
                        : "bg-risk-low/10"
                }`}
              >
                <Bell
                  className={`h-5 w-5 ${SEVERITY_STYLES[alert.severity as Severity].text}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={alert.severity} />
                  <span className="text-xs font-semibold text-primary">
                    {alert.source}
                  </span>
                  {alert.type && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {getEnumLabel(t, ALERT_TYPE_LABEL_KEYS, alert.type)}
                      </span>
                    </>
                  )}
                  {alert.ai_generated && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {t("organization.alerts.aiGenerated")}
                    </span>
                  )}
                  {!alert.is_read && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      {t("organization.alerts.new")}
                    </span>
                  )}
                </div>

                <h3 className="mt-1.5 text-sm leading-tight font-semibold text-foreground">
                  {alert.title}
                </h3>
                {alert.description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {alert.description}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatLocaleDate(alert.createdAt, i18n.language, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* aexa-frontend#530: kri_id is populated for every
                        kri_threshold_breach alert but was never surfaced --
                        this is the one-way-blind half of the cross-link,
                        the other half (alert counts on the KRI card) lives
                        in KriDashboardPage.tsx. */}
                    {alert.kri_id && (
                      <Link
                        to={`/organization/kri?highlight=${encodeURIComponent(alert.kri_id)}`}
                        className="focus-ring rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                      >
                        {t("organization.alerts.viewKri")}
                      </Link>
                    )}
                    {!alert.is_read && (
                      <button
                        onClick={() => handleMarkRead(alert.id)}
                        disabled={isMarkingRead}
                        className="focus-ring rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                      >
                        {t("organization.alerts.markAsRead")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="py-12 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {severityFilter
                ? t("organization.alerts.emptyFiltered")
                : t("organization.alerts.empty")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
