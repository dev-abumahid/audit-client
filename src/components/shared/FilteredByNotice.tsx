import { Link } from "react-router"

interface FilteredByNoticeProps {
  label: string
  clearLabel: string
  clearHref: string
  className?: string
  // Lets a caller wire aria-describedby from another control (e.g.
  // InspectionTable.tsx's disabled status dropdown) to this notice.
  id?: string
  // Round-18 review finding (RiskRegisterPage): clearHref only ever
  // strips this notice's own URL param -- a caller with additional
  // client-state filters that aren't part of clearHref (search, sort,
  // etc.) needs a chance to reset those too, or "Clear filter" silently
  // fails to clear anything the user can see. Optional and additive so
  // the other 3 existing callers (KriDashboardPage, AllFindingsPage,
  // InspectionTable), which have no such extra state, are unaffected.
  // Round-19 review finding: receives the click event so a caller that
  // needs to own the full navigation atomically (see RiskRegisterPage)
  // can preventDefault() and avoid racing this Link's own navigate()
  // against its own URL update.
  onClear?: (event: React.MouseEvent<HTMLAnchorElement>) => void
}

// quality-bar-loop round 16 (code quality + accessibility regression fix):
// the round-14 KPI drill-down feature copy-pasted this exact "filtered by X,
// clear filter" block near-identically across 4 destination pages
// (RiskRegisterPage, KriDashboardPage, AllFindingsPage, InspectionTable),
// none of which announced the filtered state to screen readers -- a user
// landing here via a dashboard link got a silently-narrowed page with no
// confirmation anything changed. `role="status"` is an implicit
// `aria-live="polite"` region, so a screen reader announces this notice as
// soon as it mounts, without needing focus to land on it first.
export default function FilteredByNotice({
  label,
  clearLabel,
  clearHref,
  className = "",
  id,
  onClear,
}: FilteredByNoticeProps) {
  return (
    <div
      id={id}
      role="status"
      className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}
    >
      <span>{label}</span>
      <Link
        to={clearHref}
        onClick={onClear}
        className="focus-ring rounded text-primary hover:underline"
      >
        {clearLabel}
      </Link>
    </div>
  )
}
