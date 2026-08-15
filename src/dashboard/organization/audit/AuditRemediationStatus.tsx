import { useTranslation } from "react-i18next"
import type { IAction } from "@/types/finding"

interface AuditRemediationStatusProps {
  findings: IAction[] | undefined
}

const RESOLVED_STATUSES = new Set(["COMPLETE", "CANT_DO"])

// IIA Standard 2500 requires verifying corrective actions were actually
// implemented before an engagement is truly closed out -- a completed
// engagement previously only showed a hand-typed findings_count with no
// way to tell whether any of those findings were ever remediated.
//
// quality-bar-loop round (Audit Missions efficiency/resilience, fresh-panel
// regression finding): this used to run its own useGetAllFindingsQuery per
// row on mount -- an N+1 pattern that fanned out to one request per
// completed engagement (live-measured: up to ~100 simultaneous requests
// when the page's status filter narrowed to "Completed"). AuditPage now
// fetches findings for every visible completed engagement via
// useBatchedFindingsByEngagement (see its own comment) and passes each
// row's slice down as a plain prop -- this component is purely
// presentational now.
//
// Review-round finding on aexa-frontend#912: a per-row `role="alert"` on
// fetch failure meant a screen reader announced the identical error once
// per completed row (up to ~100 times) instead of once. AuditPage now
// renders a single page-level alert instead; this component just renders
// nothing when it has no findings to show, whether that's because there
// truly are none or because the shared fetch failed (the page-level alert
// covers the failure case).
export default function AuditRemediationStatus({
  findings,
}: AuditRemediationStatusProps) {
  const { t } = useTranslation()

  if (!findings || findings.length === 0) return null

  // Review round 1 finding (carried forward): `total` used to come from
  // the real server-side `meta.total` for a single-engagement fetch; the
  // batched, multi-engagement fetch (useBatchedFindingsByEngagement) is
  // itself capped at the backend's MAX_LIMIT=100 combined across every
  // engagement in that request's chunk, so `meta.total` is no longer a
  // valid per-engagement denominator. Falling back to this engagement's
  // own returned-row count keeps the same "never claims more progress
  // than is real" safety property the original fix established -- on a
  // chunk past the combined cap, both resolved and total for the affected
  // engagement(s) undercount together rather than reporting an inflated
  // total from an unrelated aggregate.
  const resolved = findings.filter((f) =>
    RESOLVED_STATUSES.has(f.status)
  ).length
  const total = findings.length
  // total is always > 0 here (guarded above), so the divide-by-zero/NaN
  // case a prior round guarded against for a server-reported meta.total
  // can no longer happen now that total is derived from the same
  // non-empty array length -- no ternary needed.
  const pct = Math.round((resolved / total) * 100)

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">
        {t("organization.audit.remediationLabel", { resolved, total })}
      </span>
      <div
        className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("organization.audit.remediationLabel", {
          resolved,
          total,
        })}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
