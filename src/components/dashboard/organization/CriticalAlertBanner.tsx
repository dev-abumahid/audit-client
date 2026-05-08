import type { Alert } from "@/types/organization"
import { AlertTriangle, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

export default function CriticalAlertBanner() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)

  const alerts: Alert[] = [
    {
      id: "a1f3c9e2",
      organization_id: "org_001",
      user_id: "user_123",
      source: "system_monitor",
      type: "security",
      severity: "high",
      title: "Unauthorized login attempt detected",
      description: "Multiple failed login attempts from an unknown IP address.",
      relevance_score: 0.87,
      matched_risks: ["brute_force", "unauthorized_access"],
      country: "US",
      is_read: false,
      ai_generated: true,
      is_edited: false,
      created_at: "2026-04-15T08:30:00Z",
    },
    {
      id: "b7d2a4f1",
      organization_id: "org_002",
      user_id: "user_456",
      source: "threat_intel_feed",
      type: "fraud",
      severity: "critical",
      title: "Potential financial fraud activity",
      description: "Suspicious transactions flagged across multiple accounts.",
      relevance_score: 0.93,
      matched_risks: ["fraud", "financial_loss"],
      country: "UK",
      is_read: true,
      ai_generated: true,
      is_edited: true,
      created_at: "2026-04-14T14:15:00Z",
    },
    {
      id: "c9x8z7y6",
      organization_id: "org_003",
      user_id: "user_789",
      source: "ai_detection",
      type: "compliance",
      severity: "critical",
      title: "Data breach risk detected",
      description: "Sensitive data exposure risk identified in system logs.",
      relevance_score: 0.95,
      matched_risks: ["data_breach", "compliance_violation"],
      country: "DE",
      is_read: false,
      ai_generated: true,
      is_edited: false,
      created_at: "2026-04-15T10:00:00Z",
    },
  ]

  const criticalAlerts = alerts
    .filter((alert) => alert.severity === "critical")
    .sort((a, b) => b.relevance_score - a.relevance_score)

  if (dismissed || criticalAlerts.length === 0) return null

  return (
    <div className="animate-fade-in border-b border-risk-critical/30 bg-risk-critical/5 px-6 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 animate-pulse text-risk-critical" />

          <span className="text-xs font-semibold text-risk-critical">
            🚨 {criticalAlerts.length}{" "}
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
