/* eslint-disable @typescript-eslint/no-explicit-any */
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import FilteredByNotice from "@/components/shared/FilteredByNotice"
import Pagination from "@/components/shared/Pagination"
import {
  useCreateNewRiskMutation,
  useDeleteRiskMutation,
  useGetAllRisksQuery,
  useUpdateRiskMutation,
} from "@/redux/apis/organization/risk.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import { useModalA11y } from "@/hooks/useModalA11y"
import type { Risk, SiteSummary } from "@/types/organization"
import { removeNulls } from "@/utils/removeNulls"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import { severityBadgeClasses } from "@/utils/severityStyles"
import RiskApprovalControls from "./RiskApprovalControls"
import RiskOverrideBadge from "./RiskOverrideBadge"
import { Bot, Building2, Clock, Loader, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import type { SubmitHandler } from "react-hook-form"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"

const EMPTY_RISK: Partial<Risk> = {
  name: "",
  description: "",
  category: "",
  inherent_score: 0,
  inherent_is_override: false,
  inherent_override_reason: "",
  residual_score: 0,
  residual_is_override: false,
  residual_override_reason: "",
  pagerank_score: 0,
  financial_impact_min: 0,
  financial_impact_max: 0,
  probability: 0,
  velocity: "",
  trend: "",
  status: "",
  source_info: "",
  control_design_eff: 0,
  control_operating_eff: 0,
  site_id: "",
}

export default function RiskRegisterPage() {
  const { t } = useTranslation()
  // aexa-frontend#217 -- base CRUD had no client-side role gating at all;
  // a VIEWER/LIGHT_USER saw the same Create/Edit/Delete affordances as an
  // ADMIN and only found out they couldn't act via a 403 toast.
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)
  const [searchParams] = useSearchParams()
  const [filterCat, setFilterCat] = useState("")
  const [search, setSearch] = useState("")
  const [siteFilter, setSiteFilter] = useState<string>("")
  // quality-bar-loop round 2 (industry-standards/efficiency): page/limit
  // were previously hardcoded to page:1/limit:100, so any org with more than
  // 100 risks silently lost every row past the 100th with no indication --
  // same PAGE_SIZE/useClampPageToTotal convention as AuditPage/TemplatesPage.
  const PAGE_SIZE = 20
  const [page, setPage] = useState(1)
  // "Pending my approval" quick-view (#163): narrows the list to risks whose
  // current approval cycle is live PENDING_APPROVAL, so an admin can find what
  // is awaiting sign-off without eyeballing every row's badge. Client-side —
  // approvalStatus is already on each row from GET /risk, so no extra query.
  const [pendingApprovalOnly, setPendingApprovalOnly] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteRiskId, setDeleteRiskId] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // aexa-frontend#488 -- role="dialog"/focus-trap/Escape for the Add/Edit
  // Risk modal, same pattern KriDashboardPage uses (round 10, #487).
  const addEditModalRef = useModalA11y(showModal, () => setShowModal(false))

  // statusParam/pendingApprovalOnly (declared below, hoisted here as a flag)
  // are CLIENT-side-only filters applied on top of whatever page the server
  // returns -- they don't reach the API. Round-1 review caught that real
  // server pagination made this combination actively broken rather than
  // just approximate: with PAGE_SIZE=20 (vs the old limit:100), a raw page
  // can easily contain zero rows matching the active status/approval filter
  // even though matches exist on other raw pages, showing "No risks match"
  // + a live pager over a totalPages count that has nothing to do with the
  // filtered result. Rather than teach the server about these two ad-hoc
  // client filters, fetch the old unpaginated-feeling limit:100 (matching
  // this feature's pre-pagination behavior) and hide the pager whenever
  // either is active, so this narrow, already-scoped case is no worse than
  // it was before this round -- not "fixed" in the sense of full pagination
  // over a filtered set, which would need a real server-side filter param.
  const isClientFiltered = !!searchParams.get("status") || pendingApprovalOnly
  // RTQ query states
  // quality-bar-loop round 16 (resilience regression): this query never
  // checked isError before -- a genuine fetch failure fell through to
  // `riskData?.data || []`, rendering an empty table indistinguishable
  // from "the filter matched nothing" (the exact false-all-clear pattern
  // round 1 fixed on Overview.tsx, surfaced here by round 14's dashboard
  // link making an empty-looking result more reachable/likely to matter).
  const {
    data: riskData,
    isError: risksError,
    isLoading: risksLoading,
  } = useGetAllRisksQuery({
    page: isClientFiltered ? 1 : page,
    limit: isClientFiltered ? 100 : PAGE_SIZE,
    searchTerm: search,
    siteId: siteFilter,
    category: filterCat,
  })
  const totalPages = isClientFiltered ? 0 : riskData?.meta?.totalPage || 0
  // Delete-on-last-page safety net -- same rationale as AuditPage/#265: a
  // filter change resets to page 1 proactively (see handleSearchChange etc.
  // below), but deleting the last row on the last page shrinks totalPages
  // without any filter changing, which this hook catches instead.
  useClampPageToTotal(page, totalPages, setPage)

  // quality-bar-loop round 4 (resilience): this query never checked isError
  // -- a genuine outage silently rendered the site filter/modal dropdown as
  // just "All Sites"/"Select site" with zero options and no indication
  // anything failed, indistinguishable from "this org genuinely has no
  // sites yet." Surfaced next to the site filter (the one place a user is
  // actively relying on this list) rather than duplicated at every use site.
  const { data: allSites, isError: sitesError } = useGetAllSitesQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })
  const [createNewRisk, { isLoading: isRiskCreating }] =
    useCreateNewRiskMutation()
  const [updateRisk, { isLoading: isRiskUpdating }] = useUpdateRiskMutation()
  const [deleteRisk] = useDeleteRiskMutation()
  // Custom make variables
  const risks: Risk[] = riskData?.data || []
  // quality-bar-loop round 14 (industry-standards): the dashboard's
  // "Active Risks" KPI card used to be a static, non-clickable number --
  // it now links here with ?status=open. This page had no status filter of
  // any kind before (only category/site/search reach the API, and
  // pendingApprovalOnly is its own client-side toggle), so this is a new,
  // client-side-only filter -- same convention as pendingApprovalOnly,
  // since GET /risk already returns every status and there's no reason to
  // add a new API param just for a same-page value the client already has.
  const statusParam = searchParams.get("status")
  const statusFilteredRisks: Risk[] = statusParam
    ? risks.filter((risk) => risk.status === statusParam)
    : risks
  const visibleRisks: Risk[] = pendingApprovalOnly
    ? statusFilteredRisks.filter(
        (risk) => risk.approvalStatus === "PENDING_APPROVAL"
      )
    : statusFilteredRisks
  // Round-1 review: with real pagination, `visibleRisks.length` is only the
  // current 20-row page's count, not "how many risks match" -- showing that
  // as the header subtitle is actively misleading (e.g. always "≤20 risks
  // found" for a search matching 87). `meta.total` is the server's true
  // count for the current search/site/category args and is unaffected by
  // which page you're on, so it's the right number for the normal browsing
  // case. It isn't meaningful once a client-only filter (status/pending
  // approval) narrows further -- those aren't reflected in meta.total at
  // all -- so that case keeps the direct visible-row count, same as before
  // this PR.
  const subtitleCount = isClientFiltered
    ? visibleRisks.length
    : (riskData?.meta?.total ?? visibleRisks.length)

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, dirtyFields },
  } = useForm<Risk>({
    defaultValues: EMPTY_RISK,
  })
  const inherentIsOverride = watch("inherent_is_override")
  const residualIsOverride = watch("residual_is_override")

  const openCreate = () => {
    setEditId(null)
    reset(EMPTY_RISK)
    setShowModal(true)
  }

  const openEdit = (risk: Risk) => {
    setEditId(risk.id)
    reset({
      ...risk,
      inherent_score: Number(risk.inherent_score) || 0,
      inherent_is_override: !!risk.inherent_is_override,
      inherent_override_reason: risk.inherent_override_reason || "",
      residual_score: Number(risk.residual_score) || 0,
      residual_is_override: !!risk.residual_is_override,
      residual_override_reason: risk.residual_override_reason || "",
      pagerank_score: Number(risk.pagerank_score) || 0,
      financial_impact_min: Number(risk.financial_impact_min) || 0,
      financial_impact_max: Number(risk.financial_impact_max) || 0,
      probability: Number(risk.probability) || 0,
      control_design_eff: Number(risk.control_design_eff) || 0,
      control_operating_eff: Number(risk.control_operating_eff) || 0,
      site_id: risk.site_id,
    })
    setShowModal(true)
  }

  const onSubmit: SubmitHandler<Risk> = async (data) => {
    // aexa-frontend#269 -- translate this form's client-facing
    // `*_is_override`/`*_override_reason` fields (named to match the stored
    // Risk row, for display/pre-fill purposes) into the request keys
    // POST/PATCH /risk actually expect (`*_override`, not `*_is_override` --
    // confirmed against aexa-server risk_scoring.ts's
    // InherentOverrideRequest/ResidualOverrideRequest shapes and
    // risk.service.ts's create/update handlers, which read
    // `payload.inherent_override`/`payload.residual_override`). The
    // *_overridden_by/*_overridden_at/*_override_stale fields are
    // server-derived and never sent -- the server would ignore a
    // client-supplied value for them anyway (risk_scoring.ts's
    // resolveInherentFields/resolveResidualFields always compute them),
    // sending them would just be misleading dead weight in the request.
    const payload: Record<string, unknown> = { ...data }
    // Server-owned audit fields -- the server always recomputes these
    // (risk_scoring.ts's resolveInherentFields/resolveResidualFields), so
    // sending them back is dead weight that could misleadingly imply the
    // client controls them.
    delete payload.inherent_overridden_by
    delete payload.inherent_overridden_at
    delete payload.inherent_override_stale
    delete payload.residual_overridden_by
    delete payload.residual_overridden_at
    delete payload.residual_override_stale
    // Rename this form's client-facing `*_is_override` field to the
    // `*_override` request key POST/PATCH /risk actually expect (confirmed
    // against risk_scoring.ts's InherentOverrideRequest/
    // ResidualOverrideRequest and risk.service.ts's create/update handlers).
    //
    // Only sent when the user actually touched this override control in this
    // editing session (formState.dirtyFields) -- risk_scoring.ts's
    // resolveInherentFields/resolveResidualFields treat an *omitted*
    // *_override key as "no explicit instruction, preserve existing
    // override/staleness as-is," but treat an *explicit* `true` as "fresh
    // override, reset overridden_by/overridden_at to now and clear
    // override_stale." Since this form always pre-populates the toggle from
    // the current row, sending it unconditionally on every submit -- even
    // for an edit to an unrelated field like the risk's name -- would
    // silently reassign who "overrode" the score and clear any staleness
    // flag nobody actually reviewed. Gating on dirtyFields keeps an
    // untouched override's audit trail and staleness intact through
    // unrelated edits, and still lets a deliberate toggle/reason/score
    // change take the "fresh override" branch as intended.
    const inherentOverrideTouched =
      !!dirtyFields.inherent_is_override ||
      !!dirtyFields.inherent_override_reason ||
      !!dirtyFields.inherent_score
    const residualOverrideTouched =
      !!dirtyFields.residual_is_override ||
      !!dirtyFields.residual_override_reason ||
      !!dirtyFields.residual_score

    if (inherentOverrideTouched) {
      payload.inherent_override = data.inherent_is_override
      // Don't ship stale reason text for a toggle that's off -- the server
      // requires a non-empty reason only when *_override is true, but an
      // unrelated leftover string here would be confusing on the next read.
      payload.inherent_override_reason = data.inherent_is_override
        ? data.inherent_override_reason
        : undefined
    } else {
      delete payload.inherent_override
      delete payload.inherent_override_reason
    }
    delete payload.inherent_is_override

    if (residualOverrideTouched) {
      payload.residual_override = data.residual_is_override
      payload.residual_override_reason = data.residual_is_override
        ? data.residual_override_reason
        : undefined
    } else {
      delete payload.residual_override
      delete payload.residual_override_reason
    }
    delete payload.residual_is_override

    const filteredData = removeNulls(payload)

    try {
      let res
      if (editId) {
        res = await updateRisk({ id: editId, data: filteredData }).unwrap()
      } else {
        res = await createNewRisk(filteredData).unwrap()
      }

      if (res.success) {
        toast.success(res.message)
        setShowModal(false)
      } else {
        // manage_response.ts (aexa-server) never sends an `error` key — a
        // failed request throws and lands in a .catch, not here — so this
        // branch is realistically unreachable, but keep a safe fallback
        // rather than reading a field the response never has. Found while
        // typing this endpoint (issue #108): `res.error` doesn't type-check
        // against the real response shape.
        toast.error(
          res.message || t("organization.riskRegister.saveFailedToast")
        )
      }
    } catch (err: any) {
      // Keep the modal open on failure so the user can retry without
      // re-entering the whole form (matches handleDelete's pattern below).
      toast.error(
        err?.data?.message || t("organization.riskRegister.saveFailedToast")
      )
    }
  }

  // Deleting Options
  const openDeleteModal = (id: string) => {
    setDeleteRiskId(id)
    setIsDeleteModalOpen(true)
  }

  const confirmDeleteRisk = async () => {
    if (!deleteRiskId) return
    try {
      const res = await deleteRisk(deleteRiskId).unwrap()
      if (res.success) {
        toast.success(t("organization.riskRegister.deleteSuccessToast"))
        setIsDeleteModalOpen(false)
        setDeleteRiskId(null)
      }
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.riskRegister.deleteFailedToast")
      )
    }
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground lg:text-2xl">
            {t("organization.riskRegister.title")}
          </h1>
          <p
            className={
              risksError
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {/* quality-bar-loop round 5 (UX/resilience): subtitleCount falls
                back to visibleRisks.length (0) whenever riskData is
                undefined -- true during both the loading and error states --
                so this line used to claim "0 risks found" at the exact
                moment the table below correctly showed a distinct loading
                spinner or error message. quality-bar-loop round 6 (visual
                polish): the error branch now uses text-destructive, same as
                the sites-error indicator below, so two fetch failures on the
                same page signal severity the same way instead of one being
                red and the other muted gray. */}
            {risksLoading
              ? t("organization.riskRegister.loading")
              : risksError
                ? t("organization.riskRegister.loadError")
                : t("organization.riskRegister.subtitle", {
                    count: subtitleCount,
                  })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" />{" "}
              {t("organization.riskRegister.addNewRisk")}
            </button>
          )}
        </div>
      </div>
      {statusParam && (
        <FilteredByNotice
          label={t("organization.riskRegister.filteredByStatus", {
            status: statusParam,
          })}
          clearLabel={t("organization.riskRegister.clearFilter")}
          clearHref="/organization/risks"
        />
      )}
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t("organization.riskRegister.searchPlaceholder")}
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-xs"
          />
        </div>

        <select
          value={siteFilter || ""}
          onChange={(e) => {
            setSiteFilter(e.target.value)
            setPage(1)
          }}
          className="h-9 w-40 rounded-lg border border-input bg-card px-3 text-xs lg:w-52"
        >
          <option value="">{t("organization.riskRegister.allSite")}</option>
          {allSites?.data.map((s: SiteSummary) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {sitesError && (
          <span
            role="alert"
            className="w-full basis-full text-xs text-destructive sm:w-auto sm:basis-auto"
          >
            {t("organization.riskRegister.siteLoadError")}
          </span>
        )}

        <select
          value={filterCat}
          onChange={(e) => {
            setFilterCat(e.target.value)
            setPage(1)
          }}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs"
        >
          <option value="">{t("organization.riskRegister.allCategory")}</option>
          {Object.entries(RISK_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {t(`organization.riskCategories.${v.labelKey}`)}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-pressed={pendingApprovalOnly}
          onClick={() => setPendingApprovalOnly((prev) => !prev)}
          className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
            pendingApprovalOnly
              ? severityBadgeClasses("medium", { border: true })
              : "border-input bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          {t("organization.riskRegister.filterPendingApproval")}
        </button>
      </div>
      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-3 py-2.5 font-semibold text-muted-foreground uppercase">
                  {t("organization.riskRegister.colName")}
                </th>
                <th className="hidden px-3 py-2.5 font-semibold text-muted-foreground sm:table-cell">
                  {t("organization.riskRegister.colSite")}
                </th>
                <th className="hidden px-3 py-2.5 font-semibold text-muted-foreground md:table-cell">
                  {t("organization.riskRegister.colCat")}
                </th>
                <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">
                  {t("organization.riskRegister.colScore")}
                </th>
                <th className="hidden px-3 py-2.5 text-center font-semibold text-muted-foreground lg:table-cell">
                  {t("organization.riskRegister.colPr")}
                </th>
                <th className="hidden px-3 py-2.5 text-center font-semibold text-muted-foreground lg:table-cell">
                  {t("organization.riskRegister.colImpact")}
                </th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">
                  {t("organization.riskRegister.colSource")}
                </th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">
                  {t("organization.riskRegister.colApproval")}
                </th>
                <th className="w-28 px-3 py-2.5 font-semibold text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {visibleRisks?.map((risk) => {
                return (
                  <tr
                    key={risk.id}
                    className={`border-b transition-colors hover:bg-muted/30`}
                  >
                    <td className="max-w-32 px-3 py-2.5 lg:max-w-48">
                      {/* aexa-frontend#529: the register itself is now also
                          an entry point into the per-risk detail page, not
                          just an editable list. */}
                      <Link
                        to={`/organization/risks/${risk.id}`}
                        className="focus-ring block truncate rounded font-medium text-primary hover:underline"
                      >
                        {risk.name}
                      </Link>
                      <p className="hidden truncate text-[10px] text-muted-foreground sm:block">
                        {risk.description}
                      </p>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {risk?.site?.name ? (
                          // aexa-frontend#541: same ?siteId=&search= pattern
                          // #533 used for a Finding's site.
                          <Link
                            to={`/organization/sites?siteId=${encodeURIComponent(risk.site.id)}&search=${encodeURIComponent(risk.site.name)}`}
                            className="focus-ring text-primary hover:underline"
                          >
                            {risk.site.name}
                          </Link>
                        ) : (
                          <>
                            <Building2 className="h-3 w-3 shrink-0" />
                            {t("organization.riskRegister.groupFallback")}
                          </>
                        )}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      {(() => {
                        const cat =
                          RISK_CATEGORIES[
                            risk.category as keyof typeof RISK_CATEGORIES
                          ]
                        const catColor = cat?.color || "hsl(220, 10%, 46%)"
                        return (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${catColor} 15%, transparent)`,
                              color: catColor,
                            }}
                          >
                            {cat
                              ? t(`organization.riskCategories.${cat.labelKey}`)
                              : risk.category}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${severityBadgeClasses(
                            getRiskSeverityLevel(risk.residual_score)
                          )}`}
                        >
                          {risk.residual_score}
                        </span>
                        {/* aexa-frontend#269 -- the list-view half of "not
                            buried": the score column is the one place every
                            row's residual score already renders, so the
                            override/staleness badge for it lives right
                            underneath rather than requiring a row expand. */}
                        <RiskOverrideBadge
                          isOverride={!!risk.residual_is_override}
                          isStale={!!risk.residual_override_stale}
                          overriddenBy={risk.residual_overridden_by}
                          overriddenAt={risk.residual_overridden_at}
                          label={t(
                            "organization.riskRegister.residualScoreLabel"
                          )}
                        />
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 text-center font-mono font-bold lg:table-cell">
                      {risk.pagerank_score}
                    </td>
                    <td className="hidden px-3 py-2.5 text-center font-mono lg:table-cell">
                      {/* aexa-frontend#376 -- the Min/Max Impact form
                          inputs are labeled "k€" (thousands of euros) and
                          submitted unmodified, so the stored value is
                          already in k€. 1,000 k€ = 1 M€, so this must divide
                          by 1,000, not 1,000,000 (which understated every
                          figure 1000x). */}
                      {/* quality-bar-loop round 4 (resilience): a missing
                          financial_impact_max (a nullable field, not
                          guaranteed populated on every risk) previously
                          rendered the literal string "NaNM" -- the site/
                          category columns already fall back gracefully, this
                          one didn't. */}
                      {risk.financial_impact_max == null
                        ? "—"
                        : `${(risk.financial_impact_max / 1000).toFixed(1)}M`}
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground">
                      {risk.ai_generated ? (
                        <span className="flex items-center gap-1">
                          <Bot className="h-3 w-3 shrink-0" />
                          {t("organization.riskRegister.aiGenerated")}
                        </span>
                      ) : (
                        t("organization.riskRegister.manual")
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <RiskApprovalControls risk={risk} />
                    </td>
                    <td className="px-3 py-2.5">
                      {canWrite && (
                        // quality-bar-loop round 3 (mobile): these buttons
                        // measured 20x20px live -- well under the 44x44
                        // touch-target guideline, ~4px apart with one being
                        // destructive. Hit-slop (WCAG 2.5.8: visible size and
                        // touch-target size may differ) extends the real
                        // clickable area via a `before:` pseudo-element
                        // without changing the visible icon/padding. The
                        // actions column only has ~88px of content width
                        // (w-28 minus px-3 padding) for two buttons, so a
                        // full 44x44 on both axes doesn't fit side-by-side --
                        // gap-4 (16px) + -inset-x-2 (8px each side) gets a full
                        // 44px height and a real, if narrower, 36px width
                        // with zero overlap between the two hit zones
                        // (8+8=16=gap), an honest, bounded improvement over
                        // 20x20 rather than a false claim of full 44x44.
                        <div className="flex gap-4">
                          <button
                            onClick={() => openEdit(risk)}
                            className="relative rounded p-1 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:bg-muted"
                            aria-label={t("organization.riskRegister.editRisk")}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(risk.id)}
                            className="relative rounded p-1 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t(
                              "organization.riskRegister.deleteRisk"
                            )}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {/* quality-bar-loop round 4 (resilience): before this, an
                  in-flight initial fetch had no distinct visual from a
                  genuine zero-result empty state -- riskData is undefined
                  while loading, so risks/visibleRisks are both [], and every
                  single page load flashed "No risks match the current
                  filters" for a moment before real data arrived. */}
              {risksLoading && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center">
                    <span
                      role="status"
                      aria-live="polite"
                      className="text-muted-foreground"
                    >
                      {t("organization.riskRegister.loading")}
                    </span>
                  </td>
                </tr>
              )}
              {/* quality-bar-loop round 16 (resilience regression): this
                  table had no error or empty-result row at all -- a fetch
                  failure and "the filter matched zero risks" both
                  previously rendered the exact same silent, header-only
                  table. */}
              {!risksLoading && risksError && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center">
                    {/* quality-bar-loop round 6 (visual polish): this row was
                        still text-muted-foreground while the header subtitle
                        and sites-error indicator both use text-destructive
                        for the same "a fetch failed" signal -- a third,
                        inconsistent color for an identical failure. */}
                    <span role="alert" className="text-destructive">
                      {t("organization.riskRegister.loadError")}
                    </span>
                  </td>
                </tr>
              )}
              {!risksLoading && !risksError && visibleRisks?.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center">
                    <span className="text-muted-foreground">
                      {t("organization.riskRegister.noResults")}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        prevAriaLabel={t("organization.riskRegister.prevPage")}
        nextAriaLabel={t("organization.riskRegister.nextPage")}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            ref={addEditModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="risk-add-edit-modal-title"
            className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl"
          >
            <h2 id="risk-add-edit-modal-title" className="text-lg font-bold">
              {editId
                ? t("organization.riskRegister.editRisk")
                : t("organization.riskRegister.addNewRisk")}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Basic Information */}
              {/* Note: required-field messages below are RHF-validated
                  snapshots. If the language is switched while a validation
                  error is already showing, the visible message stays in the
                  old language until the field is re-validated (blur/submit)
                  -- rules themselves do pick up the new t() string on the
                  next render, only the already-rendered error text doesn't
                  retroactively update. Same characteristic the rest of this
                  form's error handling already has; not fixed here. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="risk-site_id"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.riskRegister.siteLabel")}
                  </label>
                  <select
                    id="risk-site_id"
                    {...register("site_id", {
                      required: t("organization.riskRegister.siteRequired"),
                    })}
                    className="mt-1 h-9 w-full rounded-lg border bg-muted px-3 text-sm"
                  >
                    <option value="">
                      {t("organization.riskRegister.selectSite")}
                    </option>
                    {allSites?.data?.map((site: SiteSummary) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                  {errors.site_id && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.site_id.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="risk-category"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.riskRegister.categoryLabel")}
                  </label>
                  <select
                    id="risk-category"
                    {...register("category")}
                    className="mt-1 h-9 w-full rounded-lg border bg-muted px-3 text-sm"
                  >
                    <option value="">
                      {t("organization.riskRegister.selectCategory")}
                    </option>
                    {Object.entries(RISK_CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {t(`organization.riskCategories.${v.labelKey}`)}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.category.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="risk-name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.riskRegister.riskNameLabel")}
                </label>
                <input
                  id="risk-name"
                  {...register("name", {
                    required: t("organization.riskRegister.riskNameRequired"),
                  })}
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="risk-description"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("organization.riskRegister.descriptionLabel")}
                </label>
                <textarea
                  id="risk-description"
                  {...register("description")}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                />
              </div>

              {/* Scores Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {t("organization.riskRegister.scoresTitle")}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="risk-inherent_score"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("organization.riskRegister.inherentScoreLabel")}
                    </label>
                    <input
                      id="risk-inherent_score"
                      type="number"
                      min="0"
                      max="100"
                      {...register("inherent_score", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="risk-residual_score"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("organization.riskRegister.residualScoreLabel")}
                    </label>
                    <input
                      id="risk-residual_score"
                      type="number"
                      min="0"
                      max="100"
                      {...register("residual_score", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="risk-pagerank_score"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("organization.riskRegister.pagerankScoreLabel")}
                    </label>
                    <input
                      id="risk-pagerank_score"
                      type="number"
                      {...register("pagerank_score", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                </div>

                {/* aexa-frontend#269 -- derive-with-override-and-staleness
                    controls, one block per score, right under the score
                    inputs they apply to (rather than a shared block further
                    down the form) so the override is visually anchored to
                    the exact number it's overriding. The reason field is
                    only rendered -- and only required -- while the toggle is
                    checked, mirroring the server's own conditional
                    requirement (risk_scoring.ts's resolveInherentFields /
                    resolveResidualFields: `*_override_reason` is required
                    only when `*_override === true`). RHF's `validate`
                    callback re-reads the live checkbox value on every
                    validation pass (via `watch`), so toggling the checkbox
                    off after typing a reason clears the requirement without
                    needing a manual re-validate call. */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 rounded-lg border border-dashed p-2.5">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        {...register("inherent_is_override")}
                        className="h-3.5 w-3.5"
                      />
                      {t("organization.riskRegister.inherentOverrideLabel")}
                    </label>
                    {inherentIsOverride && (
                      <div>
                        <textarea
                          {...register("inherent_override_reason", {
                            validate: (value) =>
                              !watch("inherent_is_override") ||
                              !!value?.trim() ||
                              t(
                                "organization.riskRegister.overrideReasonRequired"
                              ),
                          })}
                          placeholder={t(
                            "organization.riskRegister.inherentOverrideReasonPlaceholder"
                          )}
                          rows={2}
                          className="w-full rounded-lg border bg-muted px-2 py-1.5 text-xs"
                        />
                        {errors.inherent_override_reason && (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.inherent_override_reason.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 rounded-lg border border-dashed p-2.5">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        {...register("residual_is_override")}
                        className="h-3.5 w-3.5"
                      />
                      {t("organization.riskRegister.residualOverrideLabel")}
                    </label>
                    {residualIsOverride && (
                      <div>
                        <textarea
                          {...register("residual_override_reason", {
                            validate: (value) =>
                              !watch("residual_is_override") ||
                              !!value?.trim() ||
                              t(
                                "organization.riskRegister.overrideReasonRequired"
                              ),
                          })}
                          placeholder={t(
                            "organization.riskRegister.residualOverrideReasonPlaceholder"
                          )}
                          rows={2}
                          className="w-full rounded-lg border bg-muted px-2 py-1.5 text-xs"
                        />
                        {errors.residual_override_reason && (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.residual_override_reason.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Staleness badges: visible in the edit modal whenever this
                    risk's stored override is stale (an underlying input
                    changed since it was set), not just on the list view --
                    see the table's SCORE column for the other half of "not
                    buried". Only shown on edit (editId set), since a
                    brand-new risk can't have a stale override yet. */}
                {editId && (
                  <div className="flex flex-wrap gap-2">
                    <RiskOverrideBadge
                      isOverride={!!watch("inherent_is_override")}
                      isStale={!!watch("inherent_override_stale")}
                      overriddenBy={watch("inherent_overridden_by")}
                      overriddenAt={watch("inherent_overridden_at")}
                      label={t("organization.riskRegister.inherentScoreLabel")}
                    />
                    <RiskOverrideBadge
                      isOverride={!!watch("residual_is_override")}
                      isStale={!!watch("residual_override_stale")}
                      overriddenBy={watch("residual_overridden_by")}
                      overriddenAt={watch("residual_overridden_at")}
                      label={t("organization.riskRegister.residualScoreLabel")}
                    />
                  </div>
                )}
              </div>

              {/* Financial Impact Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {t("organization.riskRegister.financialImpactTitle")}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="risk-financial_impact_min"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("organization.riskRegister.minImpactLabel")}
                    </label>
                    <input
                      id="risk-financial_impact_min"
                      type="number"
                      {...register("financial_impact_min", {
                        valueAsNumber: true,
                      })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="risk-financial_impact_max"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("organization.riskRegister.maxImpactLabel")}
                    </label>
                    <input
                      id="risk-financial_impact_max"
                      type="number"
                      {...register("financial_impact_max", {
                        valueAsNumber: true,
                      })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Risk Assessment Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {t("organization.riskRegister.riskAssessmentTitle")}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="risk-probability"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("organization.riskRegister.probabilityLabel")}
                    </label>
                    <input
                      id="risk-probability"
                      type="number"
                      min="0"
                      max="100"
                      {...register("probability", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="risk-velocity"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("organization.riskRegister.velocityLabel")}
                    </label>
                    <select
                      id="risk-velocity"
                      {...register("velocity")}
                      className="mt-1 h-9 w-full rounded-lg border bg-muted px-3 text-sm"
                    >
                      <option value="">
                        {t("organization.riskRegister.selectVelocity")}
                      </option>
                      <option value="critical">
                        {t("organization.riskRegister.velocityCritical")}
                      </option>
                      <option value="high">
                        {t("organization.riskRegister.velocityHigh")}
                      </option>
                      <option value="medium">
                        {t("organization.riskRegister.velocityMedium")}
                      </option>
                      <option value="low">
                        {t("organization.riskRegister.velocityLow")}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="risk-trend"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("organization.riskRegister.trendLabel")}
                    </label>
                    <select
                      id="risk-trend"
                      {...register("trend")}
                      className="mt-1 h-9 w-full rounded-lg border bg-muted px-3 text-sm"
                    >
                      <option value="">
                        {t("organization.riskRegister.selectTrend")}
                      </option>
                      <option value="increasing">
                        {t("organization.riskRegister.trendIncreasing")}
                      </option>
                      <option value="decreasing">
                        {t("organization.riskRegister.trendDecreasing")}
                      </option>
                      <option value="none">
                        {t("organization.riskRegister.trendNone")}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="risk-status"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.riskRegister.statusLabel")}
                  </label>
                  <select
                    id="risk-status"
                    {...register("status", {
                      required: t("organization.riskRegister.statusRequired"),
                    })}
                    className="mt-1 h-9 w-full rounded-lg border bg-muted px-3 text-sm"
                  >
                    <option value="">
                      {t("organization.riskRegister.selectStatus")}
                    </option>
                    <option value="open">
                      {t("organization.riskRegister.statusOpen")}
                    </option>
                    <option value="in_progress">
                      {t("organization.riskRegister.statusInProgress")}
                    </option>
                    <option value="completed">
                      {t("organization.riskRegister.statusCompleted")}
                    </option>
                    <option value="closed">
                      {t("organization.riskRegister.statusClosed")}
                    </option>
                  </select>
                  {errors.status && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.status.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="risk-source_info"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.riskRegister.sourceInfoLabel")}
                  </label>
                  <input
                    id="risk-source_info"
                    {...register("source_info")}
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    placeholder={t(
                      "organization.riskRegister.sourceInfoPlaceholder"
                    )}
                  />
                </div>
              </div>

              {/* Control Effectiveness Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {t("organization.riskRegister.controlEffectivenessTitle")}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="risk-control_design_eff"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("organization.riskRegister.designEffectivenessLabel")}
                    </label>
                    <input
                      id="risk-control_design_eff"
                      type="number"
                      min="0"
                      max="100"
                      {...register("control_design_eff", {
                        valueAsNumber: true,
                      })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="risk-control_operating_eff"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t(
                        "organization.riskRegister.operatingEffectivenessLabel"
                      )}
                    </label>
                    <input
                      id="risk-control_operating_eff"
                      type="number"
                      min="0"
                      max="100"
                      {...register("control_operating_eff", {
                        valueAsNumber: true,
                      })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  {t("organization.riskRegister.close")}
                </button>
                <button
                  type="submit"
                  disabled={isRiskCreating || isRiskUpdating}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {(isRiskCreating || isRiskUpdating) && <Loader />}
                  {editId
                    ? t("organization.riskRegister.updateRisk")
                    : t("organization.riskRegister.addRisk")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteAlertModal
        title={t("organization.riskRegister.deleteTitle")}
        description={t("organization.riskRegister.deleteDescription")}
        open={isDeleteModalOpen}
        setOpen={setIsDeleteModalOpen}
        onConfirm={confirmDeleteRisk}
      />
    </div>
  )
}
