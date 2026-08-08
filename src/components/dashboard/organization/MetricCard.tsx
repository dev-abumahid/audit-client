import type { LucideIcon } from "lucide-react"
import { Link } from "react-router"

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  className?: string
  // quality-bar-loop round 14 (industry-standards): this card's
  // hover:border-primary/30 styling always implied clickability with
  // nothing behind it -- an optional drill-down destination, not a
  // separate wrapper component, so the hover affordance and the actual
  // behavior it promises live in one place. Cards without a real
  // destination (e.g. Revenue, which has no filtered view to land on)
  // stay a plain, honestly-inert div.
  to?: string
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className = "",
  to,
}: MetricCardProps) {
  const content = (
    <>
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
    </>
  )

  const sharedClassName = `group rounded-xl border border-border bg-card p-5 transition-colors duration-200 ${className}`

  if (to) {
    return (
      <Link
        to={to}
        className={`focus-ring block hover:border-primary/30 ${sharedClassName}`}
      >
        {content}
      </Link>
    )
  }

  // quality-bar-loop round 16 (visual-polish regression): the hover
  // affordance used to apply unconditionally to both branches, so a card
  // with no destination (Revenue) still highlighted on hover exactly like
  // the 5 real links -- a false clickability signal, arguably worse than
  // the original "looks clickable, isn't" finding this `to` prop was
  // meant to close, since it's now the one visible outlier among 6.
  return <div className={sharedClassName}>{content}</div>
}
