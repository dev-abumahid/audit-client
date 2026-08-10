import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import Pagination from "@/components/shared/Pagination"
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
import { useModalA11y } from "@/hooks/useModalA11y"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import { useGetAllOrgUsersQuery } from "@/redux/apis/organization/org.user.api"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import {
  AlertTriangle,
  CheckCircle2,
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
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { formatLocaleDate } from "@/utils/formatDate"
import { SEVERITY_STYLES } from "@/utils/severityStyles"
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

  // quality-bar-loop round 3 (resilience, round-1 finding): isError was
  // previously omitted, so a failed fetch fell back to `[]` and rendered
  // the "no audit engagements found" empty state -- silently
  // misrepresenting a fetch failure as "this org has zero engagements",
  // same bug class fixed on 2 sibling pages this session.
  const {
    data: auditData,
    isLoading,
    isError,
    refetch,
  } = useGetAllAuditEngagementsQuery({
    page,
    limit: PAGE_SIZE,
    searchTerm: search,
  })

  useEffect(() => {
    if (isError) {
      toast.error(t("organization.audit.loadFailed"))
    }
  }, [isError, t])

  // All org risks, for the linked-risks picker. Fetched once here (not per-row)
  // so the create/edit modal can offer a real multi-select of actual Risk
  // records instead of the old free-text tag input (aexa-frontend#165).
  // isError surfaced as a small inline notice below the picker (round 3,
  // resilience) -- non-fatal, since the rest of the create/edit form is
  // still usable without linked risks.
  const {
    data: risksData,
    isLoading: isRisksLoading,
    isError: isRisksError,
  } = useGetAllRisksQuery({
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

  // quality-bar-loop round 6 (industry-standards, round-1 finding):
  // lead_auditor is a plain `string | null` on the backend (no Account
  // relation to migrate to without a schema change, out of scope for a
  // frontend-only fix), so a full picker isn't possible -- but a free-
  // text input alone silently let "Jane Kimura" and "J. Kimura" fragment
  // the same person across engagements, with no way to filter/report by
  // a canonical identity. A <datalist>-backed autocomplete keeps free
  // text entry working (still needed for external auditors, or an
  // already-recorded name that predates this change) while surfacing
  // real org member names as suggestions, nudging toward the same
  // spelling every time without breaking existing data.
  const { data: orgUsersData } = useGetAllOrgUsersQuery(undefined)
  const leadAuditorSuggestions = Array.from(
    new Set(
      (orgUsersData?.data ?? [])
        .map((m) => m.account?.profile?.fullName || m.account?.email)
        .filter((name): name is string => !!name)
    )
  )

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

  const STATUS_CONFIG: Record<
    string,
    { label: string; bg: string; text: string }
  > = {
    planned: {
      label: t("organization.audit.statusPlanned"),
      bg: SEVERITY_STYLES.info.bg,
      text: SEVERITY_STYLES.info.text,
    },
    in_progress: {
      label: t("organization.audit.statusInProgress"),
      bg: SEVERITY_STYLES.medium.bg,
      text: SEVERITY_STYLES.medium.text,
    },
    completed: {
      label: t("organization.audit.statusCompleted"),
      bg: SEVERITY_STYLES.low.bg,
      text: SEVERITY_STYLES.low.text,
    },
  }

  const closeAuditModal = () => {
    setShowModal(false)
  }

  const auditModalRef = useModalA11y(showModal, closeAuditModal)

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
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {t("organization.audit.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.audit.subtitle")}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openCreate}
            // quality-bar-loop round 2 (mobile, round-1 finding): 44px
            // touch target, same fix pattern shipped on 7 sibling pages
            // this session.
            className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> {t("organization.audit.newMission")}
          </button>
        )}
      </div>

      {/* Summary Stats */}
      {/* quality-bar-loop round 2 (mobile, round-1 finding): the 4-card
          stats row had no wrap and overflowed the 375px viewport with the
          4th card clipped off-screen. flex-wrap lets cards drop to a new
          line instead. */}
      <div className="animate-slide-up flex flex-wrap gap-4 text-xs">
        <div className="rounded-lg border border-border bg-card px-4 py-2.5">
          <span className="font-mono text-lg font-bold text-foreground">
            {totalCount}
          </span>
          <span className="ml-2 text-muted-foreground">
            {t("organization.audit.statTotal")}
          </span>
        </div>
        {/* quality-bar-loop round 5 (visual polish, round-1 finding):
            these stat cards previously hand-rolled their own
            orange-500/green-500 colors at a different opacity tier than
            the status badges below (which already route through
            SEVERITY_STYLES) -- same underlying concept (in_progress ->
            medium, completed -> low), rendered in two different color
            systems on one page. Now shares the same source as
            STATUS_CONFIG. */}
        <div
          className={`rounded-lg border px-4 py-2.5 ${SEVERITY_STYLES.medium.border} ${SEVERITY_STYLES.medium.bg}`}
        >
          <span
            className={`font-mono text-lg font-bold ${SEVERITY_STYLES.medium.text}`}
          >
            {inProgressCount}
          </span>
          <PageScopedStatLabel label={t("organization.audit.statInProgress")} />
        </div>
        <div
          className={`rounded-lg border px-4 py-2.5 ${SEVERITY_STYLES.low.border} ${SEVERITY_STYLES.low.bg}`}
        >
          <span
            className={`font-mono text-lg font-bold ${SEVERITY_STYLES.low.text}`}
          >
            {completedCount}
          </span>
          <PageScopedStatLabel label={t("organization.audit.statCompleted")} />
        </div>
        {/* Review round 1 (angle A) on PR #669: left on the plain
            --destructive token rather than SEVERITY_STYLES.critical --
            unlike In Progress/Completed, this stat has no STATUS_CONFIG
            anchor (it's a raw count, not a status), and painting a
            findings count "critical" red regardless of whether it's 0
            or 50 would misrepresent a genuinely good "0 findings" state
            as the most alarming color in the palette. --destructive was
            already a real shared design token, not a hand-rolled color
            -- round 1's finding was about the OTHER 3 elements' colors,
            not this one. */}
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
          className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-xs"
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
              {/* quality-bar-loop round 2 (mobile, round-1 finding): at
                  375px the actions cluster (Report/Edit/Delete) measured
                  386.85px against a 375px viewport with no wrap -- the
                  Delete button was clipped off-screen entirely, not just
                  undersized. flex-wrap plus min-w-0 on the left block (so
                  the ref/title/badges can shrink) lets the actions
                  cluster drop to its own line instead of overflowing.
                  Deliberately NOT using `justify-between` here: per the
                  flexbox spec, `space-between` degrades to `flex-start`
                  once a line holds only one item, which would left-align
                  the actions cluster the moment it wraps to its own row.
                  `ml-auto` on the actions cluster (below) keeps it
                  right-aligned whether it shares the row with the left
                  block or wraps onto its own -- review round 1 finding. */}
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${statusCfg.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${statusCfg.text}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-data text-xs font-bold text-muted-foreground">
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
                    <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">
                      {eng.title}
                    </h3>
                    {eng.scope && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {eng.scope}
                      </p>
                    )}
                  </div>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {/* quality-bar-loop round 2 (mobile, round-1 finding):
                      44px touch targets -- text/icon+text buttons get
                      `h-11 items-center` (width stays content-driven),
                      icon-only buttons get `h-11 w-11 shrink-0`, same
                      pattern shipped on 7 sibling pages this session. */}
                  {hasReport ? (
                    // quality-bar-loop round 5 (visual polish, round-1
                    // finding): was a third distinct hand-rolled green
                    // token (bg-green-500/10 + text-green-600), different
                    // from both the stat cards above and the shared
                    // SEVERITY_STYLES.low used everywhere else on this
                    // page now.
                    <button
                      onClick={() => handleDownloadReport(eng.report_url!)}
                      className={`flex h-11 items-center gap-1 rounded-md px-2 text-[10px] font-medium hover:opacity-80 ${SEVERITY_STYLES.low.bg} ${SEVERITY_STYLES.low.text}`}
                    >
                      <FileText className="h-3 w-3" />{" "}
                      {t("organization.audit.report")}{" "}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  ) : (
                    <label className="flex h-11 cursor-pointer items-center gap-1 rounded-md bg-muted px-2 text-[10px] font-medium text-muted-foreground hover:bg-muted/80">
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
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(eng.id)}
                        aria-label={t("organization.audit.deleteMission", {
                          title: eng.title,
                        })}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
                          // aexa-frontend#529: Risk now has a real per-risk
                          // detail page -- this used to navigate to the
                          // whole register list (see #165) since no
                          // per-risk route existed.
                          onClick={() =>
                            navigate(`/organization/risks/${risk.id}`)
                          }
                          title={t("organization.audit.viewRiskDetails")}
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

        {!isLoading && isError && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-12 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p role="alert" className="text-sm text-destructive">
              {t("organization.audit.loadFailed")}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="flex h-11 items-center rounded-md border border-destructive/30 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              {t("organization.audit.retry")}
            </button>
          </div>
        )}

        {!isLoading && !isError && engagements.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              {t("organization.audit.empty")}
            </p>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          prevAriaLabel={t("organization.audit.prevPage")}
          nextAriaLabel={t("organization.audit.nextPage")}
          className="mt-6"
        />
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            ref={auditModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
            className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <h2 id="audit-modal-title" className="text-lg font-bold text-foreground">
              {editId
                ? t("organization.audit.editModalTitle")
                : t("organization.audit.newModalTitle")}
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="audit-modal-ref"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.audit.refLabel")}
                </label>
                <input
                  id="audit-modal-ref"
                  value={form.ref}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ref: e.target.value }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  placeholder={t("organization.audit.refPlaceholder")}
                />
              </div>
              <div>
                <label
                  htmlFor="audit-modal-status"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.audit.statusLabel")}
                </label>
                <select
                  id="audit-modal-status"
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
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
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
              <label
                htmlFor="audit-modal-title-field"
                className="text-xs font-medium text-muted-foreground"
              >
                {t("organization.audit.titleLabel")}
              </label>
              <input
                id="audit-modal-title-field"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="audit-modal-scope"
                className="text-xs font-medium text-muted-foreground"
              >
                {t("organization.audit.scopeLabel")}
              </label>
              <textarea
                id="audit-modal-scope"
                value={form.scope}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scope: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="audit-modal-lead-auditor"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.audit.leadAuditorLabel")}
                </label>
                <input
                  id="audit-modal-lead-auditor"
                  value={form.lead_auditor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lead_auditor: e.target.value }))
                  }
                  autoComplete="name"
                  list="audit-modal-lead-auditor-suggestions"
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
                <datalist id="audit-modal-lead-auditor-suggestions">
                  {leadAuditorSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label
                  htmlFor="audit-modal-findings-count"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.audit.findingsCountLabel")}
                </label>
                <input
                  id="audit-modal-findings-count"
                  type="number"
                  value={form.findings_count}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      findings_count: Number(e.target.value),
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="audit-modal-priority-score"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.audit.priorityScoreLabel")}
                </label>
                {/* aexa-frontend#404: priority_score round-trips through the
                    save payload and is displayed on every mission card, but
                    had no input in this modal, so it was silently stuck at
                    the EMPTY_FORM default of 50. Clamp to 0-100 like the
                    displayed range implies (mission card badge). */}
                <input
                  id="audit-modal-priority-score"
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
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="audit-modal-start-date"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.audit.startDateLabel")}
                </label>
                <input
                  id="audit-modal-start-date"
                  type="date"
                  value={form.started_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, started_at: e.target.value }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="audit-modal-end-date"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.audit.endDateLabel")}
                </label>
                <input
                  id="audit-modal-end-date"
                  type="date"
                  value={form.closed_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, closed_at: e.target.value }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <div>
              {/* quality-bar-loop round 4 (accessibility, round-1 finding):
                  `id`, not `htmlFor` -- <button> is a labelable HTML
                  element, so a real `<label for>` association would
                  REPLACE the trigger's accessible name with this static
                  text, discarding its dynamic "N risks linked" state
                  (caught live via 2 breaking tests). `labelId` below
                  combines this id with the trigger's own text via
                  aria-labelledby instead, preserving both. */}
              <label
                id="audit-modal-linked-risks-label"
                className="text-xs font-medium text-muted-foreground"
              >
                {t("organization.audit.linkedRisksFieldLabel")}
              </label>
              <div className="mt-1">
                <RiskMultiSelect
                  labelId="audit-modal-linked-risks-label"
                  options={riskOptions}
                  selectedIds={form.riskIds}
                  onChange={(ids) => setForm((f) => ({ ...f, riskIds: ids }))}
                  isLoading={isRisksLoading}
                />
                {/* quality-bar-loop round 3 (resilience, round-1 finding):
                    non-fatal -- the rest of the form is still usable, but
                    a failed fetch previously rendered identically to "this
                    org genuinely has no risks yet" with no indication the
                    list is actually incomplete. */}
                {isRisksError && (
                  <p role="alert" className="mt-1 text-[11px] text-destructive">
                    {t("organization.audit.riskOptionsLoadFailed")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeAuditModal}
                className="flex h-11 items-center rounded-lg px-4 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("organization.audit.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={!form.title || isCreating || isUpdating}
                className="flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
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
