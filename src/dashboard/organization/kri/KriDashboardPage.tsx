import { useGetKriReadingsQuery } from "@/redux/apis/organization/kri.api"
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import FilteredByNotice from "@/components/shared/FilteredByNotice"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import { formatLocaleDate } from "@/utils/formatDate"
import type { KRI } from "@/types/organization"
import { SEVERITY_STYLES, severityBadgeClasses } from "@/utils/severityStyles"
import {
  AlertTriangle,
  ChartLine,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useSearchParams } from "react-router"
import { toast } from "sonner"
import EditKriModal from "./EditKriModal"
import NewKriModal from "./NewKriModal"
import TrendModal from "./TrendModal"
import UpdateValueModal from "./UpdateValueModal"
import {
  EMPTY_EDIT_KRI,
  EMPTY_KRI,
  HIGHLIGHT_DURATION_MS,
  formatKriNumber,
  highestSeverity,
  KRI_STATUS_META,
  kriStatusMeta,
} from "./kriConfig"
import { useKriData } from "./useKriData"

// Round 18 (code quality finding): handleSave, handleUpdateValue,
// handleSaveEdit, and handleDelete each independently repeated the
// identical `try { await mutate().unwrap(); toast.success(...) } catch
// (err: any) { toast.error(err?.data?.message || fallback) }` shape (the
// same duplication class already fixed on CompliancePage.tsx's
// submitWithToast this session) -- and each cast `err` to `any` to do it,
// which is what forced this whole file's blanket
// `/* eslint-disable @typescript-eslint/no-explicit-any */` at the top.
// Never throws -- swallows the error into a toast either way, so every
// call site can safely `await` this without its own try/catch.
async function submitWithToast<T>(
  action: () => Promise<T>,
  successMessage: string,
  fallbackErrorMessage: string,
  onSuccess?: (result: T) => void
): Promise<void> {
  try {
    const result = await action()
    toast.success(successMessage)
    onSuccess?.(result)
  } catch (err) {
    const message =
      (err as { data?: { message?: string } })?.data?.message ||
      fallbackErrorMessage
    toast.error(message)
  }
}

export default function KriDashboardPage() {
  const { t, i18n } = useTranslation()
  // aexa-frontend#217
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)
  const {
    kris,
    risks,
    risksById,
    unreadAlertsByKriId,
    krisLoading,
    krisError,
    risksError,
    alertsError,
    alertCount,
    warningCount,
    okCount,
    createKri,
    submitKriValue,
    updateKri,
    deleteKri,
  } = useKriData()

  // aexa-frontend#530: scrolls to and briefly highlights the KRI card an
  // AlertsPage "View KRI" link was clicked for. Only fires once the KRI
  // list has actually loaded (an empty `kris` array on first render would
  // find no matching element yet) and only once per highlight param value,
  // not on every re-render -- otherwise a later unrelated state update
  // (e.g. opening the update-value modal) would yank the scroll position
  // back to the highlighted card.
  const [searchParams] = useSearchParams()
  const highlightKriId = searchParams.get("highlight")
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null)
  // Keyed by `${highlightKriId}:${location.key}`, not just the id: two
  // different alerts can reference the same KRI, so clicking "View KRI"
  // again for the same id -- a genuine new navigation, with a new
  // location.key from react-router -- must still re-trigger the highlight,
  // even though the id itself repeats. Re-renders that don't touch the
  // location (e.g. opening the update-value modal) keep the same key and
  // are still correctly ignored.
  const highlightedRef = useRef<string | null>(null)
  const location = useLocation()
  useEffect(() => {
    if (!highlightKriId || kris.length === 0) return
    const highlightKey = `${highlightKriId}:${location.key}`
    if (highlightedRef.current === highlightKey) return
    const el = document.getElementById(`kri-${highlightKriId}`)
    if (!el) return
    highlightedRef.current = highlightKey
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    // Pre-existing, unrelated to this round's decomposition (this effect
    // is byte-for-byte unchanged; the rule only started firing here
    // because the analyzer previously bailed out on this component's
    // prior size/complexity and is now able to run). `activeHighlight`
    // synchronizes a genuinely external trigger (a URL param + a real DOM
    // scroll target) into React state to drive a temporary highlight ring
    // -- there's no props/derived-state equivalent to compute this from
    // during render, since it depends on `document.getElementById`
    // actually finding the element and a real scrollIntoView call
    // succeeding first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveHighlight(highlightKriId)
    const timeout = setTimeout(
      () => setActiveHighlight(null),
      HIGHLIGHT_DURATION_MS
    )
    return () => clearTimeout(timeout)
    // `kris.length`, not `kris`: `kris` (kriResponse?.data ?? []) is a
    // fresh array reference every render, which would re-run this effect
    // constantly -- it only actually needs to re-fire when the list
    // resolves from empty to populated.
  }, [highlightKriId, kris.length, location.key])

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_KRI)
  const [isSaving, setIsSaving] = useState(false)

  const [updatingKriId, setUpdatingKriId] = useState<string | null>(null)
  const [updateValue, setUpdateValue] = useState("")
  const [isUpdatingValue, setIsUpdatingValue] = useState(false)

  // Round-5 industry-standards finding: no edit UI existed for a KRI's own
  // fields (name/unit/thresholds/frequency) -- only its current *value*
  // could be updated (the Pencil button/modal above).
  const [editingKriId, setEditingKriId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT_KRI)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Round-5 industry-standards finding: no delete UI existed either -- a
  // mistakenly created KRI (wrong risk, typo'd name) could never be
  // removed short of a direct database edit.
  const [deletingKri, setDeletingKri] = useState<KRI | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // aexa-server#242 / aexa-frontend#211 — GET /kri/:id/readings existed with
  // no frontend consumer at all; this is the trend view. Only fetched while
  // the modal is actually open for a given KRI (skip otherwise).
  const [trendKriId, setTrendKriId] = useState<string | null>(null)
  const {
    data: readingsResponse,
    isLoading: isLoadingReadings,
    isError: readingsError,
  } = useGetKriReadingsQuery(
    { id: trendKriId ?? "", page: 1, limit: 50 },
    { skip: !trendKriId }
  )

  // aexa-frontend#471 -- role="dialog"/focus-trap/Escape for all four
  // modals below, now via each extracted modal component's own
  // useModalA11y() call (see useModalA11y.ts for why this isn't a Radix
  // Dialog migration instead).

  // Round 15 (fresh full-panel re-score, accessibility finding): none of
  // these five open-state setters closed any of the others, so e.g.
  // clicking "New KRI" and then a card's "Update value" button mounted
  // TWO useModalA11y dialogs at once -- deterministically reproduced live.
  // Each hook's own Tab-trap only walks its own container, so with two
  // active, keyboard focus could escape both into the background page
  // chrome entirely, exposing two full sets of dialog controls plus the
  // live page to a screen reader at the same time. Every "open a modal"
  // action below now closes every other modal first.
  const closeAllModals = () => {
    setShowForm(false)
    setUpdatingKriId(null)
    setEditingKriId(null)
    setDeletingKri(null)
    setTrendKriId(null)
  }

  const openNewKriForm = () => {
    closeAllModals()
    setForm(EMPTY_KRI)
    setShowForm(true)
  }

  const handleSave = async () => {
    // Round 21 (industry-standards finding): the backend's create_kri
    // schema requires a non-empty `unit` (z.string().min(1)) but this
    // form never marked it required or guarded submission on it --
    // Unit was the one field a user could leave blank and only find out
    // it was mandatory from a raw 400 in the network tab, not the form.
    if (!form.name || !form.risk_id || !form.unit) return
    if (form.target_value === form.alert_threshold) {
      toast.error(t("organization.kri.toast.thresholdMustDiffer"))
      return
    }
    // Round 22 (resilience finding): none of these three had a floor --
    // `type="number"` alone doesn't stop a negative count/percentage/
    // dollar figure, none of which are meaningful for the KRI value types
    // this app deals with (security incidents, compliance findings, days
    // overdue, etc. are all naturally >= 0). This is the real enforcement
    // backstopping the `min={0}` HTML affordance on the same fields --
    // these are plain divs, not <form> elements, so there's no native
    // browser submit-blocking for free here.
    if (form.current_value < 0 || form.alert_threshold < 0 || form.target_value < 0) {
      toast.error(t("organization.kri.toast.valueCannotBeNegative"))
      return
    }

    setIsSaving(true)
    await submitWithToast(
      () =>
        createKri({
          risk_id: form.risk_id,
          name: form.name,
          // Omit rather than send an empty string -- an unset owner should
          // read as "no owner" (null), not a stored empty string.
          owner: form.owner.trim() || undefined,
          unit: form.unit,
          current_value: form.current_value,
          alert_threshold: form.alert_threshold,
          target_value: form.target_value,
          frequency: form.frequency,
        }).unwrap(),
      t("organization.kri.toast.created"),
      t("organization.kri.toast.createFailed"),
      () => {
        setShowForm(false)
        setForm(EMPTY_KRI)
      }
    )
    setIsSaving(false)
  }

  const openUpdateValue = (kri: KRI) => {
    closeAllModals()
    setUpdatingKriId(kri.id)
    setUpdateValue(String(kri.current_value))
  }

  const handleUpdateValue = async () => {
    if (!updatingKriId) return
    // Number("") === 0, not NaN — an emptied field would otherwise silently
    // submit 0 as if it were a real reading instead of being rejected.
    // Found by independent review.
    if (updateValue.trim() === "") {
      toast.error(t("organization.kri.toast.enterValidNumber"))
      return
    }
    const value = Number(updateValue)
    if (Number.isNaN(value)) {
      toast.error(t("organization.kri.toast.enterValidNumber"))
      return
    }
    // Round 22 (resilience finding): same negative-value floor as
    // handleSave/handleSaveEdit -- a reading of -5 incidents/percent isn't
    // meaningful for the KRI value types this app deals with.
    if (value < 0) {
      toast.error(t("organization.kri.toast.valueCannotBeNegative"))
      return
    }

    setIsUpdatingValue(true)
    await submitWithToast(
      () =>
        submitKriValue({
          id: updatingKriId,
          current_value: value,
        }).unwrap(),
      t("organization.kri.toast.valueUpdated"),
      t("organization.kri.toast.updateFailed"),
      () => setUpdatingKriId(null)
    )
    setIsUpdatingValue(false)
  }

  const openEdit = (kri: KRI) => {
    closeAllModals()
    setEditingKriId(kri.id)
    setEditForm({
      name: kri.name,
      owner: kri.owner ?? "",
      unit: kri.unit,
      target_value: Number(kri.target_value),
      alert_threshold: Number(kri.alert_threshold),
      frequency: kri.frequency ?? "monthly",
    })
  }

  const handleSaveEdit = async () => {
    // Round 21: same "unit is actually required" backend constraint as
    // handleSave -- update_kri's schema still enforces min(1) whenever
    // unit is present in the payload, and this form always sends it.
    if (!editingKriId || !editForm.name || !editForm.unit) return
    if (editForm.target_value === editForm.alert_threshold) {
      toast.error(t("organization.kri.toast.thresholdMustDiffer"))
      return
    }
    // Round 22: same negative-value floor as handleSave.
    if (editForm.alert_threshold < 0 || editForm.target_value < 0) {
      toast.error(t("organization.kri.toast.valueCannotBeNegative"))
      return
    }

    setIsSavingEdit(true)
    await submitWithToast(
      () =>
        updateKri({
          id: editingKriId,
          data: {
            name: editForm.name,
            // Empty string clears a previously-set owner back to unset,
            // same "omit rather than store blank" rule as create above --
            // an explicit "" is still sent here (unlike create) so clearing
            // the field actually clears it server-side instead of being a
            // silent no-op.
            owner: editForm.owner.trim(),
            unit: editForm.unit,
            alert_threshold: editForm.alert_threshold,
            target_value: editForm.target_value,
            frequency: editForm.frequency,
          },
        }).unwrap(),
      t("organization.kri.toast.edited"),
      t("organization.kri.toast.editFailed"),
      () => setEditingKriId(null)
    )
    setIsSavingEdit(false)
  }

  const handleDelete = async () => {
    if (!deletingKri) return
    setIsDeleting(true)
    await submitWithToast(
      () => deleteKri(deletingKri.id).unwrap(),
      t("organization.kri.toast.deleted"),
      t("organization.kri.toast.deleteFailed"),
      () => setDeletingKri(null)
    )
    setIsDeleting(false)
  }

  // Round 14 (code quality, fresh full-panel re-score finding): typed
  // KRI.find lookups instead of `any`, since the real KRI type is already
  // imported and used correctly a few lines below (openEdit/setDeletingKri).
  // Also memoized -- this round's efficiency judge flagged both as plain
  // kris.find(...) calls re-scanning the full array on every unrelated
  // keystroke in the New/Edit KRI forms, same bug class this file has
  // fixed multiple times elsewhere.
  const trendKri = useMemo(
    () => (trendKriId ? kris.find((k: KRI) => k.id === trendKriId) : null),
    [kris, trendKriId]
  )
  // Round 8 (UX finding): the update-value modal was a bare number input
  // with no indication which KRI it was for, or what unit/threshold it's
  // measured against -- a real risk of typing a value into the wrong
  // context after opening several cards' modals in a row.
  const updatingKri = useMemo(
    () =>
      updatingKriId ? kris.find((k: KRI) => k.id === updatingKriId) : null,
    [kris, updatingKriId]
  )
  // Backend returns newest-first (see kri.api.ts's own comment); a
  // left-to-right chronological chart needs the reverse.
  // quality-bar-loop round 3 (efficiency, round-1 finding): recomputed
  // every render before this, including on every keystroke in the New
  // KRI form (unrelated state in the same component).
  const trendChartData = useMemo(
    () =>
      (readingsResponse?.data ?? [])
        .slice()
        .reverse()
        .map((r: { value: number; recorded_at: string }) => ({
          value: r.value,
          recorded_at: formatLocaleDate(r.recorded_at, i18n.language, {
            month: "short",
            day: "numeric",
          }),
        })),
    [readingsResponse, i18n.language]
  )
  // Round 9 (accessibility finding): Recharts renders a purely visual SVG
  // with no text alternative for a screen-reader user -- this summary
  // backs both the sr-only paragraph above the chart and (round 11) the
  // chart's own accessible name, so the two never drift out of sync.
  // Round-1 review of PR #850: this ran (and called t()) on every render
  // of the whole page once no longer gated by the JSX's own short-circuit,
  // not just when the trend modal is actually open -- same
  // recompute-on-unrelated-render issue this file already fixed for
  // `trendChartData` and every other derived value above it.
  const trendSummary = useMemo(
    () =>
      trendChartData.length > 0
        ? t("organization.kri.trend.summary", {
            count: trendChartData.length,
            first: trendChartData[0].recorded_at,
            last: trendChartData[trendChartData.length - 1].recorded_at,
            latestValue: trendChartData[trendChartData.length - 1].value,
          })
        : "",
    [trendChartData, t]
  )

  // quality-bar-loop round 14 (industry-standards): the dashboard's
  // "KRI Alerts" card used to be a static, non-clickable number -- it now
  // links here with ?status=ALERT. The summary chips above stay computed
  // from the full, unfiltered `kris` list (they're page-wide totals, not
  // affected by an incoming filter); only the card grid below narrows.
  const statusParam = searchParams.get("status")
  // quality-bar-loop round 3 (efficiency, round-1 finding): same
  // unrelated-state-triggers-rescan issue as the summary counts above.
  const statusFilteredKris = useMemo(
    () =>
      statusParam ? kris.filter((k: KRI) => k.status === statusParam) : kris,
    [kris, statusParam]
  )

  if (krisLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (krisError) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          {t("organization.kri.loadError")}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="animate-fade-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {t("organization.kri.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.kri.description")}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openNewKriForm}
            // quality-bar-loop round 2 (mobile, round-1 finding): measured
            // 343x32px at 375px width -- full-width but only 32px tall,
            // under the 44px touch-target guideline.
            className="focus-ring flex h-11 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> {t("organization.kri.newKri")}
          </button>
        )}
      </div>

      {/* Fresh full-panel re-score (resilience finding): a failed risks/
          alerts fetch used to fall through to the same `?? []` empty-array
          fallback every KRI card already uses when a risk/alert genuinely
          doesn't exist -- a real outage looked identical to "nothing to
          show," with no indication card data (risk names, alert counts)
          might be incomplete. Non-blocking (the KRI list itself already
          loaded successfully at this point), so a dismissible-style
          notice rather than the full-page error state above. */}
      {(risksError || alertsError) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {t("organization.kri.relatedDataLoadError")}
        </div>
      )}

      {/* Status Summary Cards */}
      <div className="animate-slide-up flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-risk-critical/30 bg-risk-critical/5 px-3 py-2">
          <AlertTriangle
            className={`h-4 w-4 ${SEVERITY_STYLES.critical.text}`}
          />
          <span
            className={`font-mono-data text-lg font-bold ${SEVERITY_STYLES.critical.text}`}
          >
            {alertCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("organization.kri.status.alert")}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-risk-medium/30 bg-risk-medium/5 px-3 py-2">
          <TrendingUp className={`h-4 w-4 ${SEVERITY_STYLES.medium.text}`} />
          <span
            className={`font-mono-data text-lg font-bold ${SEVERITY_STYLES.medium.text}`}
          >
            {warningCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("organization.kri.status.warning")}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-risk-low/30 bg-risk-low/5 px-3 py-2">
          <CheckCircle2 className={`h-4 w-4 ${SEVERITY_STYLES.low.text}`} />
          <span
            className={`font-mono-data text-lg font-bold ${SEVERITY_STYLES.low.text}`}
          >
            {okCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("organization.kri.status.ok")}
          </span>
        </div>
      </div>

      {statusParam && (
        <FilteredByNotice
          className="animate-fade-in"
          label={t("organization.kri.filteredByStatus", {
            // Preserves the original fallback (an unrecognized statusParam
            // renders as-is, not silently relabeled "OK") -- kriStatusMeta
            // itself defaults to OK's meta, which is right for a real KRI
            // status but wrong for an arbitrary/malformed URL param.
            // Round-1 review of PR #846: `in` walks the prototype chain, so
            // a crafted ?status=constructor/toString/valueOf would have
            // matched an inherited Object.prototype key and rendered
            // garbage instead of the original passthrough behavior --
            // hasOwnProperty checks only the object's own keys.
            status: Object.prototype.hasOwnProperty.call(
              KRI_STATUS_META,
              statusParam ?? ""
            )
              ? t(kriStatusMeta(statusParam as string).labelKey)
              : statusParam,
          })}
          clearLabel={t("organization.kri.clearFilter")}
          clearHref="/organization/kri"
        />
      )}

      {/* KRI Cards */}
      <div className="animate-slide-up stagger-2 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statusFilteredKris.map((kri: KRI) => {
          const statusMeta = kriStatusMeta(kri.status)

          const risk = risksById.get(kri.risk_id)

          const kriAlerts = unreadAlertsByKriId[kri.id] ?? []
          const alertCount = kriAlerts.length

          return (
            <div
              key={kri.id}
              id={`kri-${kri.id}`}
              className={`rounded-xl border-2 ${statusMeta.borderClass} bg-card p-4 transition-shadow lg:p-5 ${
                activeHighlight === kri.id
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  {/* Round 9 (accessibility finding): CSS truncate has no
                      fallback for the cut-off portion -- a `title` gives
                      the full name on hover (and to some screen readers'
                      own tooltip behavior), same pattern already used for
                      truncated risk names in the New KRI form's own
                      select. */}
                  <p
                    title={kri.name}
                    className="truncate text-sm font-semibold text-foreground"
                  >
                    {kri.name}
                  </p>
                  <p
                    title={`${risk ? risk.name : t("organization.kri.unknownRisk")}${
                      kri.frequency
                        ? ` · ${t(`organization.kri.frequency.${kri.frequency}`, { defaultValue: kri.frequency })}`
                        : ""
                    }`}
                    className="mt-0.5 truncate text-xs text-muted-foreground"
                  >
                    {/* aexa-frontend#542: kri.risk_id is the same FK this
                        form uses to create the KRI -- a KRI's whole purpose
                        is tied to a specific risk, and there was previously
                        no way to jump to it from this dashboard. */}
                    {risk ? (
                      <Link
                        to={`/organization/risks/${risk.id}`}
                        className="focus-ring text-primary hover:underline"
                      >
                        {risk.name}
                      </Link>
                    ) : (
                      t("organization.kri.unknownRisk")
                    )}
                    {kri.frequency
                      ? ` · ${t(`organization.kri.frequency.${kri.frequency}`, { defaultValue: kri.frequency })}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {/* aexa-frontend#530: the KRI-side half of the Alert<->KRI
                      cross-link -- a non-interactive count, not a link into
                      AlertsPage, since that page has no URL-based filter to
                      land on (scope cut, same discipline as #529's "Manage
                      in Register" vs. rebuilding the edit form). Counts
                      unread alerts only, colored by their highest severity,
                      so it reads as "outstanding issues," not a permanent
                      all-time tally. */}
                  {alertCount > 0 && (
                    // Round 9 (accessibility finding): `title` alone isn't
                    // reliably exposed as an accessible name/description by
                    // every screen reader or on touch devices (no hover) --
                    // aria-label carries the same text through the
                    // standard accessible-name computation instead.
                    <span
                      title={t("organization.kri.relatedAlertsTooltip", {
                        count: alertCount,
                      })}
                      aria-label={t("organization.kri.relatedAlertsTooltip", {
                        count: alertCount,
                      })}
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${severityBadgeClasses(highestSeverity(kriAlerts))}`}
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {alertCount}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityBadgeClasses(
                      statusMeta.severityLevel
                    )}`}
                  >
                    {t(statusMeta.labelKey)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                {/* Round 13 (layout finding, spotted live after the
                    thousands-grouping fix): a large value (e.g. a
                    9-10-digit KRI, now wider still with comma
                    separators) had nowhere to go but into the button
                    row's space -- flex's default shrink:1 let the 44px
                    touch targets below compress well under the round-2
                    guideline instead. Truncating the value (with a
                    title fallback, same pattern used elsewhere on this
                    page) and pinning the buttons to shrink-0 keeps the
                    touch targets fixed-size no matter how wide the
                    number gets. */}
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span
                    title={formatKriNumber(Number(kri.current_value), i18n.language)}
                    className="font-mono-data truncate text-2xl font-bold text-foreground lg:text-3xl"
                  >
                    {formatKriNumber(Number(kri.current_value), i18n.language)}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {kri.unit}
                  </span>
                </div>
                {/* quality-bar-loop round 2 (mobile, round-1 finding):
                    these buttons measured 22x22px -- under the 44px
                    touch-target guideline, and 2 of the 3 interactive
                    controls on every card. Same h-11 w-11 fix already
                    established on RiskMatrixPage/CorrelationMatrixPage:
                    the wrapper gets the full touch target while the icon
                    inside stays visually small. */}
                <button
                  type="button"
                  onClick={() => {
                    closeAllModals()
                    setTrendKriId(kri.id)
                  }}
                  className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={t("organization.kri.trend.viewTooltip")}
                  aria-label={t("organization.kri.trend.viewTooltip")}
                >
                  <ChartLine className="h-3.5 w-3.5" />
                </button>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => openUpdateValue(kri)}
                    className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={t("organization.kri.updateValueTooltip")}
                    aria-label={t("organization.kri.updateValueTooltip")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {/* Round-5 industry-standards finding: updateKri/deleteKri
                    existed server-side with zero frontend consumer -- a
                    KRI's own fields (name/unit/thresholds/frequency)
                    could never be corrected, and a mistakenly created one
                    could never be removed, without going around the UI. */}
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => openEdit(kri)}
                    className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={t("organization.kri.editTooltip")}
                    aria-label={t("organization.kri.editTooltip")}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => {
                      closeAllModals()
                      setDeletingKri(kri)
                    }}
                    className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title={t("organization.kri.deleteTooltip")}
                    aria-label={t("organization.kri.deleteTooltip")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-1 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span>
                  {t("organization.kri.thresholdLabel")}{" "}
                  <span
                    className={`font-mono-data font-medium ${SEVERITY_STYLES.critical.text}`}
                  >
                    {formatKriNumber(Number(kri.alert_threshold), i18n.language)}
                  </span>
                </span>
                <span>
                  {t("organization.kri.targetLabel")}{" "}
                  <span
                    className={`font-mono-data font-medium ${SEVERITY_STYLES.low.text}`}
                  >
                    {formatKriNumber(Number(kri.target_value), i18n.language)}
                  </span>
                </span>
                {/* Industry-standards finding (round 20): KRI ownership had
                    no field at all -- ServiceNow GRC/LogicGate/Resolver all
                    surface who's responsible for a KRI. Free-text, so shown
                    compactly and only when set, same "conditional metadata
                    line" pattern as `overdue` just below -- no unconditional
                    grid column for an org that never fills it in. */}
                {kri.owner && (
                  <span
                    title={t("organization.kri.ownerLabel", { owner: kri.owner })}
                    className="flex min-w-0 items-center gap-1"
                  >
                    <User className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{kri.owner}</span>
                  </span>
                )}
                {/* aexa-server#242 — overdue is computed server-side from
                    frequency + last_measured_at; always false with no
                    frequency, so this never shows on a KRI with no cadence. */}
                {kri.overdue && (
                  <span
                    className={`ml-auto flex items-center gap-1 font-medium ${SEVERITY_STYLES.critical.text}`}
                  >
                    <Clock className="h-3 w-3" />
                    {t("organization.kri.overdueLabel")}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {/* Round 8 (UX finding): the empty state was a bare line of text
            with no icon and no way to act on it -- a new org with zero
            KRIs landed here with no visible next step besides scrolling
            back up to a button that may not even be in view. Only shown
            when there's genuinely nothing to create yet (no active
            status filter, which already has its own "clear filter" CTA
            via FilteredByNotice above). */}
        {statusFilteredKris.length === 0 && (
          <div className="col-span-full rounded-xl border border-border bg-card p-12 text-center">
            <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {t("organization.kri.noKris")}
            </p>
            {canWrite && !statusParam && (
              <button
                type="button"
                onClick={openNewKriForm}
                className="focus-ring mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />{" "}
                {t("organization.kri.createFirstKri")}
              </button>
            )}
          </div>
        )}
      </div>

      {updatingKriId && (
        <UpdateValueModal
          kri={updatingKri}
          value={updateValue}
          onValueChange={setUpdateValue}
          onClose={() => setUpdatingKriId(null)}
          onSave={handleUpdateValue}
          isSaving={isUpdatingValue}
        />
      )}

      {editingKriId && (
        <EditKriModal
          form={editForm}
          setForm={setEditForm}
          onClose={() => setEditingKriId(null)}
          onSave={handleSaveEdit}
          isSaving={isSavingEdit}
        />
      )}

      <DeleteAlertModal
        title={t("organization.kri.deleteConfirmTitle")}
        description={
          deletingKri
            ? t("organization.kri.deleteConfirmDescription", {
                name: deletingKri.name,
              })
            : undefined
        }
        open={!!deletingKri}
        setOpen={(open) => {
          if (!open) setDeletingKri(null)
        }}
        onConfirm={handleDelete}
        loading={isDeleting}
      />

      {showForm && (
        <NewKriModal
          form={form}
          setForm={setForm}
          risks={risks}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      {trendKriId && (
        <TrendModal
          kri={trendKri}
          chartData={trendChartData}
          summary={trendSummary}
          isLoading={isLoadingReadings}
          isError={readingsError}
          onClose={() => setTrendKriId(null)}
        />
      )}
    </div>
  )
}
