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
import type { Risk, SiteSummary } from "@/types/organization"
import { removeNulls } from "@/utils/removeNulls"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import RiskApprovalControls from "./RiskApprovalControls"
import { Clock, Loader, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import type { SubmitHandler } from "react-hook-form"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const EMPTY_RISK: Partial<Risk> = {
  name: "",
  description: "",
  category: "",
  inherent_score: 0,
  residual_score: 0,
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
  const visibleRisks: Risk[] = pendingApprovalOnly
    ? risks.filter((risk) => risk.approvalStatus === "PENDING_APPROVAL")
    : risks

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Risk>({
    defaultValues: EMPTY_RISK,
  })

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
      residual_score: Number(risk.residual_score) || 0,
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
    const filteredData = removeNulls(data)

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
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t("organization.riskRegister.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.riskRegister.subtitle")}
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
          <option value="">
            {t("organization.riskRegister.allCategory")}
          </option>
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
              ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-600"
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
                      <p className="truncate font-medium">{risk.name}</p>
                      <p className="hidden truncate text-[10px] text-muted-foreground sm:block">
                        {risk.description}
                      </p>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <span className="text-[11px] text-muted-foreground">
                        {risk?.site?.name ||
                          `🏢 ${t("organization.riskRegister.groupFallback")}`}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                        {risk.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          risk.velocity === "critical"
                            ? "bg-destructive/15 text-destructive"
                            : risk.velocity === "high"
                              ? "bg-orange-500/15 text-orange-600"
                              : risk.velocity === "medium"
                                ? "bg-yellow-500/15 text-yellow-600"
                                : "bg-green-500/15 text-green-600"
                        }`}
                      >
                        {risk.residual_score}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-center font-mono font-bold lg:table-cell">
                      {risk.pagerank_score}
                    </td>
                    <td className="hidden px-3 py-2.5 text-center font-mono lg:table-cell">
                      {(risk.financial_impact_max / 1000000).toFixed(1)}M
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground">
                      {risk.ai_generated
                        ? `🤖 ${t("organization.riskRegister.aiGenerated")}`
                        : t("organization.riskRegister.manual")}
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
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(risk.id)}
                            className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
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
          <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl">
            <h2 className="text-lg font-bold">
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
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.riskRegister.siteLabel")}
                  </label>
                  <select
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
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.riskRegister.categoryLabel")}
                  </label>
                  <select
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
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.riskRegister.riskNameLabel")}
                </label>
                <input
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
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.riskRegister.descriptionLabel")}
                </label>
                <textarea
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
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("organization.riskRegister.inherentScoreLabel")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      {...register("inherent_score", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("organization.riskRegister.residualScoreLabel")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      {...register("residual_score", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("organization.riskRegister.pagerankScoreLabel")}
                    </label>
                    <input
                      type="number"
                      {...register("pagerank_score", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Financial Impact Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {t("organization.riskRegister.financialImpactTitle")}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("organization.riskRegister.minImpactLabel")}
                    </label>
                    <input
                      type="number"
                      {...register("financial_impact_min", {
                        valueAsNumber: true,
                      })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("organization.riskRegister.maxImpactLabel")}
                    </label>
                    <input
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
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("organization.riskRegister.probabilityLabel")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      {...register("probability", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("organization.riskRegister.velocityLabel")}
                    </label>
                    <select
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
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("organization.riskRegister.trendLabel")}
                    </label>
                    <select
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
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.riskRegister.statusLabel")}
                  </label>
                  <select
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
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.riskRegister.sourceInfoLabel")}
                  </label>
                  <input
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
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("organization.riskRegister.designEffectivenessLabel")}
                    </label>
                    <input
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
                    <label className="text-xs font-medium text-muted-foreground">
                      {t(
                        "organization.riskRegister.operatingEffectivenessLabel"
                      )}
                    </label>
                    <input
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
                  {isRiskCreating || (isRiskUpdating && <Loader />)}
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
