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
  const c = SEVERITY_STYLES[level]
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
