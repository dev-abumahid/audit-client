import { SEVERITY_STYLES } from "@/utils/severityStyles"
import { useTranslation } from "react-i18next"

interface RiskBadgeProps {
  level: "critical" | "high" | "medium" | "low"
  label?: string
  size?: "sm" | "md"
}

export default function RiskBadge({
  level,
  label,
  size = "sm",
}: RiskBadgeProps) {
  const { t } = useTranslation()
  // quality-bar-loop round 16 (resilience regression, found alongside the
  // same bug class in AlertsPage.tsx): `level` is typed to the 4 canonical
  // values, but this component is fed real API data (alert.severity,
  // risk severity, etc.) at several call sites with no runtime guard --
  // an unrecognized value crashed every caller of this shared component,
  // not just the one that first surfaced it.
  const c = SEVERITY_STYLES[level] ?? SEVERITY_STYLES.neutral
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${c.bg} ${c.text} font-medium ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {label || t(`riskLevel.${level}`)}
    </span>
  )
}
