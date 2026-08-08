import type { LucideIcon } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  className?: string
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className = "",
}: MetricCardProps) {
  return (
    <div
      className={`group rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/30 ${className}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
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
