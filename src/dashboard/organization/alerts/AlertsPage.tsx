import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import {
  useDeleteAlertMutation,
  useGetAllAlertsQuery,
  useMarkAlertReadMutation,
} from "@/redux/apis/organization/alert.api"
import type { Alert } from "@/types/organization"
import { severityBadgeClasses } from "@/utils/severityStyles"
import { Bell, CheckCheck, Loader2, RotateCw } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"
import { toast } from "sonner"
import AlertRow from "./AlertRow"

type Severity = "critical" | "high" | "medium" | "low"
type SortOption = "newest" | "oldest" | "unreadFirst" | "severity"

// Round 12 (UX finding): matches this app's own visual severity ordering
// (RiskBadge/severityBadgeClasses render critical as the most alarming
// color down to low as the calmest) rather than inventing a separate
// order -- used only for the "severity" sort option below.
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
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
  // Round 7 (industry-standards): the alert lifecycle was binary is_read
  // with no way to permanently clear noise -- unlike GitHub Notifications
  // (mark-done) or PagerDuty (resolve). useDeleteAlertMutation already
  // existed and is wired to a real server endpoint (DELETE /alert/:id)
  // but was never called from this page. Reuses that existing plumbing
  // rather than needing new backend work.
  const [deleteAlert, { isLoading: isDeletingAlert }] =
    useDeleteAlertMutation()
  const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null)
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
  // Round 12 (UX finding): no sort control existed at all -- alerts only
  // ever rendered in the server's fixed createdAt-desc order. "newest"
  // keeps that same default so nothing changes for a user who never
  // touches this control.
  const [sortOption, setSortOption] = useState<SortOption>("newest")

  // Round 8 (accessibility): both the per-row "Mark as read" button and the
  // bulk "Mark all as read" button unmount as soon as their action
  // succeeds (the row's button on `!alert.is_read` flipping, the bulk
  // button on `filteredUnreadCount` hitting 0). Live-reproduced: focus
  // silently relocated to an unrelated severity chip with no visual or
  // audible indication anything happened. These refs give somewhere
  // deliberate to land focus before that unmount, instead of leaving it
  // to whatever the browser's default post-unmount behavior happens to be.
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Round 14 (efficiency fix): passed down to the memoized AlertRow below
  // -- a plain inline arrow function here would give every row a fresh
  // callback identity on every AlertsPage render, defeating React.memo's
  // whole point. Only mutates a ref, so an empty dependency array is
  // correct (nothing it closes over ever needs to change).
  const registerCardRef = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (el) cardRefs.current.set(id, el)
      else cardRefs.current.delete(id)
    },
    []
  )

  // quality-bar-loop round 3 (efficiency, round-1 finding): `?? []`
  // creates a fresh array reference every render when data is still
  // undefined, which would defeat the useMemo calls below keyed on
  // this -- memoized so the empty-array fallback is referentially
  // stable too.
  const allAlerts = useMemo(() => alertResponse?.data ?? [], [alertResponse])
  const alerts = useMemo(() => {
    const filtered = severityFilter
      ? allAlerts.filter((a: Alert) => a.severity === severityFilter)
      : allAlerts
    // Round 12 (UX finding): sorts a copy -- `allAlerts`/`filtered` must
    // stay in the server's original order since `filtered` is also reused
    // above/elsewhere without assuming any particular order.
    return [...filtered].sort((a: Alert, b: Alert) => {
      switch (sortOption) {
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        case "unreadFirst":
          if (a.is_read !== b.is_read) return a.is_read ? 1 : -1
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        case "severity":
          // Round-1 review of PR #837: this file already documents (see
          // the icon-color fallback below) that `alert.severity` can
          // arrive outside the typed union at runtime -- an unguarded
          // lookup here returns `undefined`, and `undefined - number` is
          // `NaN`, which isn't spec-guaranteed to sort consistently.
          // Falls back to the same "last" rank as `SEVERITY_STYLES`'s own
          // neutral fallback treats an unrecognized severity.
          return (
            (SEVERITY_RANK[a.severity as Severity] ?? SEVERITY_RANK.low + 1) -
            (SEVERITY_RANK[b.severity as Severity] ?? SEVERITY_RANK.low + 1)
          )
        case "newest":
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
      }
    })
  }, [allAlerts, severityFilter, sortOption])

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

  // Round 14 (efficiency fix): this was a plain inline function before,
  // so it got a fresh identity on every AlertsPage render -- passed as
  // `onMarkRead` to every memoized AlertRow, that alone defeated
  // React.memo entirely (a changed prop reference forces a re-render
  // regardless of how well AlertRow itself memoizes). Caught by this
  // round's own new memoization regression test failing despite the
  // AlertRow extraction otherwise being correct.
  const handleMarkRead = useCallback(
    async (id: string) => {
      setMarkingReadIds((prev) => new Set(prev).add(id))
      try {
        await markAlertRead(id).unwrap()
        // Round 8 (accessibility): mark-read had no success feedback of
        // any kind before this -- only the error path toasted. The toast
        // gives an audible/visible confirmation, and moving focus to the
        // row itself (before its own button unmounts) keeps keyboard/
        // screen-reader users anchored to the alert they just acted on.
        toast.success(t("organization.alerts.markReadSuccess"))
        cardRefs.current.get(id)?.focus()
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
    },
    [markAlertRead, t]
  )

  const confirmDeleteAlert = async () => {
    // Round-1 review finding: relying solely on DeleteAlertModal's own
    // disabled={loading} on the Confirm button is the primary guard, but
    // it depends on a re-render landing before a second invocation --
    // same belt-and-suspenders check RiskRegisterPage's confirmDeleteRisk
    // already added for the identical theoretical race.
    if (!deletingAlertId || isDeletingAlert) return
    try {
      await deleteAlert(deletingAlertId).unwrap()
      toast.success(t("organization.alerts.dismissSuccess"))
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.alerts.dismissFailed")
      toast.error(message)
    } finally {
      setDeletingAlertId(null)
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
    } else {
      toast.success(t("organization.alerts.markAllReadSuccess"))
    }
    // Round 8 (accessibility): same unmount-focus-loss issue as the
    // per-row button above -- this button itself disappears once
    // filteredUnreadCount hits 0. The heading is the one element on the
    // page guaranteed to still be there regardless of how many rows
    // changed, so it's a safe anchor for both the full-success and
    // partial-failure cases.
    headingRef.current?.focus()
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
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="focus-ring font-heading text-2xl font-bold tracking-tight text-foreground"
          >
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

        <div className="flex items-center gap-2">
          {/* Round 12 (UX finding): no sort control existed at all --
              alerts only ever rendered in the server's fixed
              createdAt-desc order, with no way to group unread first or
              surface the most severe alerts, unlike GitHub
              Notifications/PagerDuty. All <=100 fetched alerts are
              already in memory (useGetAllAlertsQuery's own cap), so this
              is a pure client-side sort with no new backend call. */}
          <Select
            value={sortOption}
            onValueChange={(value) => setSortOption(value as SortOption)}
          >
            <SelectTrigger
              className="!h-11 w-auto min-w-[9rem]"
              aria-label={t("organization.alerts.sortLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">
                {t("organization.alerts.sortNewest")}
              </SelectItem>
              <SelectItem value="oldest">
                {t("organization.alerts.sortOldest")}
              </SelectItem>
              <SelectItem value="unreadFirst">
                {t("organization.alerts.sortUnreadFirst")}
              </SelectItem>
              <SelectItem value="severity">
                {t("organization.alerts.sortSeverity")}
              </SelectItem>
            </SelectContent>
          </Select>

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
              className="focus-ring flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
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
          <AlertRow
            key={alert.id}
            alert={alert}
            canWrite={canWrite}
            language={i18n.language}
            isMarkingRead={markingReadIds.has(alert.id)}
            onMarkRead={handleMarkRead}
            onRequestDismiss={setDeletingAlertId}
            registerCardRef={registerCardRef}
          />
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

      <DeleteAlertModal
        title={t("organization.alerts.dismissModalTitle")}
        description={t("organization.alerts.dismissModalDescription")}
        open={deletingAlertId !== null}
        setOpen={(value) => {
          if (!value) setDeletingAlertId(null)
        }}
        onConfirm={confirmDeleteAlert}
        loading={isDeletingAlert}
        // Round 11 (UX finding): every other affordance around this modal
        // -- the trigger button, the toast keys, the modal title itself --
        // calls this action "Dismiss," but the modal's own confirm button
        // was hardcoded to the shared component's default "Delete," a
        // real mid-flow terminology flip right before an irreversible
        // action. Overriding just these two labels keeps every other
        // caller of DeleteAlertModal (which genuinely delete) unaffected.
        confirmLabel={t("organization.alerts.dismiss")}
        loadingLabel={t("organization.alerts.dismissing")}
      />
    </div>
  )
}
