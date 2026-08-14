import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import {
  useGetAllAlertsQuery,
  useMarkAlertReadMutation,
} from "@/redux/apis/organization/alert.api"
import type { Alert } from "@/types/organization"
import { getEnumLabel } from "@/utils/enumLabel"
import { formatLocaleDate } from "@/utils/formatDate"
import { SEVERITY_STYLES, severityBadgeClasses } from "@/utils/severityStyles"
import { Bell, CheckCheck, Clock, Loader2, RotateCw } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"

type Severity = "critical" | "high" | "medium" | "low"

// aexa-frontend round-3 audit bug #5: `Alert.type` is a free-form string
// column (see aexa-server prisma/schema/alert.prisma) with no backend enum
// -- the only confirmed system-generated value is 'kri_threshold_breach'
// (kri.service.ts's alert.create call), while the manual-entry endpoint
// (alert.service.ts's create_alert_into_db) lets an ADMIN/LEAD_AUDITOR type
// anything into `type`. So, same convention as getEnumLabel's other
// callers, this maps the one known value to a humanized label and falls
// back to the raw string for anything else instead of crashing or hiding
// unrecognized types.
const ALERT_TYPE_LABEL_KEYS: Record<string, string> = {
  kri_threshold_breach: "organization.alerts.type.kriThresholdBreach",
}

// Active-state classes for each severity's quick-filter chip, matching
// RiskBadge's own bg/text color per level rather than one shared "active"
// color for all 4 chips -- 4 different severities collapsing into a single
// active color made it harder to tell at a glance which chip is selected.
const SEVERITY_ACTIVE_CLASSES: Record<Severity, string> = {
  critical: severityBadgeClasses("critical", { border: true }),
  high: severityBadgeClasses("high", { border: true }),
  medium: severityBadgeClasses("medium", { border: true }),
  low: severityBadgeClasses("low", { border: true }),
}

export default function AlertsPage() {
  const { t, i18n } = useTranslation()
  // Round 5 (security finding): mark-read/mark-all-read had no role gate
  // at all, unlike every sibling org page that mutates state. `is_read`
  // is an ORG-WIDE field (no per-user scoping), so an ungated mutation
  // here isn't just a missing UI affordance -- any authenticated member,
  // including a low-privilege VIEWER, could silently clear the unread
  // state for the whole org and hide a real critical alert from an
  // Admin/Lead Auditor. Same canWriteOrgResource convention as
  // RiskRegisterPage/KriDashboardPage/etc.
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)
  const {
    data: alertResponse,
    isLoading,
    error,
    refetch,
  } = useGetAllAlertsQuery(undefined)
  const [markAlertRead] = useMarkAlertReadMutation()
  // Round-4 review finding: `isMarkingRead` used to be the mutation
  // hook's own single shared isLoading flag -- clicking "Mark as read" on
  // one alert disabled every OTHER unread alert's button too, with no
  // indication why (they just looked broken). Tracked per-id instead so
  // only the row actually being marked read shows as busy.
  const [markingReadIds, setMarkingReadIds] = useState<Set<string>>(
    new Set()
  )
  // Round-4 industry-standards finding: no bulk action existed at all
  // (not even mark-all-read) despite there being no per-org limit on how
  // many unread alerts can pile up. No bulk endpoint exists server-side
  // (aexa-server's alert.route.ts only has a per-id PATCH /:id/read), so
  // this fires the same per-id mutation in parallel across every
  // currently-unread, currently-*visible* alert (respecting the active
  // severity filter, same as a user would expect "mark all as read" to
  // mean "in what I'm looking at," not silently reach outside it).
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)
  // quality-bar-loop round 14 (industry-standards): the dashboard's
  // "Critical Alerts" KPI card used to be a static, non-clickable number --
  // it now links here with ?severity=critical, seeding the same
  // quick-filter chips this page already had rather than adding a second
  // filter mechanism. Read once on mount, same as a normal initial value --
  // a user changing chips afterward isn't expected to keep syncing back to
  // the URL bar.
  const [searchParams] = useSearchParams()
  const [severityFilter, setSeverityFilter] = useState<Severity | null>(() => {
    const param = searchParams.get("severity")
    return param && param in SEVERITY_ACTIVE_CLASSES
      ? (param as Severity)
      : null
  })

  // quality-bar-loop round 3 (efficiency, round-1 finding): `?? []`
  // creates a fresh array reference every render when data is still
  // undefined, which would defeat the useMemo calls below keyed on
  // this -- memoized so the empty-array fallback is referentially
  // stable too.
  const allAlerts = useMemo(() => alertResponse?.data ?? [], [alertResponse])
  const alerts = useMemo(
    () =>
      severityFilter
        ? allAlerts.filter((a: Alert) => a.severity === severityFilter)
        : allAlerts,
    [allAlerts, severityFilter]
  )

  // quality-bar-loop round 3 (efficiency, round-1 finding): 4 separate
  // `.filter().length` passes over `allAlerts` recomputed on every
  // render before this, including on every severityFilter toggle and
  // any unrelated re-render (e.g. isMarkingRead flipping) -- combined
  // into a single pass.
  const { criticalCount, highCount, mediumCount, lowCount } = useMemo(() => {
    let critical = 0
    let high = 0
    let medium = 0
    let low = 0
    for (const a of allAlerts) {
      if (a.severity === "critical") critical++
      else if (a.severity === "high") high++
      else if (a.severity === "medium") medium++
      else if (a.severity === "low") low++
    }
    return {
      criticalCount: critical,
      highCount: high,
      mediumCount: medium,
      lowCount: low,
    }
  }, [allAlerts])

  // Round-4 UX finding: the header's "N active alerts" stat is the true
  // org-wide total regardless of read state (deliberately, per the round-14
  // comment above) -- but that also meant there was no unread count
  // anywhere on the page at all, in a header stat or otherwise.
  const unreadCount = useMemo(
    () => allAlerts.filter((a: Alert) => !a.is_read).length,
    [allAlerts]
  )
  // Round-4 review finding: the mark-all-read button's visibility used to
  // be gated on the org-wide `unreadCount` above, while the action itself
  // only ever operates on the currently-*filtered* `alerts` list -- a
  // severity filter that hides every unread alert (while unread ones
  // exist under a DIFFERENT severity) left the button visible but
  // clicking it silently did nothing (the `unreadIds.length === 0` early
  // return, with no toast or explanation). Gating visibility on this
  // filtered count instead keeps the button and its action in sync.
  const filteredUnreadCount = useMemo(
    () => alerts.filter((a: Alert) => !a.is_read).length,
    [alerts]
  )

  const handleMarkRead = async (id: string) => {
    setMarkingReadIds((prev) => new Set(prev).add(id))
    try {
      await markAlertRead(id).unwrap()
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.alerts.markReadFailed")
      toast.error(message)
    } finally {
      setMarkingReadIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleMarkAllRead = async () => {
    const unreadIds = alerts
      .filter((a: Alert) => !a.is_read)
      .map((a: Alert) => a.id)
    if (unreadIds.length === 0) return

    setIsMarkingAllRead(true)
    setMarkingReadIds((prev) => new Set([...prev, ...unreadIds]))
    // allSettled, not all: one failed alert (e.g. deleted mid-flight)
    // shouldn't stop the rest of the batch from marking read.
    const results = await Promise.allSettled(
      unreadIds.map((id) => markAlertRead(id).unwrap())
    )
    setMarkingReadIds((prev) => {
      const next = new Set(prev)
      unreadIds.forEach((id) => next.delete(id))
      return next
    })
    setIsMarkingAllRead(false)

    const failedCount = results.filter((r) => r.status === "rejected").length
    if (failedCount > 0) {
      toast.error(
        t("organization.alerts.markAllReadPartialFailure", {
          failed: failedCount,
          total: unreadIds.length,
        })
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        {/* Round-4 UX finding: this error state had no way to recover
            short of a full page reload -- a real backend 429 live-hit
            this state with no retry action anywhere. */}
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive"
        >
          <span>{t("organization.alerts.loadFailed")}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <RotateCw className="h-3.5 w-3.5" />
            {t("organization.alerts.retry")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="animate-fade-in flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {t("organization.alerts.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {/* Always the true org-wide total, not the severity-filtered
                count below -- a severity filter narrows what's *shown*, it
                shouldn't make the header lie about how many alerts exist. */}
            {t("organization.alerts.activeCount", { count: allAlerts.length })}
            {/* Round-4 UX finding: no unread indicator existed anywhere on
                the page, despite unread being the one status this page's
                whole job is to surface. */}
            {unreadCount > 0 && (
              <>
                {" "}
                &middot;{" "}
                <span className="font-medium text-foreground">
                  {t("organization.alerts.unreadCount", { count: unreadCount })}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Round-4 industry-standards finding: no bulk action existed at
            all, not even mark-all-read -- every alert had to be
            individually clicked. No backend bulk endpoint exists
            (alert.route.ts only has a per-id PATCH), so this fires the
            same per-id mutation in parallel across every unread alert in
            the *currently filtered* view. */}
        {canWrite && filteredUnreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={isMarkingAllRead}
            className="focus-ring flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {isMarkingAllRead ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            {t("organization.alerts.markAllRead")}
          </button>
        )}
      </div>

      {/* Severity Quick Filters
          quality-bar-loop round 2 (mobile, round-1 finding): this row
          had no wrap, so the "Low" chip's right edge sat at x:439.6px
          in a 375px viewport with no horizontal scroll available --
          completely unreachable on mobile, not just visually cramped.
          flex-wrap lets chips wrap onto a second line instead. */}
      <div className="animate-slide-up flex flex-wrap gap-2">
        {(["critical", "high", "medium", "low"] as const).map((sev) => {
          const count =
            sev === "critical"
              ? criticalCount
              : sev === "high"
                ? highCount
                : sev === "medium"
                  ? mediumCount
                  : lowCount

          const isActive = severityFilter === sev

          return (
            <button
              key={sev}
              type="button"
              aria-pressed={isActive}
              onClick={() =>
                setSeverityFilter((prev) => (prev === sev ? null : sev))
              }
              className={`focus-ring flex h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                isActive
                  ? SEVERITY_ACTIVE_CLASSES[sev]
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <RiskBadge level={sev} />
              <span className="font-mono-data">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Alerts List */}
      <div className="animate-slide-up stagger-2 space-y-3">
        <h2 className="sr-only">{t("organization.alerts.listHeading")}</h2>
        {alerts.map((alert: Alert) => (
          <div
            key={alert.id}
            className={`group rounded-xl border bg-card p-5 transition-all hover:shadow-md ${
              alert.severity === "critical"
                ? "border-risk-critical/30"
                : "border-border"
            } ${alert.is_read ? "opacity-60" : ""}`}
          >
            <div className="flex items-start gap-4">
              {/* quality-bar-loop round 16/17 (resilience regression, round
                  2): this icon-background was a hand-rolled ternary chain
                  that fell through to "low"/no styling for any severity
                  outside the 3-4 values it happened to check -- e.g. an
                  unrecognized severity rendered a neutral-gray icon (fixed
                  round 16) sitting in a green "low-severity" box (missed
                  round 16). Routing both bg and text through the same
                  SEVERITY_STYLES lookup + neutral fallback keeps them from
                  ever disagreeing again. (The card border above is a
                  separate, deliberately binary "only critical gets a
                  colored border" emphasis, not this same bug class --
                  left as-is.) */}
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  (
                    SEVERITY_STYLES[alert.severity as Severity] ??
                    SEVERITY_STYLES.neutral
                  ).bg
                }`}
              >
                <Bell
                  className={`h-5 w-5 ${
                    (
                      SEVERITY_STYLES[alert.severity as Severity] ??
                      SEVERITY_STYLES.neutral
                    ).text
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={alert.severity} />
                  <span className="text-xs font-semibold text-primary">
                    {alert.source}
                  </span>
                  {alert.type && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {getEnumLabel(t, ALERT_TYPE_LABEL_KEYS, alert.type)}
                      </span>
                    </>
                  )}
                  {alert.ai_generated && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {t("organization.alerts.aiGenerated")}
                    </span>
                  )}
                  {!alert.is_read && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      {t("organization.alerts.new")}
                    </span>
                  )}
                </div>

                <h3 className="mt-1.5 text-sm leading-tight font-semibold text-foreground">
                  {alert.title}
                </h3>
                {alert.description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {alert.description}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatLocaleDate(alert.createdAt, i18n.language, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* aexa-frontend#530: kri_id is populated for every
                        kri_threshold_breach alert but was never surfaced --
                        this is the one-way-blind half of the cross-link,
                        the other half (alert counts on the KRI card) lives
                        in KriDashboardPage.tsx. */}
                    {/* quality-bar-loop round 2 (mobile, round-1
                        finding): these measured 25px tall with only 8px
                        between them -- under the 44px touch-target
                        guideline and a real mis-tap risk given how
                        close together they sit. */}
                    {alert.kri_id && (
                      <Link
                        to={`/organization/kri?highlight=${encodeURIComponent(alert.kri_id)}`}
                        className="focus-ring flex h-11 items-center rounded-md px-2 text-[11px] font-medium text-primary hover:bg-primary/10"
                      >
                        {t("organization.alerts.viewKri")}
                      </Link>
                    )}
                    {canWrite && !alert.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(alert.id)}
                        disabled={markingReadIds.has(alert.id)}
                        className="focus-ring flex h-11 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                      >
                        {markingReadIds.has(alert.id) && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {t("organization.alerts.markAsRead")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="py-12 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {severityFilter
                ? t("organization.alerts.emptyFiltered")
                : t("organization.alerts.empty")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
