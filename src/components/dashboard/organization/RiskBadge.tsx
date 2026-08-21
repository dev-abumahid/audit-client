import { Badge } from "@/components/ui/badge"
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
  // not just the one that first surfaced it. Badge's `variant` prop is
  // typed to the same canonical severity keys, so the same runtime guard
  // still applies before it's used as a variant.
  const safeLevel = level in SEVERITY_STYLES ? level : "neutral"
  const dot = SEVERITY_STYLES[safeLevel].dot
  return (
    <Badge variant={safeLevel} size={size}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label || t(`riskLevel.${level}`)}
    </Badge>
  )
}
