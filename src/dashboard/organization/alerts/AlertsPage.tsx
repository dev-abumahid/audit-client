/* eslint-disable @typescript-eslint/no-explicit-any */
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import {
  useGetAllAlertsQuery,
  useMarkAlertReadMutation,
} from "@/redux/apis/organization/alert.api"
import { Bell, Clock, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function AlertsPage() {
  const {
    data: alertResponse,
    isLoading,
    error,
  } = useGetAllAlertsQuery(undefined)
  const [markAlertRead, { isLoading: isMarkingRead }] =
    useMarkAlertReadMutation()

  const alerts = alertResponse?.data ?? []

  const criticalCount = alerts.filter(
    (a: any) => a.severity === "critical"
  ).length
  const highCount = alerts.filter((a: any) => a.severity === "high").length
  const mediumCount = alerts.filter((a: any) => a.severity === "medium").length
  const lowCount = alerts.filter((a: any) => a.severity === "low").length

  const handleMarkRead = async (id: string) => {
    try {
      await markAlertRead(id).unwrap()
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to mark alert as read")
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
          Failed to load alerts. Please try again later.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-6">
      <div className="animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Risk Alerts
          </h1>
          <p className="text-sm text-muted-foreground">
            {alerts.length} active alert{alerts.length !== 1 ? "s" : ""}
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

          return (
            <div
              key={sev}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              <RiskBadge level={sev} />
              <span className="font-mono-data">{count}</span>
            </div>
          )
        })}
      </div>

      {/* Alerts List */}
      <div className="animate-slide-up stagger-2 space-y-3">
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
                      : "bg-risk-medium/10"
                }`}
              >
                <Bell
                  className={`h-5 w-5 ${
                    alert.severity === "critical"
                      ? "text-risk-critical"
                      : alert.severity === "high"
                        ? "text-risk-high"
                        : "text-risk-medium"
                  }`}
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
                        {alert.type}
                      </span>
                    </>
                  )}
                  {alert.ai_generated && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      AI Generated
                    </span>
                  )}
                  {!alert.is_read && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      New
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
                    {new Date(alert.createdAt).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {!alert.is_read && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      disabled={isMarkingRead}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="py-12 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No alerts yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
