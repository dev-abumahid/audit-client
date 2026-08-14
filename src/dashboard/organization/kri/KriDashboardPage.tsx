/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useCreateNewKriMutation,
  useDeleteKriMutation,
  useGetAllKriQuery,
  useGetKriReadingsQuery,
  useSubmitKriValueMutation,
  useUpdateKriMutation,
} from "@/redux/apis/organization/kri.api"
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import FilteredByNotice from "@/components/shared/FilteredByNotice"
import { useGetAllAlertsQuery } from "@/redux/apis/organization/alert.api"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import { useModalA11y } from "@/hooks/useModalA11y"
import { formatLocaleDate } from "@/utils/formatDate"
import type { Alert, KRI, Risk } from "@/types/organization"
import {
  SEVERITY_STYLES,
  severityBadgeClasses,
  type SeverityLevel,
} from "@/utils/severityStyles"
import {
  AlertTriangle,
  ChartLine,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useSearchParams } from "react-router"
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

const EMPTY_KRI = {
  name: "",
  risk_id: "",
  unit: "",
  current_value: 0,
  target_value: 0,
  alert_threshold: 0,
  frequency: "monthly",
}

// Round-5 industry-standards finding: the backend's updateKri/deleteKri
// endpoints existed with zero frontend consumer -- a KRI's name, unit, or
// thresholds could never be corrected after creation, and a mistakenly
// created KRI could never be removed, without going around the UI
// entirely. Mirrors EMPTY_KRI's shape minus risk_id/current_value, which
// update_kri's own zod schema on aexa-server explicitly doesn't accept.
const EMPTY_EDIT_KRI = {
  name: "",
  unit: "",
  target_value: 0,
  alert_threshold: 0,
  frequency: "monthly",
}

// quality-bar-loop round 3 (efficiency, round-1 finding): both are static
// -- hoisted to module scope instead of being redeclared inside the
// component on every render.
const SEVERITY_RANK: Record<string, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
}

// Fresh full-panel re-score (code quality finding): a KRI's ALERT/WARNING/
// OK status was independently re-derived into a severity level, a border
// color, and a translated label in FOUR separate places across this file
// (the card border, the status badge's color, the status badge's text, and
// the URL-filter notice's text) -- any future 4th status value or renamed
// class would need updating in all four spots with nothing to catch a
// missed one. One lookup, keyed once.
const KRI_STATUS_META: Record<
  string,
  { severityLevel: SeverityLevel; borderClass: string; labelKey: string }
> = {
  ALERT: {
    severityLevel: "critical",
    borderClass: "border-risk-critical/40",
    labelKey: "organization.kri.status.alert",
  },
  WARNING: {
    severityLevel: "medium",
    borderClass: "border-risk-medium/40",
    labelKey: "organization.kri.status.warning",
  },
  OK: {
    severityLevel: "low",
    borderClass: "border-risk-low/40",
    labelKey: "organization.kri.status.ok",
  },
}
const kriStatusMeta = (status: string) =>
  KRI_STATUS_META[status] ?? KRI_STATUS_META.OK

// Fresh full-panel re-score (code quality finding): unnamed magic numbers.
const HIGHLIGHT_DURATION_MS = 3000
const RISK_NAME_TRUNCATE_LENGTH = 30
const highestSeverity = (
  kriAlerts: { severity: SeverityLevel }[]
): SeverityLevel =>
  kriAlerts.reduce(
    (worst, alert) =>
      (SEVERITY_RANK[alert.severity] ?? 0) > (SEVERITY_RANK[worst] ?? -1)
        ? alert.severity
        : worst,
    "low" as SeverityLevel
  )

export default function KriDashboardPage() {
  const { t, i18n } = useTranslation()
  // aexa-frontend#217
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)
  const {
    data: kriResponse,
    isLoading: krisLoading,
    error: krisError,
  } = useGetAllKriQuery(undefined)
  // Fresh full-panel re-score (resilience finding): neither secondary
  // query below checked isError -- a genuine fetch failure fell through
  // to the same `?? []` empty-array fallback every KRI card already uses
  // when a risk/alert genuinely doesn't exist, so a real outage looked
  // identical to "this KRI has no related risk/alerts." Same
  // isError-omission bug class already fixed on Alerts/Intelligence/etc.
  // this session.
  const { data: riskResponse, isError: risksError } = useGetAllRisksQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    category: "",
  })
  // aexa-frontend#530: drives the per-card alert-count badge below -- the
  // other, already-shipped half of this cross-link is AlertsPage.tsx's
  // "View KRI" link, which lands here with a ?highlight= param.
  const { data: alertsResponse, isError: alertsError } =
    useGetAllAlertsQuery(undefined)
  const [createKri] = useCreateNewKriMutation()
  const [submitKriValue] = useSubmitKriValueMutation()
  const [updateKri] = useUpdateKriMutation()
  const [deleteKri] = useDeleteKriMutation()

  // quality-bar-loop round 3 (efficiency, review finding): `?? []` creates
  // a fresh array reference every render when data is still undefined,
  // which would defeat every useMemo below keyed on these -- memoized so
  // the empty-array fallback is referentially stable too.
  const kris = useMemo(() => kriResponse?.data ?? [], [kriResponse])
  const risks = useMemo(() => riskResponse?.data ?? [], [riskResponse])
  const alerts = useMemo(() => alertsResponse?.data ?? [], [alertsResponse])
  // quality-bar-loop round 3 (efficiency, round-1 finding): a plain
  // `risks.find(...)` inside the KRI `.map()` below was an O(n*m) lookup
  // instead of a pre-built index -- at "low hundreds of KRIs x low
  // hundreds of risks" that's a few thousand redundant scans per render.
  const risksById = useMemo(
    () => new Map(risks.map((r: Risk) => [r.id, r])),
    [risks]
  )
  // Unread only: a read alert no longer represents an outstanding issue on
  // the KRI, so it shouldn't keep inflating this badge indefinitely.
  // quality-bar-loop round 3 (efficiency, round-1 finding): recomputed
  // every render before this, including on every keystroke in the New
  // KRI form (unrelated state in the same component).
  const unreadAlertsByKriId = useMemo(
    () =>
      alerts.reduce<Record<string, Alert[]>>((acc, alert: Alert) => {
        if (alert.kri_id && !alert.is_read) {
          acc[alert.kri_id] = [...(acc[alert.kri_id] ?? []), alert]
        }
        return acc
      }, {}),
    [alerts]
  )

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

  // aexa-frontend#471 -- role="dialog"/focus-trap/Escape for all three
  // modals below, via the shared hook (see useModalA11y.ts for why this
  // isn't a Radix Dialog migration instead).
  const updateValueModalRef = useModalA11y(!!updatingKriId, () =>
    setUpdatingKriId(null)
  )
  const newKriModalRef = useModalA11y(showForm, () => setShowForm(false))
  const trendModalRef = useModalA11y(!!trendKriId, () => setTrendKriId(null))
  const editKriModalRef = useModalA11y(!!editingKriId, () =>
    setEditingKriId(null)
  )

  const handleSave = async () => {
    if (!form.name || !form.risk_id) return
    if (form.target_value === form.alert_threshold) {
      toast.error(t("organization.kri.toast.thresholdMustDiffer"))
      return
    }

    setIsSaving(true)
    try {
      await createKri({
        risk_id: form.risk_id,
        name: form.name,
        unit: form.unit,
        current_value: form.current_value,
        alert_threshold: form.alert_threshold,
        target_value: form.target_value,
        frequency: form.frequency,
      }).unwrap()
      toast.success(t("organization.kri.toast.created"))
      setShowForm(false)
      setForm(EMPTY_KRI)
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.kri.toast.createFailed")
      )
    } finally {
      setIsSaving(false)
    }
  }

  const openUpdateValue = (kri: any) => {
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

    setIsUpdatingValue(true)
    try {
      await submitKriValue({
        id: updatingKriId,
        current_value: value,
      }).unwrap()
      toast.success(t("organization.kri.toast.valueUpdated"))
      setUpdatingKriId(null)
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.kri.toast.updateFailed")
      )
    } finally {
      setIsUpdatingValue(false)
    }
  }

  const openEdit = (kri: KRI) => {
    setEditingKriId(kri.id)
    setEditForm({
      name: kri.name,
      unit: kri.unit,
      target_value: Number(kri.target_value),
      alert_threshold: Number(kri.alert_threshold),
      frequency: kri.frequency ?? "monthly",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingKriId || !editForm.name) return
    if (editForm.target_value === editForm.alert_threshold) {
      toast.error(t("organization.kri.toast.thresholdMustDiffer"))
      return
    }

    setIsSavingEdit(true)
    try {
      await updateKri({
        id: editingKriId,
        data: {
          name: editForm.name,
          unit: editForm.unit,
          alert_threshold: editForm.alert_threshold,
          target_value: editForm.target_value,
          frequency: editForm.frequency,
        },
      }).unwrap()
      toast.success(t("organization.kri.toast.edited"))
      setEditingKriId(null)
    } catch (err: any) {
      toast.error(err?.data?.message || t("organization.kri.toast.editFailed"))
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingKri) return
    setIsDeleting(true)
    try {
      await deleteKri(deletingKri.id).unwrap()
      toast.success(t("organization.kri.toast.deleted"))
      setDeletingKri(null)
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.kri.toast.deleteFailed")
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const trendKri = trendKriId
    ? kris.find((k: any) => k.id === trendKriId)
    : null
  // Round 8 (UX finding): the update-value modal was a bare number input
  // with no indication which KRI it was for, or what unit/threshold it's
  // measured against -- a real risk of typing a value into the wrong
  // context after opening several cards' modals in a row.
  const updatingKri = updatingKriId
    ? kris.find((k: any) => k.id === updatingKriId)
    : null
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

  // quality-bar-loop round 3 (efficiency, round-1 finding): three
  // separate `.filter().length` passes over `kris` recomputed every
  // render (same unrelated-state-triggers-rescan issue as above) --
  // combined into a single pass.
  const { alertCount, warningCount, okCount } = useMemo(() => {
    let alert = 0
    let warning = 0
    let ok = 0
    for (const k of kris) {
      if (k.status === "ALERT") alert++
      else if (k.status === "WARNING") warning++
      else if (k.status === "OK") ok++
    }
    return { alertCount: alert, warningCount: warning, okCount: ok }
  }, [kris])

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
            onClick={() => {
              setForm(EMPTY_KRI)
              setShowForm(true)
            }}
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
        {statusFilteredKris.map((kri: any) => {
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
                <span className="font-mono-data text-2xl font-bold text-foreground lg:text-3xl">
                  {Number(kri.current_value)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {kri.unit}
                </span>
                {/* quality-bar-loop round 2 (mobile, round-1 finding):
                    these buttons measured 22x22px -- under the 44px
                    touch-target guideline, and 2 of the 3 interactive
                    controls on every card. Same h-11 w-11 fix already
                    established on RiskMatrixPage/CorrelationMatrixPage:
                    the wrapper gets the full touch target while the icon
                    inside stays visually small. */}
                <button
                  type="button"
                  onClick={() => setTrendKriId(kri.id)}
                  className="focus-ring ml-auto flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={t("organization.kri.trend.viewTooltip")}
                  aria-label={t("organization.kri.trend.viewTooltip")}
                >
                  <ChartLine className="h-3.5 w-3.5" />
                </button>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => openUpdateValue(kri)}
                    className="focus-ring flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                    className="focus-ring flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={t("organization.kri.editTooltip")}
                    aria-label={t("organization.kri.editTooltip")}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setDeletingKri(kri)}
                    className="focus-ring flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
                    {Number(kri.alert_threshold)}
                  </span>
                </span>
                <span>
                  {t("organization.kri.targetLabel")}{" "}
                  <span
                    className={`font-mono-data font-medium ${SEVERITY_STYLES.low.text}`}
                  >
                    {Number(kri.target_value)}
                  </span>
                </span>
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
                onClick={() => {
                  setForm(EMPTY_KRI)
                  setShowForm(true)
                }}
                className="focus-ring mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />{" "}
                {t("organization.kri.createFirstKri")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Update Value Modal */}
      {updatingKriId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setUpdatingKriId(null)}
        >
          <div
            ref={updateValueModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kri-update-value-title"
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="kri-update-value-title"
                className="text-lg font-bold text-foreground"
              >
                {t("organization.kri.updateValueTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setUpdatingKriId(null)}
                aria-label={t("organization.kri.cancel")}
                // quality-bar-loop round 2 (mobile, round-1 finding):
                // measured ~28px -- under the 44px touch-target guideline.
                className="focus-ring flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {updatingKri && (
              <div className="mb-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {updatingKri.name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("organization.kri.thresholdLabel")}{" "}
                  {Number(updatingKri.alert_threshold)} ·{" "}
                  {t("organization.kri.targetLabel")}{" "}
                  {Number(updatingKri.target_value)}
                  {updatingKri.unit ? ` ${updatingKri.unit}` : ""}
                </p>
              </div>
            )}
            <label
              htmlFor="kri-update-value-input"
              className="text-xs font-medium text-muted-foreground"
            >
              {t("organization.kri.form.currentValue")}
            </label>
            <input
              id="kri-update-value-input"
              type="number"
              value={updateValue}
              onChange={(e) => setUpdateValue(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUpdatingKriId(null)}
                className="focus-ring rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("organization.kri.cancel")}
              </button>
              <button
                type="button"
                onClick={handleUpdateValue}
                disabled={isUpdatingValue}
                className="focus-ring flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isUpdatingValue ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("organization.kri.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Round-5 industry-standards finding: no way to edit a KRI's own
          fields (name/unit/thresholds/frequency) after creation existed
          at all -- only its current value (the modal above). Mirrors the
          New KRI modal's fields minus risk_id/current_value, which
          update_kri's own backend schema doesn't accept. */}
      {editingKriId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setEditingKriId(null)}
        >
          <div
            ref={editKriModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kri-edit-title"
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="kri-edit-title" className="text-lg font-bold text-foreground">
                {t("organization.kri.editKriTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setEditingKriId(null)}
                aria-label={t("organization.kri.cancel")}
                className="focus-ring flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="kri-edit-name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.kri.form.name")} *
                </label>
                <input
                  id="kri-edit-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder={t("organization.kri.form.namePlaceholder")}
                />
              </div>

              <div>
                <label
                  htmlFor="kri-edit-unit"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.kri.form.unit")}
                </label>
                <input
                  id="kri-edit-unit"
                  value={editForm.unit}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, unit: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder={t("organization.kri.form.unitPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="kri-edit-alert-threshold"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.kri.form.alertThreshold")}
                  </label>
                  <input
                    id="kri-edit-alert-threshold"
                    type="number"
                    value={editForm.alert_threshold}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        alert_threshold: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="kri-edit-target"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.kri.form.target")}
                  </label>
                  <input
                    id="kri-edit-target"
                    type="number"
                    value={editForm.target_value}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        target_value: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="kri-edit-frequency"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.kri.form.frequency")}
                </label>
                <select
                  id="kri-edit-frequency"
                  value={editForm.frequency}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, frequency: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="daily">
                    {t("organization.kri.frequency.daily")}
                  </option>
                  <option value="weekly">
                    {t("organization.kri.frequency.weekly")}
                  </option>
                  <option value="monthly">
                    {t("organization.kri.frequency.monthly")}
                  </option>
                  <option value="quarterly">
                    {t("organization.kri.frequency.quarterly")}
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingKriId(null)}
                className="focus-ring rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("organization.kri.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editForm.name}
                className="focus-ring flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("organization.kri.save")}
              </button>
            </div>
          </div>
        </div>
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

      {/* New KRI Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            ref={newKriModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kri-new-title"
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="kri-new-title"
                className="text-lg font-bold text-foreground"
              >
                {t("organization.kri.newKri")}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label={t("organization.kri.cancel")}
                // quality-bar-loop round 2 (mobile, round-1 finding):
                // measured ~28px -- under the 44px touch-target guideline.
                className="focus-ring flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="kri-form-name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.kri.form.name")} *
                </label>
                <input
                  id="kri-form-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder={t("organization.kri.form.namePlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="kri-form-risk"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.kri.form.risk")} *
                  </label>
                  <select
                    id="kri-form-risk"
                    value={form.risk_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, risk_id: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">
                      {t("organization.kri.form.selectRisk")}
                    </option>
                    {risks.map((r: any) => (
                      <option key={r.id} value={r.id} title={r.name}>
                        {r.name.length > RISK_NAME_TRUNCATE_LENGTH
                          ? `${r.name.slice(0, RISK_NAME_TRUNCATE_LENGTH)}...`
                          : r.name}
                      </option>
                    ))}
                  </select>
                  {/* option-element title tooltips don't reliably render
                      everywhere (same constraint the ReportsPage "Coming
                      soon" fix documents), so the full name of a truncated
                      selection is also always visible here, not just on
                      hover. */}
                  {(() => {
                    const selected = risks.find(
                      (r: any) => r.id === form.risk_id
                    )
                    return selected &&
                      selected.name.length > RISK_NAME_TRUNCATE_LENGTH ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {selected.name}
                      </p>
                    ) : null
                  })()}
                </div>
                <div>
                  <label
                    htmlFor="kri-form-unit"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.kri.form.unit")}
                  </label>
                  <input
                    id="kri-form-unit"
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    placeholder={t("organization.kri.form.unitPlaceholder")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="kri-form-current-value"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.kri.form.currentValue")}
                  </label>
                  <input
                    id="kri-form-current-value"
                    type="number"
                    value={form.current_value}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        current_value: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="kri-form-alert-threshold"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.kri.form.alertThreshold")}
                  </label>
                  <input
                    id="kri-form-alert-threshold"
                    type="number"
                    value={form.alert_threshold}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        alert_threshold: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="kri-form-target"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.kri.form.target")}
                  </label>
                  <input
                    id="kri-form-target"
                    type="number"
                    value={form.target_value}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        target_value: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="kri-form-frequency"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.kri.form.frequency")}
                </label>
                <select
                  id="kri-form-frequency"
                  value={form.frequency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, frequency: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="daily">
                    {t("organization.kri.frequency.daily")}
                  </option>
                  <option value="weekly">
                    {t("organization.kri.frequency.weekly")}
                  </option>
                  <option value="monthly">
                    {t("organization.kri.frequency.monthly")}
                  </option>
                  <option value="quarterly">
                    {t("organization.kri.frequency.quarterly")}
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="focus-ring rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("organization.kri.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !form.name || !form.risk_id}
                className="focus-ring flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("organization.kri.createKri")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trend modal (aexa-server#242 / aexa-frontend#211) */}
      {trendKriId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setTrendKriId(null)}
        >
          <div
            ref={trendModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kri-trend-title"
            className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="kri-trend-title"
                className="text-lg font-bold text-foreground"
              >
                {t("organization.kri.trend.modalTitle", {
                  name: trendKri?.name ?? "",
                })}
              </h2>
              <button
                type="button"
                onClick={() => setTrendKriId(null)}
                aria-label={t("organization.kri.cancel")}
                // quality-bar-loop round 2 (mobile, round-1 finding):
                // measured ~28px -- under the 44px touch-target guideline.
                className="focus-ring flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingReadings && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Fresh full-panel re-score (resilience finding): a failed
                readings fetch fell through to the same empty-state
                message as "this KRI genuinely has no readings yet" --
                indistinguishable from a real outage.
                Round-1 review of PR #847: gated on trendChartData.length
                === 0 too -- getKriReadings' providesTags: ["KRI"] means a
                background refetch (e.g. triggered by submitting a new
                value while this modal is open) can fail while the prior
                successful fetch's chart data is still cached. The
                original version hid that still-valid stale chart behind
                this error message unconditionally, the same
                stale-but-valid-data anti-pattern already fixed on
                Alerts/Intelligence this session. */}
            {!isLoadingReadings && readingsError && trendChartData.length === 0 && (
              <p
                role="alert"
                className="py-8 text-center text-sm text-destructive"
              >
                {t("organization.kri.trend.loadError")}
              </p>
            )}

            {!isLoadingReadings && !readingsError && trendChartData.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("organization.kri.trend.empty")}
              </p>
            )}

            {!isLoadingReadings && readingsError && trendChartData.length > 0 && (
              <p role="alert" className="mb-2 text-xs text-destructive">
                {t("organization.kri.trend.refetchFailedStale")}
              </p>
            )}

            {!isLoadingReadings && trendChartData.length > 0 && (
              <div className="h-64">
                {/* Round 9 (accessibility finding): Recharts renders a
                    purely visual SVG with no text alternative for a
                    screen-reader user -- a concise text summary conveys
                    the same "what's the trend" signal the chart exists
                    to show, without needing a full data-table fallback. */}
                <p className="sr-only">
                  {t("organization.kri.trend.summary", {
                    count: trendChartData.length,
                    first: trendChartData[0].recorded_at,
                    last: trendChartData[trendChartData.length - 1]
                      .recorded_at,
                    latestValue:
                      trendChartData[trendChartData.length - 1].value,
                  })}
                </p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData}>
                    <XAxis
                      dataKey="recorded_at"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                    />
                    {trendKri && (
                      <ReferenceLine
                        y={Number(trendKri.alert_threshold)}
                        stroke="hsl(var(--risk-critical))"
                        strokeDasharray="4 4"
                        label={{
                          value: t("organization.kri.thresholdLabel"),
                          fontSize: 10,
                          fill: "hsl(var(--risk-critical))",
                        }}
                      />
                    )}
                    {trendKri && (
                      <ReferenceLine
                        y={Number(trendKri.target_value)}
                        stroke="hsl(var(--risk-low))"
                        strokeDasharray="4 4"
                        label={{
                          value: t("organization.kri.targetLabel"),
                          fontSize: 10,
                          fill: "hsl(var(--risk-low))",
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
