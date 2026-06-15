import {
  useCreateNewRiskMutation,
  useGetAllRisksQuery,
  useUpdateRiskMutation,
} from "@/redux/apis/organization/risk.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import type { Risk, Site } from "@/types/organization"
import { removeNulls } from "@/utils/removeNulls"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import { Loader, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import type { SubmitHandler } from "react-hook-form"
import { useForm } from "react-hook-form"
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
  const [filterCat, setFilterCat] = useState("")
  const [search, setSearch] = useState("")
  const [siteFilter, setSiteFilter] = useState<string>("")

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

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
  // Custom make variables
  const risks: Risk[] = riskData?.data

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
      toast.error(res?.error?.message)
    }
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            Risk Register
          </h1>
          <p className="text-sm text-muted-foreground">Risk founds</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add New Risk
          </button>
        </div>
      </div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-xs"
          />
        </div>

        <select
          value={siteFilter || ""}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="h-9 w-40 rounded-lg border border-input bg-card px-3 text-xs lg:w-52"
        >
          <option value="">All Sites</option>
          {allSites?.data.map((s: Site) => (
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
          <option value="">All Categories</option>
          {Object.entries(RISK_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-3 py-2.5 font-semibold text-muted-foreground uppercase">
                  NAME
                </th>
                <th className="hidden px-3 py-2.5 font-semibold text-muted-foreground sm:table-cell">
                  SITE
                </th>
                <th className="hidden px-3 py-2.5 font-semibold text-muted-foreground md:table-cell">
                  CAT
                </th>
                <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">
                  SCORE
                </th>
                <th className="hidden px-3 py-2.5 text-center font-semibold text-muted-foreground lg:table-cell">
                  PR
                </th>
                <th className="hidden px-3 py-2.5 text-center font-semibold text-muted-foreground lg:table-cell">
                  IMPACT
                </th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">
                  SOURCE
                </th>
                <th className="w-20 px-3 py-2.5 font-semibold text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {risks?.map((risk) => {
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
                        {risk?.site?.name || "🏢 Groupe"}
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
                      {(risk.financial_impact_max / 1000).toFixed(1)}M
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground">
                      {risk.ai_generated ? "🤖 IA" : "Manuel"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(risk)}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
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
              {editId ? "Edit Risk" : "Add New Risk"}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Site *
                  </label>
                  <select
                    {...register("site_id", { required: "Site is required" })}
                    className="mt-1 h-9 w-full rounded-lg border bg-muted px-3 text-sm"
                  >
                    <option value="">Select Site</option>
                    {allSites?.data?.map((site: Site) => (
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
                    Category
                  </label>
                  <select
                    {...register("category")}
                    className="mt-1 h-9 w-full rounded-lg border bg-muted px-3 text-sm"
                  >
                    <option value="">Select Category</option>
                    {Object.entries(RISK_CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
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
                  Risk Name *
                </label>
                <input
                  {...register("name", { required: "Risk name is required" })}
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
                  Description
                </label>
                <textarea
                  {...register("description")}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                />
              </div>

              {/* Scores Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Scores</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Inherent Score
                    </label>
                    <input
                      type="number"
                      {...register("inherent_score", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Residual Score
                    </label>
                    <input
                      type="number"
                      {...register("residual_score", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      PageRank Score
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
                <h3 className="text-sm font-semibold">Financial Impact</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Min Impact
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
                      Max Impact
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
                <h3 className="text-sm font-semibold">Risk Assessment</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Probability
                    </label>
                    <input
                      type="number"
                      {...register("probability", { valueAsNumber: true })}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Velocity
                    </label>
                    <select
                      {...register("velocity")}
                      className="mt-1 h-9 w-full rounded-lg border bg-muted px-3 text-sm"
                    >
                      <option value="">Select Velocity</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Trend
                    </label>
                    <select
                      {...register("trend")}
                      className="mt-1 h-9 w-full rounded-lg border bg-muted px-3 text-sm"
                    >
                      <option value="">Select Trend</option>
                      <option value="increasing">Increasing</option>
                      <option value="decreasing">Decreasing</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Status *
                  </label>
                  <select
                    {...register("status", { required: "Status is required" })}
                    className="mt-1 h-9 w-full rounded-lg border bg-muted px-3 text-sm"
                  >
                    <option value="">Select Status</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="closed">Closed</option>
                  </select>
                  {errors.status && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.status.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Source Info
                  </label>
                  <input
                    {...register("source_info")}
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    placeholder="Risk source or reference"
                  />
                </div>
              </div>

              {/* Control Effectiveness Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Control Effectiveness</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Design Effectiveness
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
                      Operating Effectiveness
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
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isRiskCreating || isRiskUpdating}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {isRiskCreating || (isRiskUpdating && <Loader />)}
                  {editId ? "Update Risk" : "Add Risk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
