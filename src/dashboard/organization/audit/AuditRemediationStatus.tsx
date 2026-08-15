import { useTranslation } from "react-i18next"
import { useGetAllFindingsQuery } from "@/redux/apis/organization/findings.api"

interface AuditRemediationStatusProps {
  engagementId: string
}

const RESOLVED_STATUSES = new Set(["COMPLETE", "CANT_DO"])

// IIA Standard 2500 requires verifying corrective actions were actually
// implemented before an engagement is truly closed out -- a completed
// engagement previously only showed a hand-typed findings_count with no
// way to tell whether any of those findings were ever remediated. Scopes
// GET /action to this engagement via the auditEngagementId query param
// (aexa-server's Action.auditEngagementId FK already existed from #244;
// the list endpoint just never accepted it as a filter until this round).
export default function AuditRemediationStatus({
  engagementId,
}: AuditRemediationStatusProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useGetAllFindingsQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    auditEngagementId: engagementId,
  })

  if (isLoading || isError) return null

  const findings = data?.data ?? []
  if (findings.length === 0) return null

  // Review round 1 finding: `total` must come from the real server-side
  // count (`meta.total`), not `findings.length` -- the fetch is capped at
  // limit=100, so for an engagement with more findings than that,
  // findings.length would silently understate the true total instead of
  // reflecting it. `resolved` is still only a tally over the fetched page
  // (a real full-accuracy count would mean looping every page), so on an
  // engagement past the cap this can undercount resolved too -- the safer
  // failure direction, since it never claims more progress than is real.
  const resolved = findings.filter((f) => RESOLVED_STATUSES.has(f.status)).length
  const total = data?.meta?.total ?? findings.length
  // Review round 2 finding: total could theoretically report 0 while
  // findings is non-empty (a backend inconsistency, but not one this
  // component should crash on) -- guard against NaN reaching aria-valuenow
  // and the width style.
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0

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
        aria-label={t("organization.audit.remediationLabel", { resolved, total })}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
