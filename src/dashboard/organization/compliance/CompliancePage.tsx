import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import Pagination from "@/components/shared/Pagination"
import CreateNewFindingModal from "@/dashboard/organization/findings/CreateNewFindingModal"
import { formatDateOnlyForDisplay } from "@/dashboard/organization/findings/dueDateInput"
import AttestConfirmModal from "./AttestConfirmModal"
import AttestHistoryModal from "./AttestHistoryModal"
import ComplianceFormModal from "./ComplianceFormModal"
import ComplianceFrameworkCoverage from "./ComplianceFrameworkCoverage"
import ComplianceObligationRow from "./ComplianceObligationRow"
import ComplianceRiskLinkModal from "./ComplianceRiskLinkModal"
import ComplianceScorecardMatrix from "./ComplianceScorecardMatrix"
import RegulatoryCoverageSuggestions from "./RegulatoryCoverageSuggestions"
import { useComplianceData } from "./useComplianceData"
import type {
  ComplianceMatrixCell,
  ComplianceObligation,
  ComplianceScoreBand,
  SuggestedRegulatorySource,
} from "@/redux/apis/organization/compliance.api"
import {
  useGetComplianceAttestationsQuery,
  useGetComplianceEditHistoryQuery,
  useUnlinkRiskFromObligationMutation,
} from "@/redux/apis/organization/compliance.api"
import type { LineOfDefense } from "@/types/organization"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import { useDebouncedValue } from "@/hooks/Usedebouncedvalue"
import {
  COMPLIANCE_DOMAINS,
  COMPLIANCE_STATUS_KEYS as STATUS_KEYS,
} from "@/utils/complianceConfig"
import { LINE_OF_DEFENSE_LABEL_KEY as LINE_OF_DEFENSE_KEY } from "@/utils/lineOfDefense"
import { SEVERITY_STYLES, severityBadgeClasses } from "@/utils/severityStyles"
import {
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  Plus,
  Scale,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { submitWithToast } from "@/utils/submitWithToast"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

const STATUS_ICONS: Record<string, React.ElementType> = {
  compliant: CheckCircle2,
  in_progress: Clock,
  non_compliant: Ban,
  not_applicable: MinusCircle,
}

const STATUS_BADGE: Record<string, string> = {
  compliant: severityBadgeClasses("low"),
  in_progress: severityBadgeClasses("medium"),
  non_compliant: severityBadgeClasses("critical"),
  not_applicable: "bg-muted text-muted-foreground",
}

// Red/orange/green banding from the scorecard endpoint (CDC 7.7 thresholds).
const BAND_CLASSES: Record<ComplianceScoreBand, string> = {
  green: severityBadgeClasses("low", { border: true }),
  orange: severityBadgeClasses("medium", { border: true }),
  red: severityBadgeClasses("critical", { border: true }),
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
  // Round-3 industry-standards finding: `line_of_defense` was already
  // returned by every /compliance response (Issue #97, DB-defaulted to
  // SECOND) and freely settable through createCompliance/updateCompliance
  // (both accept Partial<ComplianceObligation>, no backend field-strip
  // unlike KRI's update schema) -- just never surfaced anywhere in this
  // UI. Default mirrors the backend's own DB default for a new row.
  line_of_defense: "SECOND" as LineOfDefense,
}

export type ComplianceFormState = typeof EMPTY_FORM

export default function CompliancePage() {
  const { t, i18n } = useTranslation()
  // aexa-frontend#217
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)

  const [filterDomain, setFilterDomain] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  // Round 15 (UX finding, fresh full-panel re-score): `search` was passed
  // straight into the query with no debounce -- every keystroke fired a
  // fresh network request/refetch, unlike RiskRegisterPage/TemplatesPage/
  // SitesEntities/AllFindingsPage/ReportsPage/IntelligencePage, which all
  // already use this same useDebouncedValue convention. The input itself
  // still binds to the raw `search` state below so typing feels instant;
  // only the query arg is debounced.
  const debouncedSearch = useDebouncedValue(search, 300)
  // Same reset-on-debounce-settling convention as RiskRegisterPage's own
  // round-9 fix: resetting page synchronously in handleSearchChange would
  // fire one wasted request for {page:1, searchTerm:<stale value>} before
  // the real debounced request lands 300ms later.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  // Filtering, searching and pagination are all applied server-side (the
  // /compliance list endpoint supports searchTerm / status / domain + page /
  // limit), so results are never silently capped at the first page. See
  // useComplianceData.ts for the data-fetching/mutation layer this page
  // hands its filter/pagination UI state into.
  const {
    obligations,
    meta,
    totalPages,
    isLoading,
    complianceError,
    scorecard,
    scorecardError,
    sites,
    sitesError,
    ownerSuggestions,
    createCompliance,
    isCreating,
    updateCompliance,
    isUpdating,
    deleteCompliance,
    attestCompliance,
    isAttesting,
  } = useComplianceData({
    page,
    limit: PAGE_SIZE,
    searchTerm: debouncedSearch,
    status: filterStatus || undefined,
    domain: filterDomain || undefined,
  })

  // aexa-frontend#265: deleting the last obligation on the last page shrinks
  // totalPages without a filter change (handleDomainChange/handleStatusChange
  // below only reset page on filter changes, and handleSearchChange no
  // longer does either -- see the debouncedSearch effect above), stranding
  // the user on an out-of-range empty page. Delete-path counterpart to
  // #234/#243.
  useClampPageToTotal(page, totalPages, setPage)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Round 17 (code quality finding, fresh full-panel re-score): this used
  // to be three independent `useState<ComplianceObligation | null>` --
  // actionObligation/attestObligation/historyObligation -- each backing
  // its own always-mounted-when-set overlay, with every opener hand-
  // rolling its own "null out the other two" boilerplate (see the
  // round-11-derived comment that used to live here) to stop a user
  // stacking two modals at once. A single discriminated union collapses
  // all three into one state: opening any modal is inherently exclusive
  // (setting a new value replaces the old one), so the "clear the other
  // two" logic simply no longer exists to write.
  type ActiveModal =
    | { type: "action"; obligation: ComplianceObligation }
    | { type: "attest"; obligation: ComplianceObligation }
    | { type: "history"; obligation: ComplianceObligation }
    // aexa-server#346: obligation <-> risk linking modal (create-new /
    // link-existing tabs). Slots into the same exclusive-modal union as
    // its three siblings above.
    | { type: "riskLink"; obligation: ComplianceObligation }
    | null
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [attestNote, setAttestNote] = useState("")
  const [unlinkRiskFromObligation] = useUnlinkRiskFromObligationMutation()

  // aexa-server#250 -- the obligation currently open in the re-attest
  // confirm dialog / attestation history modal, respectively. Derived from
  // activeModal rather than separate state now, but still named the same
  // as the RTK Query hooks/JSX below that read them.
  const attestObligation =
    activeModal?.type === "attest" ? activeModal.obligation : null
  const historyObligation =
    activeModal?.type === "history" ? activeModal.obligation : null
  const actionObligation =
    activeModal?.type === "action" ? activeModal.obligation : null
  const riskLinkObligation =
    activeModal?.type === "riskLink" ? activeModal.obligation : null

  // Round-11 review: attestObligation/historyObligation are two of three
  // sibling-exclusive modals above, each mounting its own useModalA11y()
  // instance (now inside AttestConfirmModal/AttestHistoryModal
  // respectively). Switching activeModal directly from one to the other
  // (e.g. Re-attest -> History without closing) still unmounts one
  // component and mounts the other in the same commit -- cleanup always
  // runs before setup, so the closing modal's cleanup (useModalA11y.ts
  // returning focus to ITS OWN trigger) would steal document.activeElement
  // away from the just-clicked button before the opening modal's setup
  // captures it as its own trigger. Without this ref, closing the newly
  // opened modal would return focus to the OTHER modal's trigger button
  // instead of the one actually clicked. pendingFocusRef captures the real
  // trigger synchronously in each row button's onClick (before
  // setActiveModal runs); this single effect (one instead of the former
  // two, since there's now one state instead of two) runs after the
  // children (and their useModalA11y hooks) mount/unmount in the same
  // commit, letting this correction win. Only attest/history participate
  // -- the action modal (CreateNewFindingModal) never used this
  // convention, so it's excluded here exactly as it always was.
  const pendingFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (activeModal?.type !== "attest" && activeModal?.type !== "history") {
      return
    }
    const trigger = pendingFocusRef.current
    return () => {
      trigger?.focus()
    }
  }, [activeModal])
  // Only fetched while the history modal is actually open for a given
  // obligation (skip otherwise), same idle-until-opened convention as the
  // reused CreateNewFindingModal below.
  // Round 4 (code quality finding): isError was previously discarded here
  // too -- a fetch failure fell through to the same "no history yet" empty
  // state a genuinely never-attested obligation renders, indistinguishable
  // from a real outage.
  const {
    data: attestationsData,
    isLoading: isLoadingAttestations,
    isError: attestationsError,
  } = useGetComplianceAttestationsQuery(
    { id: historyObligation?.id ?? "", page: 1, limit: 20 },
    { skip: !historyObligation }
  )
  // Quality-bar-loop industry-standards gap: fetched alongside attestations
  // (same skip-until-open convention), backing the history modal's second
  // "Edit History" tab.
  const {
    data: editHistoryData,
    isLoading: isLoadingEditHistory,
    isError: editHistoryError,
  } = useGetComplianceEditHistoryQuery(
    { id: historyObligation?.id ?? "", page: 1, limit: 20 },
    { skip: !historyObligation }
  )

  // Changing any filter resets to page 1 so the user never lands on an
  // out-of-range page for the newly-filtered result set. Search's own page
  // reset happens in the debouncedSearch effect above instead of here --
  // resetting synchronously on every keystroke would race the debounce (see
  // that effect's own comment).
  const handleSearchChange = (value: string) => {
    setSearch(value)
  }
  const handleDomainChange = (value: string) => {
    setFilterDomain(value)
    setPage(1)
  }
  const handleStatusChange = (value: string) => {
    setFilterStatus(value)
    setPage(1)
  }

  // Domain/status labels are echoed as raw keys until i18n initializes (tests),
  // and translated in the running app — same t() convention as RiskRegisterPage.
  const domainLabel = (key: string) =>
    COMPLIANCE_DOMAINS[key] ? t(`organization.compliance.domains.${key}`) : key
  const statusLabel = (key: string) =>
    STATUS_ICONS[key] ? t(`organization.compliance.status.${key}`) : key

  // Round 9 (efficiency finding): `sites.find(...)` re-scanned the full
  // site list for every siteName() call -- called once per matrix row
  // (site x domain grid) plus once per edit-history site_id diff entry,
  // so a page with several sites and a long edit history re-scanned
  // repeatedly on every render. Indexed once, same pattern as
  // `risksById`/`sitesById`-style maps already used elsewhere in this
  // session (e.g. KRI's own risksById).
  const sitesById = useMemo(
    () => new Map(sites.map((s) => [s.id, s])),
    [sites]
  )
  const siteName = (siteId: string | null) =>
    siteId ? (sitesById.get(siteId)?.name ?? siteId) : null

  // Quality-bar-loop industry-standards gap: label helpers for the edit-
  // history tab's field-level diffs. site_id renders through siteName (same
  // resolver the rest of the page already uses) rather than a raw UUID;
  // domain/status/line_of_defense go through the page's own existing label
  // helpers so the same translated vocabulary is used everywhere on this
  // page, not a second parallel one.
  const editHistoryFieldLabel = (field: string) =>
    t(`organization.compliance.editHistory.field.${field}`, field)

  const editHistoryValueLabel = (field: string, value: unknown): string => {
    if (value === null || value === undefined || value === "") {
      return t("organization.compliance.editHistory.emptyValue")
    }
    if (field === "due_date") {
      return formatDateOnlyForDisplay(String(value), i18n.language)
    }
    if (field === "domain") return domainLabel(String(value))
    if (field === "status") return statusLabel(String(value))
    if (field === "site_id") return siteName(String(value)) ?? String(value)
    if (field === "line_of_defense") {
      return t(LINE_OF_DEFENSE_KEY[value as LineOfDefense] ?? String(value))
    }
    return String(value)
  }

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
      recurrence:
        obl.recurrence && obl.recurrence !== "one_time" ? obl.recurrence : "",
      line_of_defense: obl.line_of_defense,
    })
    setShowForm(true)
  }

  // aexa-frontend#939: pre-fills the create form from an AI-suggested
  // regulatory source rather than creating an obligation directly -- same
  // "review before it becomes real data" principle as RiskFormModal's AI
  // pre-fill, just applied to a brand-new record instead of an existing
  // one's fields. The suggestion's rationale is folded into the
  // description as context for whoever reviews/edits before saving, since
  // there's no dedicated field to keep it in once this becomes a real
  // ComplianceObligation.
  const openFromSuggestion = (
    siteId: string,
    suggestion: SuggestedRegulatorySource
  ) => {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      title: suggestion.name,
      description: suggestion.rationale,
      domain: suggestion.domain,
      site_id: siteId,
      regulation_reference: suggestion.name,
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
      // Round 4 (industry-standards finding): unlike site_id above (a real
      // FK column, where NULL is the correct "no site" value), the CREATE
      // schema types these as `z.string().optional()` -- `string |
      // undefined`, not `string | null`. Sending `null` for an empty field
      // failed validation with "expected string, received null", breaking
      // the minimal-field create path (Title only) any reference
      // obligation-tracker supports. `undefined` here is safe specifically
      // because CREATE has no existing value that could need clearing.
      regulation_reference: form.regulation_reference || undefined,
      recurrence: form.recurrence || undefined,
      line_of_defense: form.line_of_defense,
    }

    await submitWithToast(
      () =>
        editingId
          ? updateCompliance({
              id: editingId,
              data: {
                ...payload,
                // Round-1 review of PR #859: `undefined` above is wrong for
                // UPDATE specifically -- RTK Query's fetchBaseQuery
                // JSON.stringifies the body, which drops `undefined` keys
                // entirely, and Prisma treats an absent key as "leave this
                // column unchanged," not "clear it." `null` on UPDATE
                // correctly clears these fields now that
                // update_compliance's schema explicitly accepts null for
                // regulation_reference/recurrence, matching site_id's own
                // three-way undefined/null/string handling (see
                // compliance.validation.ts, aexa-server). Before that
                // backend fix, this same `null` -- which the form always
                // resends on every save, not just when actively clearing a
                // value -- 400'd any edit to an obligation whose
                // regulation_reference/recurrence were already blank, not
                // just an attempt to clear a previously-set one. Found
                // live-verifying feat/compliance-edit-history-ui.
                regulation_reference: form.regulation_reference || null,
                recurrence: form.recurrence || null,
                // Mark as human-edited so the SourceBadge reflects the
                // change, matching the prior local-state behaviour.
                is_edited: true,
              },
            }).unwrap()
          : createCompliance(payload).unwrap(),
      editingId
        ? t("organization.compliance.toast.updateSuccess")
        : t("organization.compliance.toast.createSuccess"),
      t("organization.compliance.toast.saveFailed"),
      () => {
        setShowForm(false)
        setForm(EMPTY_FORM)
      }
    )
  }

  const handleDelete = (id: string) => {
    setDeleteTargetId(id)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return
    setIsDeleting(true)
    await submitWithToast(
      () => deleteCompliance(deleteTargetId).unwrap(),
      t("organization.compliance.toast.deleteSuccess"),
      t("organization.compliance.toast.deleteFailed"),
      () => setDeleteTargetId(null)
    )
    setIsDeleting(false)
  }

  // Opening any one modal is inherently exclusive now -- setting
  // activeModal to a new variant replaces whichever was open before, so
  // there's no "clear the other two" step left to write (a user stacking
  // Re-attest on one row then History on another can no longer leave a
  // stale dialog hidden underneath, the same guarantee the old three-state
  // version had to hand-roll on every opener).
  const openCreateAction = (obl: ComplianceObligation) => {
    setActiveModal({ type: "action", obligation: obl })
  }

  const openRiskLink = (obl: ComplianceObligation) => {
    setActiveModal({ type: "riskLink", obligation: obl })
  }

  const handleUnlinkRisk = async (obl: ComplianceObligation) => {
    await submitWithToast(
      () => unlinkRiskFromObligation(obl.id).unwrap(),
      t("organization.compliance.riskLink.toast.unlinkSuccess"),
      t("organization.compliance.riskLink.toast.unlinkFailed")
    )
  }

  const openAttest = (obl: ComplianceObligation, trigger: HTMLElement) => {
    pendingFocusRef.current = trigger
    setActiveModal({ type: "attest", obligation: obl })
    setAttestNote("")
  }

  const openHistory = (obl: ComplianceObligation, trigger: HTMLElement) => {
    pendingFocusRef.current = trigger
    setActiveModal({ type: "history", obligation: obl })
  }

  const confirmAttest = async () => {
    if (!attestObligation) return
    await submitWithToast(
      () =>
        attestCompliance({
          id: attestObligation.id,
          note: attestNote.trim() || undefined,
        }).unwrap(),
      t("organization.compliance.toast.attestSuccess"),
      t("organization.compliance.toast.attestFailed"),
      () => {
        setActiveModal(null)
        setAttestNote("")
      }
    )
  }

  // Whole-org counts come from the scorecard's statusCounts, so they stay
  // correct now that the list is server-side paginated (the current page is no
  // longer the whole dataset). Fall back to counting the loaded page only for
  // the legitimate "older response without statusCounts" case -- NOT during a
  // genuine scorecardError, where that fallback would silently display a
  // page-scoped count under a "whole-org" label with no indication anything
  // failed. `null` here means "don't know," rendered as "--" below, distinct
  // from a real 0.
  const statusCounts = scorecard?.statusCounts
  const compliantCount = scorecardError
    ? null
    : (statusCounts?.compliant ??
      obligations.filter((o) => o.status === "compliant").length)
  const nonCompliantCount = scorecardError
    ? null
    : (statusCounts?.non_compliant ??
      obligations.filter((o) => o.status === "non_compliant").length)
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
  // Round 9 (efficiency finding): `cellFor` did a linear `.find()` over
  // `scorecard.matrix` inside a nested site x domain map below -- O(sites
  // x domains x matrix.length) per render. Indexed once into a Map keyed
  // by the exact same "__org__"-for-org-wide convention the render loop
  // already uses, so cell lookup drops to O(1) per cell.
  const matrixByKey = useMemo(() => {
    const map = new Map<string, ComplianceMatrixCell>()
    for (const m of scorecard?.matrix ?? []) {
      map.set(`${m.site_id ?? "__org__"}|${m.domain}`, m)
    }
    return map
  }, [scorecard])
  const cellFor = (siteKey: string, domain: string) =>
    matrixByKey.get(`${siteKey}|${domain}`)

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="animate-fade-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {t("organization.compliance.title")}
          </h1>
          <p
            className={
              complianceError
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {/* quality-bar-loop-derived fix: totalCount falls back to
                obligations.length (0) whenever complianceData is undefined --
                true during both the loading and error states -- so this
                line used to claim "0 obligations tracked" at the exact
                moment the table below correctly showed a loading spinner or
                (after this same fix) a distinct error row. Mirrors
                RiskRegisterPage's identical subtitle fix (aexa-frontend#618). */}
            {isLoading
              ? t("organization.compliance.loading")
              : complianceError
                ? t("organization.compliance.loadError")
                : t("organization.compliance.subtitle", {
                    count: totalCount,
                  })}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="focus-ring flex h-11 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"
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
            aria-label={t("organization.compliance.searchLabel")}
            className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-3 text-xs"
          />
        </div>
        <select
          value={filterDomain}
          onChange={(e) => handleDomainChange(e.target.value)}
          aria-label={t("organization.compliance.domainFilterLabel")}
          className="h-11 rounded-lg border border-input bg-card px-3 text-xs"
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
          aria-label={t("organization.compliance.statusFilterLabel")}
          className="h-11 rounded-lg border border-input bg-card px-3 text-xs"
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
      {scorecardError && (
        <p role="alert" className="text-sm text-destructive">
          {t("organization.compliance.scorecard.loadError")}
        </p>
      )}
      <div className="animate-slide-up grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-risk-low/30 bg-risk-low/5 p-3 lg:p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`h-5 w-5 ${SEVERITY_STYLES.low.text}`} />
            <span
              className={`font-mono-data text-xl font-bold lg:text-2xl ${SEVERITY_STYLES.low.text}`}
            >
              {compliantCount ?? "—"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("organization.compliance.card.compliant")}
          </p>
        </div>
        <div className="rounded-xl border border-risk-critical/30 bg-risk-critical/5 p-3 lg:p-4">
          <div className="flex items-center gap-2">
            <Ban className={`h-5 w-5 ${SEVERITY_STYLES.critical.text}`} />
            <span
              className={`font-mono-data text-xl font-bold lg:text-2xl ${SEVERITY_STYLES.critical.text}`}
            >
              {nonCompliantCount ?? "—"}
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

      <ComplianceFrameworkCoverage obligations={obligations} />

      <RegulatoryCoverageSuggestions
        sites={sites}
        sitesError={sitesError}
        domainLabel={domainLabel}
        onAddSuggestion={openFromSuggestion}
      />

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
        <ComplianceScorecardMatrix
          scorecard={scorecard}
          scorecardError={scorecardError}
          matrixDomains={matrixDomains}
          matrixSiteKeys={matrixSiteKeys}
          cellFor={cellFor}
          domainLabel={domainLabel}
          siteName={siteName}
          bandClasses={BAND_CLASSES}
        />
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
              {/* Review finding on the actions-column overlap fix: this
                  header's own w-16 was already moot (a table column's
                  rendered width is the max across every cell in it, and
                  the body's min-w-[180px] always wins), but leaving a
                  stale, contradicting width here invited confusion for
                  the next reader. min-w-[180px] mirrors the body cell so
                  the header and body agree on what this column asks for. */}
              <th className="min-w-[180px] px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {/* quality-bar-loop round (Compliance resilience, fresh-panel
                finding): this used to render `obligations.map(...)`
                unconditionally, regardless of complianceError -- RTK
                Query correctly retains the last-successful `data` through
                a failed refetch (e.g. changing the domain filter while
                the endpoint is down), so a fetch failure rendered the
                error block below AT THE SAME TIME as a full table of
                rows from the OLD filter, with nothing distinguishing
                "these rows are current" from "these rows are stale and
                don't even match your current filter." Live-reproduced:
                switching the domain filter mid-outage kept showing the
                previous domain's rows next to "Failed to load
                obligations." Gating on !complianceError makes the error
                state fully replace stale content instead of layering
                under it, matching the empty-state block's own
                !complianceError gate just below. */}
            {!complianceError &&
              obligations.map((obl) => (
                <ComplianceObligationRow
                  key={obl.id}
                  obligation={obl}
                  canWrite={canWrite}
                  domainLabel={domainLabel}
                  statusLabel={statusLabel}
                  statusIcons={STATUS_ICONS}
                  statusBadgeClass={STATUS_BADGE}
                  onEdit={openEdit}
                  onAttest={openAttest}
                  onHistory={openHistory}
                  onDelete={handleDelete}
                  onCreateAction={openCreateAction}
                  onLinkRisk={openRiskLink}
                  onUnlinkRisk={handleUnlinkRisk}
                />
              ))}
          </tbody>
        </table>

        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2
              role="status"
              aria-live="polite"
              className="h-5 w-5 animate-spin text-muted-foreground"
            />
            <span className="sr-only">
              {t("organization.compliance.loading")}
            </span>
          </div>
        )}

        {/* quality-bar-loop-derived fix: this table had no error row at all
            -- a fetch failure and "the filter matched zero obligations"
            both previously rendered the exact same silent empty-state
            below, indistinguishable from each other. */}
        {!isLoading && complianceError && (
          <div className="flex flex-col items-center py-16 text-center">
            <Scale className="mb-3 h-10 w-10 text-destructive/40" />
            <p role="alert" className="text-destructive">
              {t("organization.compliance.loadError")}
            </p>
          </div>
        )}

        {!isLoading && !complianceError && obligations.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
            <Scale className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p>{t("organization.compliance.empty")}</p>
          </div>
        )}
      </div>

      {/* Pagination — server-side; hidden when everything fits on one page. */}
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        prevAriaLabel={t("organization.compliance.pagination.previous")}
        nextAriaLabel={t("organization.compliance.pagination.next")}
      />

      {showForm && (
        <ComplianceFormModal
          form={form}
          setForm={setForm}
          editingId={editingId}
          editingNextReviewDate={
            editingId
              ? (obligations.find((o) => o.id === editingId)?.next_review_date ??
                null)
              : null
          }
          sites={sites}
          sitesError={sitesError}
          ownerSuggestions={ownerSuggestions}
          uploading={uploading}
          onUploadAttachment={uploadAttachment}
          onRemoveAttachment={removeAttachment}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          isSaving={isCreating || isUpdating}
          domainLabel={domainLabel}
          statusLabel={statusLabel}
        />
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
          onClose={() => setActiveModal(null)}
          additionalData={{
            actionTitle: `Remediate: ${actionObligation.title}`,
            actionDisc: actionObligation.description
              ? `Remediation action for non-compliant obligation "${actionObligation.title}": ${actionObligation.description}`
              : `Remediation action for non-compliant obligation "${actionObligation.title}".`,
            complianceObligationId: actionObligation.id,
          }}
        />
      )}

      {riskLinkObligation && (
        <ComplianceRiskLinkModal
          obligation={riskLinkObligation}
          onClose={() => setActiveModal(null)}
        />
      )}

      {attestObligation && (
        <AttestConfirmModal
          obligation={attestObligation}
          note={attestNote}
          onNoteChange={setAttestNote}
          onClose={() => setActiveModal(null)}
          onConfirm={confirmAttest}
          isSubmitting={isAttesting}
        />
      )}

      {historyObligation && (
        <AttestHistoryModal
          obligation={historyObligation}
          onClose={() => setActiveModal(null)}
          entries={attestationsData?.data ?? []}
          isLoading={isLoadingAttestations}
          isError={attestationsError}
          statusLabel={statusLabel}
          statusBadgeClass={(key) =>
            STATUS_BADGE[key] || "bg-muted text-muted-foreground"
          }
          editEntries={editHistoryData?.data ?? []}
          isLoadingEditHistory={isLoadingEditHistory}
          isErrorEditHistory={editHistoryError}
          editFieldLabel={editHistoryFieldLabel}
          editValueLabel={editHistoryValueLabel}
        />
      )}

      <DeleteAlertModal
        open={!!deleteTargetId}
        setOpen={(open) => !open && setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title={t("organization.compliance.deleteConfirm")}
      />
    </div>
  )
}
