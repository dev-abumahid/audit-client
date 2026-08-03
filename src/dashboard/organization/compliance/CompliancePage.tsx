import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import CreateNewFindingModal from "@/dashboard/organization/findings/CreateNewFindingModal"
import { formatDateOnlyForDisplay } from "@/dashboard/organization/findings/dueDateInput"
import type {
  ComplianceObligation,
  ComplianceScoreBand,
} from "@/redux/apis/organization/compliance.api"
import {
  useAttestComplianceMutation,
  useCreateComplianceMutation,
  useDeleteComplianceMutation,
  useGetAllComplianceQuery,
  useGetComplianceAttestationsQuery,
  useGetComplianceScorecardQuery,
  useUpdateComplianceMutation,
} from "@/redux/apis/organization/compliance.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import { COMPLIANCE_DOMAINS } from "@/utils/complianceConfig"
import { formatLocaleDate } from "@/utils/formatDate"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  Loader2,
  MinusCircle,
  Paperclip,
  Pencil,
  Plus,
  RotateCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

// Loose string statuses matching the backend (Risk.status convention).
const STATUS_KEYS = [
  "compliant",
  "in_progress",
  "non_compliant",
  "not_applicable",
] as const

const STATUS_ICONS: Record<string, React.ElementType> = {
  compliant: CheckCircle2,
  in_progress: Clock,
  non_compliant: Ban,
  not_applicable: MinusCircle,
}

const STATUS_BADGE: Record<string, string> = {
  compliant: "bg-risk-low/10 text-risk-low",
  in_progress: "bg-amber-500/10 text-amber-600",
  non_compliant: "bg-risk-critical/10 text-risk-critical",
  not_applicable: "bg-muted text-muted-foreground",
}

// aexa-server#250 — declared re-attestation cadence. Empty string maps to
// null (non-recurring) on submit, same convention as site_id's "" -> null.
const RECURRENCE_KEYS = ["", "monthly", "quarterly", "annual"] as const

// Red/orange/green banding from the scorecard endpoint (CDC 7.7 thresholds).
const BAND_CLASSES: Record<ComplianceScoreBand, string> = {
  green: "bg-risk-low/10 text-risk-low border-risk-low/30",
  orange: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  red: "bg-risk-critical/10 text-risk-critical border-risk-critical/30",
  none: "bg-muted text-muted-foreground border-border",
}

// Server-side page size for the obligation list. Filtering (search / domain /
// status) is applied server-side too, so the list is no longer capped at the
// first 100 rows the way the old client-side-filtered version was.
const PAGE_SIZE = 20

const EMPTY_FORM = {
  id: "",
  title: "",
  description: "",
  domain: Object.keys(COMPLIANCE_DOMAINS)[0],
  site_id: "",
  status: "in_progress" as string,
  owner: "",
  due_date: "",
  attachments: [] as string[],
  regulation_reference: "",
  recurrence: "" as string,
}

export default function CompliancePage() {
  const { t, i18n } = useTranslation()
  // aexa-frontend#217
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)

  const [filterDomain, setFilterDomain] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  // Filtering, searching and pagination are all applied server-side (the
  // /compliance list endpoint supports searchTerm / status / domain + page /
  // limit), so results are never silently capped at the first page.
  const { data: complianceData, isLoading } = useGetAllComplianceQuery({
    page,
    limit: PAGE_SIZE,
    searchTerm: search,
    status: filterStatus || undefined,
    domain: filterDomain || undefined,
  })
  const { data: scorecardData } = useGetComplianceScorecardQuery()
  const { data: sitesData } = useGetAllSitesQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })

  const [createCompliance, { isLoading: isCreating }] =
    useCreateComplianceMutation()
  const [updateCompliance, { isLoading: isUpdating }] =
    useUpdateComplianceMutation()
  const [deleteCompliance] = useDeleteComplianceMutation()
  const [attestCompliance, { isLoading: isAttesting }] =
    useAttestComplianceMutation()

  const obligations: ComplianceObligation[] = useMemo(
    () => complianceData?.data || [],
    [complianceData]
  )
  const meta = complianceData?.meta
  const totalPages = meta?.totalPage ?? 0
  const scorecard = scorecardData?.data
  const sites = sitesData?.data || []

  // aexa-frontend#265: deleting the last obligation on the last page shrinks
  // totalPages without a filter change (handleSearchChange/handleDomainChange/
  // handleStatusChange below only reset page on filter changes), stranding
  // the user on an out-of-range empty page. Delete-path counterpart to
  // #234/#243.
  useClampPageToTotal(page, totalPages, setPage)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)

  // The obligation a remediation Action is being created for (#166). Non-null
  // means the reused CreateNewFindingModal is open, pre-filled and carrying the
  // real complianceObligationId FK the backend (aexa-server#226) links on save.
  const [actionObligation, setActionObligation] =
    useState<ComplianceObligation | null>(null)

  // aexa-server#250 -- the obligation currently open in the re-attest
  // confirm dialog / attestation history modal, respectively. Non-null
  // means that modal is open, same convention as actionObligation above.
  const [attestObligation, setAttestObligation] =
    useState<ComplianceObligation | null>(null)
  const [attestNote, setAttestNote] = useState("")
  const [historyObligation, setHistoryObligation] =
    useState<ComplianceObligation | null>(null)
  // Only fetched while the history modal is actually open for a given
  // obligation (skip otherwise), same idle-until-opened convention as the
  // reused CreateNewFindingModal below.
  const { data: attestationsData, isLoading: isLoadingAttestations } =
    useGetComplianceAttestationsQuery(
      { id: historyObligation?.id ?? "", page: 1, limit: 20 },
      { skip: !historyObligation }
    )

  // Changing any filter resets to page 1 so the user never lands on an
  // out-of-range page for the newly-filtered result set.
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const handleDomainChange = (value: string) => {
    setFilterDomain(value)
    setPage(1)
  }
  const handleStatusChange = (value: string) => {
    setFilterStatus(value)
    setPage(1)
  }

  // Windowed page numbers around the current page (same pattern as
  // AllFindingsPage), so the control stays compact for large result sets.
  const getPageNumbers = () => {
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  // Domain/status labels are echoed as raw keys until i18n initializes (tests),
  // and translated in the running app — same t() convention as RiskRegisterPage.
  const domainLabel = (key: string) =>
    COMPLIANCE_DOMAINS[key]
      ? t(`organization.compliance.domains.${key}`)
      : key
  const statusLabel = (key: string) =>
    STATUS_ICONS[key] ? t(`organization.compliance.status.${key}`) : key

  const siteName = (siteId: string | null) =>
    siteId ? (sites.find((s) => s.id === siteId)?.name ?? siteId) : null

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (obl: ComplianceObligation) => {
    setEditingId(obl.id)
    setForm({
      id: obl.id,
      title: obl.title,
      description: obl.description || "",
      domain: obl.domain,
      site_id: obl.site_id || "",
      status: obl.status,
      owner: obl.owner || "",
      // date input wants yyyy-mm-dd; the API returns a full ISO timestamp.
      due_date: obl.due_date ? obl.due_date.slice(0, 10) : "",
      attachments: obl.attachments || [],
      regulation_reference: obl.regulation_reference || "",
      recurrence: obl.recurrence && obl.recurrence !== "one_time" ? obl.recurrence : "",
    })
    setShowForm(true)
  }

  const uploadAttachment = async (file: File) => {
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch(`${BASE_URL}/api/compliance/attachment`, {
        method: "POST",
        credentials: "include",
        body,
      })
      if (!res.ok) throw new Error("Upload failed")
      const json = await res.json()
      const url: string = json.data?.url ?? json.url ?? ""
      if (url) {
        setForm((f) => ({ ...f, attachments: [...f.attachments, url] }))
      } else {
        toast.error(t("organization.compliance.toast.uploadFailed"))
      }
    } catch {
      toast.error(t("organization.compliance.toast.uploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  const removeAttachment = (url: string) => {
    setForm((f) => ({
      ...f,
      attachments: f.attachments.filter((a) => a !== url),
    }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) return

    const payload: Partial<ComplianceObligation> = {
      title: form.title,
      description: form.description,
      domain: form.domain,
      // "" means org-wide — send null so the backend stores NULL, not a bad FK.
      site_id: form.site_id || null,
      status: form.status,
      owner: form.owner,
      due_date: form.due_date || null,
      attachments: form.attachments,
      regulation_reference: form.regulation_reference || null,
      recurrence: form.recurrence || null,
    }

    try {
      let res
      if (editingId) {
        res = await updateCompliance({
          id: editingId,
          // Mark as human-edited so the SourceBadge reflects the change,
          // matching the prior local-state behaviour.
          data: { ...payload, is_edited: true },
        }).unwrap()
      } else {
        res = await createCompliance(payload).unwrap()
      }

      if (res.success) {
        toast.success(
          editingId
            ? t("organization.compliance.toast.updateSuccess")
            : t("organization.compliance.toast.createSuccess")
        )
        setShowForm(false)
        setForm(EMPTY_FORM)
      } else {
        toast.error(res.message || t("organization.compliance.toast.saveFailed"))
      }
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.compliance.toast.saveFailed")
      toast.error(message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("organization.compliance.deleteConfirm"))) return
    try {
      const res = await deleteCompliance(id).unwrap()
      if (res.success) {
        toast.success(t("organization.compliance.toast.deleteSuccess"))
      } else {
        toast.error(
          res.message || t("organization.compliance.toast.deleteFailed")
        )
      }
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.compliance.toast.deleteFailed")
      toast.error(message)
    }
  }

  // Found in review: actionObligation/attestObligation/historyObligation are
  // three independent state variables, each backing its own always-mounted-
  // when-set overlay -- opening one without clearing the other two let a
  // user stack two modals (e.g. Re-attest on one row, then History on
  // another without dismissing the first), leaving a stale dialog hidden
  // underneath. Every opener below clears the other two first.
  const openCreateAction = (obl: ComplianceObligation) => {
    setAttestObligation(null)
    setHistoryObligation(null)
    setActionObligation(obl)
  }

  const openAttest = (obl: ComplianceObligation) => {
    setActionObligation(null)
    setHistoryObligation(null)
    setAttestObligation(obl)
    setAttestNote("")
  }

  const openHistory = (obl: ComplianceObligation) => {
    setActionObligation(null)
    setAttestObligation(null)
    setHistoryObligation(obl)
  }

  const confirmAttest = async () => {
    if (!attestObligation) return
    try {
      const res = await attestCompliance({
        id: attestObligation.id,
        note: attestNote.trim() || undefined,
      }).unwrap()
      if (res.success) {
        toast.success(t("organization.compliance.toast.attestSuccess"))
        setAttestObligation(null)
        setAttestNote("")
      } else {
        toast.error(res.message || t("organization.compliance.toast.attestFailed"))
      }
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.compliance.toast.attestFailed")
      toast.error(message)
    }
  }

  // Whole-org counts come from the scorecard's statusCounts, so they stay
  // correct now that the list is server-side paginated (the current page is no
  // longer the whole dataset). Fall back to counting the loaded page if an
  // older response without statusCounts comes back.
  const statusCounts = scorecard?.statusCounts
  const compliantCount =
    statusCounts?.compliant ??
    obligations.filter((o) => o.status === "compliant").length
  const nonCompliantCount =
    statusCounts?.non_compliant ??
    obligations.filter((o) => o.status === "non_compliant").length
  const totalCount = meta?.total ?? obligations.length

  const overall = scorecard?.overall
  const overallPct =
    overall && overall.total > 0 ? Math.round(overall.ratio * 100) : 0

  // Distinct sites and domains present in the matrix, for the site×domain grid.
  const matrixDomains = useMemo(() => {
    if (!scorecard) return []
    return Array.from(new Set(scorecard.matrix.map((m) => m.domain))).sort()
  }, [scorecard])
  const matrixSiteKeys = useMemo(() => {
    if (!scorecard) return []
    const keys = new Set(scorecard.matrix.map((m) => m.site_id ?? "__org__"))
    return Array.from(keys)
  }, [scorecard])
  const cellFor = (siteKey: string, domain: string) => {
    const siteId = siteKey === "__org__" ? null : siteKey
    return scorecard?.matrix.find(
      (m) => (m.site_id ?? null) === siteId && m.domain === domain
    )
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="animate-fade-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">
            {t("organization.compliance.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.compliance.subtitle", {
              count: totalCount,
            })}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />{" "}
            {t("organization.compliance.newObligation")}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="animate-slide-up flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("organization.compliance.searchPlaceholder")}
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-3 text-xs"
          />
        </div>
        <select
          value={filterDomain}
          onChange={(e) => handleDomainChange(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs"
        >
          <option value="">{t("organization.compliance.allDomains")}</option>
          {Object.keys(COMPLIANCE_DOMAINS).map((key) => (
            <option key={key} value={key}>
              {domainLabel(key)}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs"
        >
          <option value="">{t("organization.compliance.allStatuses")}</option>
          {STATUS_KEYS.map((key) => (
            <option key={key} value={key}>
              {statusLabel(key)}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="animate-slide-up grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-risk-low/30 bg-risk-low/5 p-3 lg:p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-risk-low" />
            <span className="font-mono-data text-xl font-bold text-risk-low lg:text-2xl">
              {compliantCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("organization.compliance.card.compliant")}
          </p>
        </div>
        <div className="rounded-xl border border-risk-critical/30 bg-risk-critical/5 p-3 lg:p-4">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-risk-critical" />
            <span className="font-mono-data text-xl font-bold text-risk-critical lg:text-2xl">
              {nonCompliantCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("organization.compliance.card.nonCompliant")}
          </p>
        </div>
        <div
          className={`rounded-xl border p-3 lg:p-4 ${
            overall ? BAND_CLASSES[overall.band] : "border-border bg-card"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono-data text-xl font-bold lg:text-2xl">
              {overall && overall.total > 0 ? `${overallPct}%` : "—"}
            </span>
          </div>
          <p className="mt-1 text-xs opacity-80">
            {t("organization.compliance.card.overallScore")}
          </p>
        </div>
      </div>

      {/* Scorecard: site × domain matrix */}
      <div className="animate-slide-up stagger-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("organization.compliance.scorecard.title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("organization.compliance.scorecard.subtitle")}
          </p>
        </div>
        {scorecard && scorecard.matrix.length > 0 ? (
          <div className="overflow-x-auto p-4">
            <table className="w-full border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-semibold text-muted-foreground">
                    {t("organization.compliance.scorecard.site")}
                  </th>
                  {matrixDomains.map((d) => (
                    <th
                      key={d}
                      className="px-2 py-1 text-center font-semibold text-muted-foreground"
                    >
                      {domainLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixSiteKeys.map((siteKey) => (
                  <tr key={siteKey}>
                    <td className="px-2 py-1 font-medium text-foreground">
                      {siteKey === "__org__"
                        ? t("organization.compliance.scorecard.orgWide")
                        : siteName(siteKey)}
                    </td>
                    {matrixDomains.map((d) => {
                      const cell = cellFor(siteKey, d)
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          <span
                            className={`inline-block min-w-12 rounded-md border px-2 py-1 font-mono-data ${
                              BAND_CLASSES[cell?.band ?? "none"]
                            }`}
                            title={
                              cell
                                ? `${cell.compliant}/${cell.total}`
                                : undefined
                            }
                          >
                            {cell ? `${cell.compliant}/${cell.total}` : "—"}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {t("organization.compliance.scorecard.noData")}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="animate-slide-up stagger-2 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground lg:px-4">
                {t("organization.compliance.col.obligation")}
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-semibold text-muted-foreground sm:table-cell">
                {t("organization.compliance.col.domain")}
              </th>
              <th className="hidden px-3 py-3 text-center text-xs font-semibold text-muted-foreground md:table-cell">
                {t("organization.compliance.col.dueDate")}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                {t("organization.compliance.col.status")}
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-semibold text-muted-foreground lg:table-cell">
                {t("organization.compliance.col.owner")}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                {t("organization.compliance.col.source")}
              </th>
              <th className="w-16 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {obligations.map((obl) => {
              const StatusIcon = STATUS_ICONS[obl.status] || Clock
              // aexa-server#250 -- `overdue` is computed server-side from
              // next_review_date (falling back to due_date when unset), so a
              // recurring obligation reconfirmed on schedule stops reading as
              // overdue even though its original due_date already passed.
              // Prefer this over re-deriving overdue-ness from due_date alone.
              const isOverdue = obl.overdue

              return (
                <tr
                  key={obl.id}
                  className="group border-b border-border transition-colors hover:bg-muted/30"
                >
                  <td className="px-3 py-3 lg:px-4">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground">{obl.title}</p>
                      {obl.attachments.length > 0 && (
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="hidden max-w-xs truncate text-[10px] text-muted-foreground sm:block">
                      {obl.description}
                    </p>
                    {obl.regulation_reference && (
                      <p className="hidden max-w-xs truncate text-[10px] text-muted-foreground/80 sm:block">
                        {t("organization.compliance.col.regulationRefShort")}:{" "}
                        {obl.regulation_reference}
                      </p>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 text-xs text-muted-foreground sm:table-cell">
                    {domainLabel(obl.domain)}
                  </td>
                  <td className="hidden px-3 py-3 text-center md:table-cell">
                    <span
                      className={`font-mono-data text-xs ${
                        isOverdue
                          ? "font-bold text-risk-critical"
                          : "text-muted-foreground"
                      }`}
                    >
                      {obl.due_date
                        ? formatDateOnlyForDisplay(obl.due_date, i18n.language)
                        : "—"}
                    </span>
                    {isOverdue && (
                      <span className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-medium text-risk-critical">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {t("organization.compliance.overdueLabel")}
                      </span>
                    )}
                    {obl.recurrence && obl.next_review_date && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {t("organization.compliance.col.nextReviewShort")}:{" "}
                        {formatDateOnlyForDisplay(
                          obl.next_review_date,
                          i18n.language
                        )}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_BADGE[obl.status] ||
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusLabel(obl.status)}
                    </span>
                  </td>
                  <td className="hidden px-3 py-3 text-xs text-muted-foreground lg:table-cell">
                    {obl.owner || "—"}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <SourceBadge
                      aiGenerated={obl.ai_generated}
                      isEdited={obl.is_edited}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Remediation path for a failing obligation (#166):
                          only non-compliant rows are a dead end that needs a
                          "Create Action" affordance. Kept always-visible-on-hover
                          -group (not further hover-gated like edit/delete) so the
                          remediation nudge is actually discoverable -- but #217
                          still gates it on canWrite since it creates a Finding,
                          the same write action gated everywhere else. */}
                      {obl.status === "non_compliant" && canWrite && (
                        <button
                          onClick={() => openCreateAction(obl)}
                          className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20"
                        >
                          <Plus className="h-3 w-3" />
                          {t("organization.compliance.createAction.button")}
                        </button>
                      )}
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {canWrite && (
                          <>
                            <button
                              onClick={() => openEdit(obl)}
                              className="rounded p-1 text-muted-foreground hover:bg-muted"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            {/* aexa-server#250: re-attest is legitimate for
                                any obligation, recurring or not -- the
                                history entry itself is a real audit-trail
                                fact independent of whether there's a
                                cadence to advance. Same write gate as
                                edit/delete (assertCanWriteOrgResource). */}
                            <button
                              onClick={() => openAttest(obl)}
                              aria-label={t("organization.compliance.attest.button")}
                              className="rounded p-1 text-muted-foreground hover:bg-muted"
                            >
                              <RotateCw className="h-3 w-3" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openHistory(obl)}
                          aria-label={t("organization.compliance.attest.historyButton")}
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                        >
                          <History className="h-3 w-3" />
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => handleDelete(obl.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && obligations.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            {t("organization.compliance.empty")}
          </div>
        )}
      </div>

      {/* Pagination — server-side; hidden when everything fits on one page. */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            aria-label={t("organization.compliance.pagination.previous")}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {getPageNumbers().map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => setPage(pageNum)}
              aria-current={page === pageNum ? "page" : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                page === pageNum
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            aria-label={t("organization.compliance.pagination.next")}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {editingId
                  ? t("organization.compliance.form.editTitle")
                  : t("organization.compliance.form.newTitle")}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  {t("organization.compliance.form.title")} *
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("organization.compliance.form.domain")}
                  </label>
                  <select
                    value={form.domain}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, domain: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.keys(COMPLIANCE_DOMAINS).map((key) => (
                      <option key={key} value={key}>
                        {domainLabel(key)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("organization.compliance.form.site")}
                  </label>
                  <select
                    value={form.site_id}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, site_id: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">
                      {t("organization.compliance.form.orgWide")}
                    </option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("organization.compliance.form.description")}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("organization.compliance.form.regulationReference")}
                </label>
                <input
                  value={form.regulation_reference}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      regulation_reference: e.target.value,
                    }))
                  }
                  placeholder={t(
                    "organization.compliance.form.regulationReferencePlaceholder"
                  )}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("organization.compliance.form.status")}
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, status: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {STATUS_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {statusLabel(key)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("organization.compliance.form.dueDate")}
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, due_date: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("organization.compliance.form.owner")}
                  </label>
                  <input
                    value={form.owner}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, owner: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("organization.compliance.form.recurrence")}
                </label>
                <select
                  value={form.recurrence}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, recurrence: e.target.value }))
                  }
                  className="h-9 w-full max-w-50 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {RECURRENCE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {key
                        ? t(`organization.compliance.recurrence.${key}`)
                        : t("organization.compliance.recurrence.oneTime")}
                    </option>
                  ))}
                </select>
                {/* next_review_date is derived server-side, never editable
                    here -- see the ComplianceObligation type's own comment. */}
                {editingId &&
                  obligations.find((o) => o.id === editingId)
                    ?.next_review_date && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("organization.compliance.form.nextReview")}:{" "}
                      {formatDateOnlyForDisplay(
                        obligations.find((o) => o.id === editingId)!
                          .next_review_date!,
                        i18n.language
                      )}
                    </p>
                  )}
              </div>

              {/* aexa-server#243: status "compliant" is server-side hard-gated
                  on at least one attachment. Client-side warning only -- the
                  actual enforcement (and the source of truth for whether this
                  would actually be rejected) is assertCompliantHasEvidence on
                  the backend. */}
              {form.status === "compliant" && form.attachments.length === 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t("organization.compliance.form.evidenceRequiredWarning")}
                </div>
              )}

              {/* Evidence attachments */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("organization.compliance.form.attachments")}
                </label>
                <div className="space-y-1">
                  {form.attachments.map((url) => (
                    <div
                      key={url}
                      className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 items-center gap-1 truncate text-primary"
                      >
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {url.split("/").pop()}
                        </span>
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAttachment(url)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="mt-1 flex cursor-pointer items-center gap-1 rounded-md bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80">
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {t("organization.compliance.form.uploadEvidence")}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                    onChange={(e) =>
                      e.target.files?.[0] && uploadAttachment(e.target.files[0])
                    }
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("organization.compliance.form.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={isCreating || isUpdating || !form.title.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isCreating || isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {editingId
                  ? t("organization.compliance.form.update")
                  : t("organization.compliance.form.create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remediation Action modal (#166). Reuses the Findings/Inspection
          CreateNewFindingModal verbatim rather than building a second Action
          form — pre-filled with a title/description referencing the obligation
          and carrying complianceObligationId so the backend writes the real
          Action → ComplianceObligation link on save (aexa-server#226). Only
          mounted while an obligation is selected, so its RTK Query hooks stay
          idle on the normal Compliance view. */}
      {actionObligation && (
        <CreateNewFindingModal
          open
          onClose={() => setActionObligation(null)}
          additionalData={{
            actionTitle: `Remediate: ${actionObligation.title}`,
            actionDisc: actionObligation.description
              ? `Remediation action for non-compliant obligation "${actionObligation.title}": ${actionObligation.description}`
              : `Remediation action for non-compliant obligation "${actionObligation.title}".`,
            complianceObligationId: actionObligation.id,
          }}
        />
      )}

      {/* Re-attest confirm modal (aexa-server#250). Legal for any obligation,
          recurring or not -- see the row action's own comment. */}
      {attestObligation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAttestObligation(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-bold text-foreground">
              {t("organization.compliance.attest.modalTitle")}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("organization.compliance.attest.modalSubtitle", {
                title: attestObligation.title,
              })}
            </p>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("organization.compliance.attest.noteLabel")}
            </label>
            <textarea
              value={attestNote}
              onChange={(e) => setAttestNote(e.target.value)}
              rows={3}
              placeholder={t("organization.compliance.attest.notePlaceholder")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setAttestObligation(null)}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("organization.compliance.form.cancel")}
              </button>
              <button
                onClick={confirmAttest}
                disabled={isAttesting}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isAttesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCw className="h-4 w-4" />
                )}
                {t("organization.compliance.attest.confirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attestation history modal (aexa-server#250). attested_by is shown
          as-is (a raw accountId) -- OrgMember's own shape only exposes
          account.email/profile, not the underlying accountId to resolve a
          display name against, so name resolution isn't possible with the
          endpoints this frontend currently has. Same constraint as
          RiskOverrideBadge's overriddenBy rendering. */}
      {historyObligation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setHistoryObligation(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {t("organization.compliance.attest.historyModalTitle", {
                  title: historyObligation.title,
                })}
              </h2>
              <button
                onClick={() => setHistoryObligation(null)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingAttestations && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoadingAttestations &&
              (attestationsData?.data?.length ?? 0) === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("organization.compliance.attest.historyEmpty")}
                </p>
              )}

            <div className="space-y-2">
              {attestationsData?.data?.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_BADGE[entry.status_at_attestation] ||
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {statusLabel(entry.status_at_attestation)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatLocaleDate(entry.attested_at, i18n.language, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {t("organization.compliance.attest.attestedByLabel", {
                      accountId: entry.attested_by,
                    })}
                  </p>
                  {entry.note && (
                    <p className="mt-1 text-muted-foreground">{entry.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
