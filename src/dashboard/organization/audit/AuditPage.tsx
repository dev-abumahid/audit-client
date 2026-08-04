import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import type {
  AuditEngagement,
  AuditEngagementWrite,
} from "@/redux/apis/organization/audit.api"
import {
  useCreateAuditEngagementMutation,
  useDeleteAuditEngagementMutation,
  useGetAllAuditEngagementsQuery,
  useUpdateAuditEngagementMutation,
} from "@/redux/apis/organization/audit.api"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { formatLocaleDate } from "@/utils/formatDate"
import RiskMultiSelect from "./RiskMultiSelect"

// Same base-URL convention the Compliance module uses for its direct
// attachment upload: RTK Query's baseApi is for JSON endpoints, so the
// multipart file upload goes through a plain fetch to the shared uploader
// route instead.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

// One page's worth of engagements. Matches AllFindingsPage's page size.
const PAGE_SIZE = 20

const STATUS_ICONS: Record<string, React.ElementType> = {
  planned: Play,
  in_progress: Pause,
  completed: CheckCircle2,
}

// Shared label for the 3 stat cards whose count is only a client-side tally
// over the current page (see totalCount/inProgressCount comment below) --
// pulled out of the 3 near-identical call sites (issue #337 round-4 review).
function PageScopedStatLabel({ label }: { label: string }) {
  const { t } = useTranslation()
  return (
    <span
      className="ml-2 text-muted-foreground"
      title={t("organization.audit.statPageScopedTooltip")}
    >
      {label} {t("organization.audit.statPageQualifier")}
    </span>
  )
}

const EMPTY_FORM = {
  ref: "",
  title: "",
  scope: "",
  status: "planned" as "planned" | "in_progress" | "completed",
  lead_auditor: "",
  priority_score: 50,
  findings_count: 0,
  // aexa-frontend#165: real Risk record ids (a many-to-many relation), replacing
  // the old comma-separated free-text `linked_risk_refs` string.
  riskIds: [] as string[],
  started_at: "",
  closed_at: "",
}

// Upper bound for the risk-picker fetch. The register is org-scoped and risks
// are a bounded, human-curated set, so one generous page covers the picker
// without building an incremental loader into the dropdown.
const RISK_PICKER_LIMIT = 500

export default function AuditPage() {
  const {
    t,
    i18n: { language },
  } = useTranslation()
  // Search box (title / ref / lead_auditor — the backend searches all three)
  // and page state feed the paginated query. searchTerm was previously
  // hardcoded to "" and page/limit were fixed at 1/100, so the list silently
  // capped at 100 rows with no way to reach the rest and no way to filter.
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)

  const { data: auditData, isLoading } = useGetAllAuditEngagementsQuery({
    page,
    limit: PAGE_SIZE,
    searchTerm: search,
  })

  // All org risks, for the linked-risks picker. Fetched once here (not per-row)
  // so the create/edit modal can offer a real multi-select of actual Risk
  // records instead of the old free-text tag input (aexa-frontend#165).
  const { data: risksData, isLoading: isRisksLoading } = useGetAllRisksQuery({
    page: 1,
    limit: RISK_PICKER_LIMIT,
    searchTerm: "",
    siteId: "",
    category: "",
  })
  const riskOptions = (risksData?.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
  }))
  const [createAuditEngagement, { isLoading: isCreating }] =
    useCreateAuditEngagementMutation()
  const [updateAuditEngagement, { isLoading: isUpdating }] =
    useUpdateAuditEngagementMutation()
  const [deleteAuditEngagement] = useDeleteAuditEngagementMutation()

  const engagements: AuditEngagement[] = auditData?.data || []
  const meta = auditData?.meta
  const totalPages = meta?.totalPage || 0

  // aexa-frontend#265: deleting the last engagement on the last page shrinks
  // totalPages without a search change (handleSearchChange below only resets
  // page on a search change), stranding the user on an out-of-range empty
  // page. Delete-path counterpart to #234/#243.
  useClampPageToTotal(page, totalPages, setPage)

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState<string | null>(null)

  // Reset to page 1 whenever the search term changes so a filtered result set
  // never starts on an out-of-range page (same pattern AllFindingsPage uses).
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const getPageNumbers = () => {
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  const STATUS_CONFIG: Record<
    string,
    { label: string; bg: string; text: string }
  > = {
    planned: {
      label: t("organization.audit.statusPlanned"),
      bg: "bg-blue-500/10",
      text: "text-blue-600",
    },
    in_progress: {
      label: t("organization.audit.statusInProgress"),
      bg: "bg-orange-500/10",
      text: "text-orange-600",
    },
    completed: {
      label: t("organization.audit.statusCompleted"),
      bg: "bg-green-500/10",
      text: "text-green-600",
    },
  }

  const openCreate = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (eng: AuditEngagement) => {
    setEditId(eng.id)
    setForm({
      ref: eng.ref,
      title: eng.title,
      scope: eng.scope || "",
      status: eng.status as "planned" | "in_progress" | "completed",
      lead_auditor: eng.lead_auditor || "",
      priority_score: eng.priority_score ?? 0,
      findings_count: eng.findings_count,
      // Pre-fill the multi-select with the ids of the engagement's existing
      // linked risks so an edit round-trips them unchanged (aexa-frontend#165).
      riskIds: (eng.linked_risks ?? []).map((r) => r.id),
      // The date inputs want a yyyy-mm-dd value; the API returns a full ISO
      // timestamp, so slice off the time portion.
      started_at: eng.started_at ? eng.started_at.slice(0, 10) : "",
      closed_at: eng.closed_at ? eng.closed_at.slice(0, 10) : "",
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title) return

    const payload: AuditEngagementWrite = {
      ref: form.ref,
      title: form.title,
      scope: form.scope,
      status: form.status,
      lead_auditor: form.lead_auditor,
      priority_score: form.priority_score,
      findings_count: form.findings_count,
      // aexa-frontend#165: real linked-risk ids. Sent as an explicit array so
      // the backend replaces the whole link set (an empty array clears links).
      riskIds: form.riskIds,
      // Send null (not "") for unset dates so the backend stores NULL rather
      // than having to coerce an empty string.
      started_at: form.started_at || null,
      closed_at: form.closed_at || null,
    }

    try {
      let res
      if (editId) {
        // Mark the engagement as human-edited so the SourceBadge reflects the
        // change, matching the prior local-state behaviour.
        res = await updateAuditEngagement({
          id: editId,
          data: { ...payload, is_edited: true },
        }).unwrap()
      } else {
        res = await createAuditEngagement(payload).unwrap()
      }

      if (res.success) {
        toast.success(res.message)
        setShowModal(false)
        setForm(EMPTY_FORM)
      } else {
        // manage_response.ts (aexa-server) always sends { success, message,
        // data, meta } — never an `error` key — so `message` carries the
        // failure reason here.
        toast.error(res.message || t("organization.audit.saveFailed"))
      }
    } catch (err) {
      // Keep the modal open on failure so the user can retry without
      // re-entering the whole form.
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.audit.saveFailed")
      toast.error(message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("organization.audit.deleteConfirm"))) return
    try {
      const res = await deleteAuditEngagement(id).unwrap()
      if (res.success) {
        toast.success(t("organization.audit.deleteSuccess"))
      } else {
        toast.error(res.message || t("organization.audit.deleteFailed"))
      }
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.audit.deleteFailed")
      toast.error(message)
    }
  }

  const handleReportUpload = async (engId: string, file: File) => {
    setUploading(engId)
    try {
      // 1) Upload the file to the shared uploader route and get its URL back,
      //    mirroring the Compliance module's uploadAttachment flow.
      const body = new FormData()
      body.append("file", file)
      const res = await fetch(`${BASE_URL}/api/audit/attachment`, {
        method: "POST",
        credentials: "include",
        body,
      })
      if (!res.ok) throw new Error("Upload failed")
      const json = await res.json()
      const url: string = json.data?.url ?? json.url ?? ""
      if (!url) throw new Error("Upload failed")

      // 2) Persist the URL onto the engagement via the normal PATCH endpoint —
      //    no dedicated update endpoint needed, report_url is just a field.
      const updateRes = await updateAuditEngagement({
        id: engId,
        data: { report_url: url },
      }).unwrap()

      if (updateRes.success) {
        toast.success(t("organization.audit.reportUploadSuccess"))
      } else {
        toast.error(
          updateRes.message || t("organization.audit.saveReportFailed")
        )
      }
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.audit.uploadReportFailed")
      toast.error(message)
    } finally {
      setUploading(null)
    }
  }

  const handleDownloadReport = (reportUrl: string) => {
    // Open the real stored URL in a new tab.
    window.open(reportUrl, "_blank", "noopener,noreferrer")
  }

  // Total reflects the whole (filtered) result set via the paginated meta, not
  // just the current page. The in-progress / completed / findings tallies are
  // computed over the loaded page only — there is no server-side aggregate
  // endpoint for them (audit.api.ts's getAllAuditEngagements returns only a
  // paginated list + meta.total, no per-status counts), and fetching every
  // page just to sum client-side would be wasteful for orgs with many
  // engagements. Rather than silently undercount, the labels below are
  // qualified with "(this page)" so it's clear these three are scoped to the
  // current PAGE_SIZE page, not the whole org (issue #337).
  const totalCount = meta?.total ?? engagements.length
  const inProgressCount = engagements.filter(
    (e) => e.status === "in_progress"
  ).length
  const completedCount = engagements.filter(
    (e) => e.status === "completed"
  ).length
  const totalFindings = engagements.reduce(
    (sum, e) => sum + e.findings_count,
    0
  )

  return (
    <div className="space-y-6 p-6">
      <div className="animate-fade-in flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("organization.audit.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.audit.subtitle")}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> {t("organization.audit.newMission")}
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="animate-slide-up flex gap-4 text-xs">
        <div className="rounded-lg border border-border bg-card px-4 py-2.5">
          <span className="font-mono text-lg font-bold text-foreground">
            {totalCount}
          </span>
          <span className="ml-2 text-muted-foreground">
            {t("organization.audit.statTotal")}
          </span>
        </div>
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-2.5">
          <span className="font-mono text-lg font-bold text-orange-600">
            {inProgressCount}
          </span>
          <PageScopedStatLabel label={t("organization.audit.statInProgress")} />
        </div>
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2.5">
          <span className="font-mono text-lg font-bold text-green-600">
            {completedCount}
          </span>
          <PageScopedStatLabel label={t("organization.audit.statCompleted")} />
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5">
          <span className="font-mono text-lg font-bold text-destructive">
            {totalFindings}
          </span>
          <PageScopedStatLabel
            label={t("organization.audit.statTotalFindings")}
          />
        </div>
      </div>

      {/* Search */}
      <div className="animate-slide-up relative max-w-md">
        <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t("organization.audit.searchPlaceholder")}
          className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-xs"
        />
      </div>

      {/* Audit List */}
      <div className="animate-slide-up stagger-2 space-y-3">
        <h2 className="sr-only">{t("organization.audit.missionListHeading")}</h2>
        {engagements.map((eng) => {
          const statusCfg = STATUS_CONFIG[eng.status] || STATUS_CONFIG.planned
          const Icon = STATUS_ICONS[eng.status] || Play
          const hasReport = !!eng.report_url

          return (
            <div
              key={eng.id}
              className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${statusCfg.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${statusCfg.text}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        {eng.ref}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.text}`}
                      >
                        {statusCfg.label}
                      </span>
                      <SourceBadge
                        aiGenerated={eng.ai_generated}
                        isEdited={eng.is_edited}
                      />
                    </div>
                    <h3 className="mt-0.5 text-sm font-semibold text-foreground">
                      {eng.title}
                    </h3>
                    {eng.scope && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {eng.scope}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasReport ? (
                    <button
                      onClick={() => handleDownloadReport(eng.report_url!)}
                      className="flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-1 text-[10px] font-medium text-green-600 hover:bg-green-500/20"
                    >
                      <FileText className="h-3 w-3" />{" "}
                      {t("organization.audit.report")}{" "}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/80">
                      {uploading === eng.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      {t("organization.audit.uploadReport")}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
                        onChange={(e) =>
                          e.target.files?.[0] &&
                          handleReportUpload(eng.id, e.target.files[0])
                        }
                      />
                    </label>
                  )}

                  {canWrite && (
                    <>
                      <button
                        onClick={() => openEdit(eng)}
                        aria-label={t("organization.audit.editMission", {
                          title: eng.title,
                        })}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(eng.id)}
                        aria-label={t("organization.audit.deleteMission", {
                          title: eng.title,
                        })}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                {eng.lead_auditor && (
                  <span>
                    {t("organization.audit.auditorLabel")}{" "}
                    <span className="font-medium text-foreground">
                      {eng.lead_auditor}
                    </span>
                  </span>
                )}
                <span>
                  {t("organization.audit.priorityLabel")}{" "}
                  <span className="font-mono font-bold text-foreground">
                    {eng.priority_score ?? 0}
                  </span>
                </span>
                <span>
                  {t("organization.audit.findingsLabel")}{" "}
                  <span className="font-mono font-bold text-foreground">
                    {eng.findings_count}
                  </span>
                </span>
                {eng.started_at && (
                  <span>
                    {t("organization.audit.startedLabel")}{" "}
                    <span className="font-medium text-foreground">
                      {formatLocaleDate(eng.started_at, language)}
                    </span>
                  </span>
                )}
                {eng.closed_at && (
                  <span>
                    {t("organization.audit.closedLabel")}{" "}
                    <span className="font-medium text-foreground">
                      {formatLocaleDate(eng.closed_at, language)}
                    </span>
                  </span>
                )}
                {eng.linked_risks && eng.linked_risks.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    {t("organization.audit.linkedRisksLabel")}{" "}
                    {eng.linked_risks.map((risk, i) => (
                      <span key={risk.id} className="flex items-center">
                        <button
                          type="button"
                          // The Risk Register doesn't support deep-linking to a
                          // single risk by id (its filters are local state, not
                          // URL params), so this navigates to the register list
                          // rather than a per-risk detail view that doesn't
                          // exist. See aexa-frontend#165.
                          onClick={() => navigate("/organization/risks")}
                          title={t("organization.audit.openInRegister")}
                          className="font-medium text-primary hover:underline"
                        >
                          {risk.name}
                        </button>
                        {i < eng.linked_risks.length - 1 && (
                          <span className="text-muted-foreground">,</span>
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card p-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && engagements.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              {t("organization.audit.empty")}
            </p>
          </div>
        )}

        {/* Pagination (shown only when the result set spans more than one page) */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              aria-label={t("organization.audit.prevPage")}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>

            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
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
              aria-label={t("organization.audit.nextPage")}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-bold text-foreground">
              {editId
                ? t("organization.audit.editModalTitle")
                : t("organization.audit.newModalTitle")}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.audit.refLabel")}
                </label>
                <input
                  value={form.ref}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ref: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  placeholder={t("organization.audit.refPlaceholder")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.audit.statusLabel")}
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as
                        | "planned"
                        | "in_progress"
                        | "completed",
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="planned">
                    {t("organization.audit.statusPlanned")}
                  </option>
                  <option value="in_progress">
                    {t("organization.audit.statusInProgress")}
                  </option>
                  <option value="completed">
                    {t("organization.audit.statusCompleted")}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t("organization.audit.titleLabel")}
              </label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t("organization.audit.scopeLabel")}
              </label>
              <textarea
                value={form.scope}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scope: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.audit.leadAuditorLabel")}
                </label>
                <input
                  value={form.lead_auditor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lead_auditor: e.target.value }))
                  }
                  autoComplete="name"
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.audit.findingsCountLabel")}
                </label>
                <input
                  type="number"
                  value={form.findings_count}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      findings_count: Number(e.target.value),
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.audit.priorityScoreLabel")}
                </label>
                {/* aexa-frontend#404: priority_score round-trips through the
                    save payload and is displayed on every mission card, but
                    had no input in this modal, so it was silently stuck at
                    the EMPTY_FORM default of 50. Clamp to 0-100 like the
                    displayed range implies (mission card badge). */}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.priority_score}
                  onChange={(e) => {
                    const raw = Number(e.target.value)
                    const clamped = Number.isNaN(raw)
                      ? 0
                      : Math.min(100, Math.max(0, raw))
                    setForm((f) => ({
                      ...f,
                      priority_score: clamped,
                    }))
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.audit.startDateLabel")}
                </label>
                <input
                  type="date"
                  value={form.started_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, started_at: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.audit.endDateLabel")}
                </label>
                <input
                  type="date"
                  value={form.closed_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, closed_at: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t("organization.audit.linkedRisksFieldLabel")}
              </label>
              <div className="mt-1">
                <RiskMultiSelect
                  options={riskOptions}
                  selectedIds={form.riskIds}
                  onChange={(ids) => setForm((f) => ({ ...f, riskIds: ids }))}
                  isLoading={isRisksLoading}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("organization.audit.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={!form.title || isCreating || isUpdating}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                {editId
                  ? t("organization.audit.update")
                  : t("organization.audit.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
