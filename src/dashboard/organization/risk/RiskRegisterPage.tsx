/* eslint-disable @typescript-eslint/no-explicit-any */
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import {
  useCreateNewRiskMutation,
  useDeleteRiskMutation,
  useGetAllRisksQuery,
  useUpdateRiskMutation,
} from "@/redux/apis/organization/risk.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
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

  // RTQ query states
  const { data: riskData } = useGetAllRisksQuery({
    page: 1,
    limit: 100,
    searchTerm: search,
    siteId: siteFilter,
    category: filterCat,
  })

  const { data: allSites } = useGetAllSitesQuery({
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
          <p className="text-sm text-muted-foreground">
            {t("organization.riskRegister.subtitle", {
              count: visibleRisks.length,
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {t("organization.riskRegister.filteredByStatus", {
              status: statusParam,
            })}
          </span>
          <Link
            to="/organization/risks"
            className="focus-ring rounded text-primary hover:underline"
          >
            {t("organization.riskRegister.clearFilter")}
          </Link>
        </div>
      )}
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("organization.riskRegister.searchPlaceholder")}
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-xs"
          />
        </div>

        <select
          value={siteFilter || ""}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="h-9 w-40 rounded-lg border border-input bg-card px-3 text-xs lg:w-52"
        >
          <option value="">{t("organization.riskRegister.allSite")}</option>
          {allSites?.data.map((s: SiteSummary) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
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
                <th className="w-20 px-3 py-2.5 font-semibold text-muted-foreground"></th>
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
                      {(risk.financial_impact_max / 1000).toFixed(1)}M
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
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEdit(risk)}
                            className="rounded p-1 hover:bg-muted"
                            aria-label={t("organization.riskRegister.editRisk")}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(risk.id)}
                            className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
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
            </tbody>
          </table>
        </div>
      </div>

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
