import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import { mockAlerts } from "@/data/mockData"
import type { Alert } from "@/types/organization"
import { Bell, Clock, Loader2, MapPin, Sparkles } from "lucide-react"
import { useState } from "react"

export default function AlertsPage() {
  const [alerts] = useState<Alert[]>(mockAlerts)
  const [isGenerating] = useState(false)

  const criticalCount = alerts.filter((a) => a.severity === "critical").length
  const highCount = alerts.filter((a) => a.severity === "high").length
  const mediumCount = alerts.filter((a) => a.severity === "medium").length
  const lowCount = alerts.filter((a) => a.severity === "low").length

  return (
    <div className="space-y-5 p-6">
      <div className="animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Risk Alerts
          </h1>
          <p className="text-sm text-muted-foreground">
            {alerts.length} active alerts
          </p>
        </div>
        <button
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[0.98] active:scale-95 disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate AI Alerts
        </button>
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
            <button
              key={sev}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <RiskBadge level={sev} />
              <span className="font-mono-data">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Alerts List */}
      <div className="animate-slide-up stagger-2 space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`group rounded-xl border bg-card p-5 transition-all hover:shadow-md ${
              alert.severity === "critical"
                ? "border-risk-critical/30"
                : "border-border"
            }`}
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
                  {alert.country && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {alert.country}
                    </span>
                  )}
                  {alert.ai_generated && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      AI Generated
                    </span>
                  )}
                </div>

                <h3 className="mt-1.5 text-sm leading-tight font-semibold text-foreground">
                  {alert.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {alert.description}
                </p>

                <div className="mt-3 flex items-center gap-4">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(alert.created_at).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  <span className="font-mono-data text-[11px] font-medium text-primary">
                    Relevance:{" "}
                    {(Number(alert.relevance_score) * 100).toFixed(0)}%
                  </span>

                  {alert.matched_risks?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">
                        Matched Risks:
                      </span>
                      {alert.matched_risks.map((r) => (
                        <span
                          key={r}
                          className="font-mono-data rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
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
            <p className="mt-1 text-xs text-muted-foreground">
              Click "Generate AI Alerts" to create new ones
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
