import { type LucideIcon, Minus, TrendingDown, TrendingUp } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: "up" | "down" | "stable"
  trendValue?: string
  trendGood?: boolean
  className?: string
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  trendGood,
  className = "",
}: MetricCardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus

  return (
    <div
      className={`group rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              trendGood
                ? "bg-risk-low/10 text-risk-low"
                : "bg-risk-critical/10 text-risk-critical"
            }`}
          >
            <TrendIcon className="h-3 w-3" />
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="font-mono-data text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
          {title}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground/70">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
