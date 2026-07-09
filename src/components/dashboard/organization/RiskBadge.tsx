interface RiskBadgeProps {
  level: "critical" | "high" | "medium" | "low"
  label?: string
  size?: "sm" | "md"
}

const config = {
  critical: {
    bg: "bg-risk-critical/15",
    text: "text-risk-critical",
    dot: "bg-risk-critical",
    default: "Critique",
  },
  high: {
    bg: "bg-risk-high/15",
    text: "text-risk-high",
    dot: "bg-risk-high",
    default: "Élevé",
  },
  medium: {
    bg: "bg-risk-medium/15",
    text: "text-risk-medium",
    dot: "bg-risk-medium",
    default: "Moyen",
  },
  low: {
    bg: "bg-risk-low/15",
    text: "text-risk-low",
    dot: "bg-risk-low",
    default: "Faible",
  },
}

export default function RiskBadge({
  level,
  label,
  size = "sm",
}: RiskBadgeProps) {
  const c = config[level]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${c.bg} ${c.text} font-medium ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {label || c.default}
    </span>
  )
}
