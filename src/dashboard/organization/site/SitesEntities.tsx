/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import { Button } from "@/components/ui/button"
import { useDebouncedValue } from "@/hooks/Usedebouncedvalue"
import { useAnalyzeSiteRisksMutation } from "@/redux/apis/organization/ai.api"
import {
  useCreateNewRiskMutation,
  useDeleteRiskMutation,
  useGetAllRisksQuery,
} from "@/redux/apis/organization/risk.api"
import {
  useCreateNewSiteMutation,
  useDeleteSiteMutation,
  useGetAllSitesQuery,
  useUpdateSiteMutation,
} from "@/redux/apis/organization/sites.api"
import type { RiskSuggestion } from "@/types/ai"
import type { Risk, Site } from "@/types/organization"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import {
  Brain,
  Building,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  PlusCircle,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

// The AI is prompted for Title-Case category names close to (but not always
// exactly matching) RISK_CATEGORIES' keys/labels — e.g. "Cybersecurity" vs
// the "cyber" key. Best-effort match by label so the imported risk gets a
// real category badge/color instead of falling through to the unstyled
// default; falls back to the raw AI string if nothing matches; nothing is
// lost either way since risk.category on the backend is a free string.
const matchKnownCategory = (aiCategory: string): string => {
  const normalized = aiCategory.trim().toLowerCase()
  const match = Object.entries(RISK_CATEGORIES).find(
    ([key, cat]) =>
      key.toLowerCase() === normalized ||
      cat.label.toLowerCase() === normalized ||
      cat.label.toLowerCase().includes(normalized) ||
      normalized.includes(cat.label.toLowerCase())
  )
  return match ? match[0] : aiCategory
}

// AI returns a qualitative High/Medium/Low label for these two scores, but
// the Risk model stores them as Int?. No documented numeric scale exists for
// this field, so this mapping is a judgment call, not a spec requirement —
// picked to land in the same rough range (1-10) the register's own risk
// matrix already uses for scoring.
const mapQualitativeScore = (level: string): number => {
  const normalized = level.trim().toLowerCase()
  if (normalized === "high") return 8
  if (normalized === "medium") return 5
  if (normalized === "low") return 2
  return 5
}

// Types for the form
interface SiteFormValues {
  name: string
  location: string
  country: string
  activity: string
  revenue: number
  employees_count: number
  site_type: string
  lat: number
  lng: number
}

interface RiskFormValues {
  status: string
  name: string
  category: string
  description: string
}

export default function SitesEntities() {
  const { t } = useTranslation()

  // Search and pagination state
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const debouncedSearch = useDebouncedValue(searchTerm, 500)
  const [expandedSite, setExpandedSite] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteSiteId, setDeleteSiteId] = useState<string | null>(null)

  // RTK Query
  const {
    data: sitesData,
    isLoading,
    isFetching,
    error,
  } = useGetAllSitesQuery({
    page,
    limit,
    searchTerm: debouncedSearch,
  })
  const [createNewSite, { isLoading: isSiteCreating }] =
    useCreateNewSiteMutation()
  const [updateSite, { isLoading: isSiteUpdating }] = useUpdateSiteMutation()
  const [deleteSite, { isLoading: isSiteDeleting }] = useDeleteSiteMutation()
  const { data: riskData } = useGetAllRisksQuery(
    {
      siteId: expandedSite ?? "",
      page: 1,
      limit: 100,
      searchTerm: "",
      category: "",
    },
    { skip: !expandedSite }
  )
  const [deleteRisk] = useDeleteRiskMutation()
  const [createNewRisk] = useCreateNewRiskMutation()
  const [analyzeSiteRisks] = useAnalyzeSiteRisksMutation()
  // Reset page when search changes
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  // Local state
  const [showForm, setShowForm] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)

  const [showRiskForm, setShowRiskForm] = useState<string | null>(null)

  // AI risk-analysis state. Suggestions/selection/importing are scoped to a
  // single site at a time (analyzingSiteId) rather than keyed per-site,
  // since only one site's panel realistically drives this at once and it
  // keeps the state reset trivial when switching sites.
  const [analyzingSiteId, setAnalyzingSiteId] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState<RiskSuggestion[]>([])
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<
    Set<string>
  >(new Set())
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set())
  // The Analyze button is only disabled for the site currently being
  // analyzed, so nothing stops clicking Analyze on a different site while
  // one request is still in flight. This ref (not state, so it's readable
  // synchronously inside an in-flight request's .then/.catch without a
  // stale closure) tracks which site's analysis is actually current, so a
  // slow/late response for a site the user has since moved away from can't
  // overwrite what's currently displayed for a different site.
  const latestAnalysisRequestRef = useRef<string | null>(null)

  // React Hook Form setup for site form
  const siteForm = useForm<SiteFormValues>({
    defaultValues: {
      name: "",
      location: "",
      country: "",
      activity: "",
      revenue: 0,
      employees_count: 0,
      site_type: "production",
    },
  })

  // React Hook Form setup for risk form
  const riskForm = useForm<RiskFormValues>({
    defaultValues: {
      status: "",
      name: "",
      category: "operational",
      description: "",
    },
  })

  // Extract data from API response
  const sites = sitesData?.data || []
  const meta = sitesData?.meta || { page: 1, limit: 10, total: 0 }
  const totalPages = Math.ceil(meta.total / meta.limit)

  const openCreate = () => {
    setEditingSite(null)
    siteForm.reset({
      name: "",
      location: "",
      country: "",
      activity: "",
      revenue: 0,
      employees_count: 0,
      site_type: "production",
    })
    setShowForm(true)
  }

  const openEdit = (site: Site) => {
    setEditingSite(site)
    siteForm.reset({
      name: site.name,
      location: site.location || "",
      country: site.country || "",
      activity: site.activity || "",
      revenue: site.revenue || 0,
      employees_count: site.employees_count || 0,
      site_type: site.site_type || "production",
    })
    setShowForm(true)
  }

  const handleSave = async (values: SiteFormValues) => {
    if (!values.name.trim()) return

    try {
      let res
      if (editingSite) {
        res = await updateSite({
          id: editingSite.id,
          data: values,
        }).unwrap()
      } else {
        res = await createNewSite(values).unwrap()
      }
      if (res.success) {
        toast.success(
          editingSite
            ? "Site updated successfully"
            : "Site created successfully"
        )
        setShowForm(false)
      }
    } catch (error: any) {
      toast.error("Failed to save site")
    }
  }
  const handleDeleteModalOpen = (siteId: string) => {
    setIsDeleteModalOpen(true)
    setDeleteSiteId(siteId)
  }

  const handleConfirmDelete = async () => {
    if (!deleteSiteId) return
    try {
      const res = await deleteSite(deleteSiteId).unwrap()
      if (res.success) {
        toast.success("Site deleted successfully")
        setIsDeleteModalOpen(false)
        setDeleteSiteId(null)
      }
    } catch (error) {
      toast.error("Failed to delete site")
    }
  }

  const handleAnalyzeSite = async (site: Site) => {
    // Tracks which site's analysis is the "current" one independent of React
    // state timing — if the user clicks Analyze on a different site before
    // this request resolves, latestAnalysisRequestRef will have moved on by
    // the time this .then/.catch runs, and every state update below is
    // skipped rather than overwriting a different site's already-displayed
    // suggestions with this stale response.
    latestAnalysisRequestRef.current = site.id
    setAnalyzingSiteId(site.id)
    setSuggestions([])
    setSelectedSuggestionIds(new Set())
    setIsAnalyzing(true)
    setExpandedSite(site.id)
    try {
      const res = await analyzeSiteRisks(site.id).unwrap()
      if (latestAnalysisRequestRef.current !== site.id) return
      const risks: RiskSuggestion[] = res?.data ?? []
      setSuggestions(risks)
      if (risks.length === 0) {
        toast("AI analysis found no additional risks to suggest for this site")
      }
    } catch (error: any) {
      if (latestAnalysisRequestRef.current !== site.id) return
      toast.error(error?.data?.message || "AI risk analysis failed")
      setAnalyzingSiteId(null)
    } finally {
      if (latestAnalysisRequestRef.current === site.id) {
        setIsAnalyzing(false)
      }
    }
  }

  const toggleSuggestionSelected = (riskId: string) => {
    setSelectedSuggestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(riskId)) {
        next.delete(riskId)
      } else {
        next.add(riskId)
      }
      return next
    })
  }

  const handleImportSuggestions = async (siteId: string) => {
    const toImport = suggestions.filter((s) =>
      selectedSuggestionIds.has(s.risk_id)
    )
    if (toImport.length === 0) return

    setImportingIds(new Set(toImport.map((s) => s.risk_id)))
    let importedCount = 0
    for (const suggestion of toImport) {
      try {
        const payload = {
          name: suggestion.title,
          description: suggestion.description,
          category: matchKnownCategory(suggestion.category),
          status: "open",
          site_id: siteId,
          source_info: "AI Suggested",
          ai_generated: true,
          velocity: suggestion.Velocity,
          trend: suggestion.Trend,
          inherent_score: mapQualitativeScore(suggestion.inherent_risk_score),
          residual_score: mapQualitativeScore(suggestion.residual_risk_score),
          probability: Math.round(suggestion.Probability * 100),
        }
        const res = await createNewRisk(payload).unwrap()
        if (res?.success) {
          importedCount += 1
        }
      } catch {
        toast.error(`Failed to import "${suggestion.title}"`)
      }
    }
    setImportingIds(new Set())
    if (importedCount > 0) {
      toast.success(
        importedCount === 1
          ? "Risk imported into the register"
          : `${importedCount} risks imported into the register`
      )
    }
    // Remove imported suggestions from the list; leave unselected ones
    // visible in case the user wants to review them further.
    const importedIds = new Set(toImport.map((s) => s.risk_id))
    setSuggestions((prev) => prev.filter((s) => !importedIds.has(s.risk_id)))
    setSelectedSuggestionIds(new Set())
  }

  const handleAddManualRisk = async (
    siteId: string,
    values: RiskFormValues
  ) => {
    if (!values.status || !values.name) return
    const payload = { ...values, site_id: siteId }
    const res = await createNewRisk(payload).unwrap()
    if (res?.success) {
      toast.success("Risk created successfully")
      setShowRiskForm(null)
    } else {
      toast.error("Failed to create risk")
    }
  }

  // For risk

  const getRiskLevel = (
    score: number
  ): "critical" | "high" | "medium" | "low" =>
    score > 14 ? "critical" : score > 10 ? "high" : score > 6 ? "medium" : "low"

  const handleRiskDelete = async (id: string) => {
    const res = await deleteRisk(id).unwrap()
    if (res?.success) {
      toast.success("Risk deleted successfully")
    } else {
      toast.error("Failed to delete risk")
    }
  }

  // Pagination handlers
  const goToPage = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
        setPage(newPage)
      }
    },
    [totalPages]
  )

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">
            Error loading sites
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Please try again later
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("organization.site&entities.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.site&entities.description")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-80 sm:block">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pr-4 pl-10 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            />
            {isFetching && (
              <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />{" "}
            {t("organization.site&entities.newSite")}
          </button>
        </div>
      </div>

      {/* Sites List */}
      <div className="space-y-4">
        {sites.map((site: Site) => {
          const isExpanded = expandedSite === site.id

          return (
            <div
              key={site.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              {/* Site Header */}
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-semibold text-foreground">
                        {site.name}
                      </p>

                      <SourceBadge
                        aiGenerated={false}
                        isEdited={site.updatedAt ? true : false}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {site.country && `${site.country} • `}
                      {site.activity && `${site.activity} • `}
                      Location: {site.location} • Country: {site.country}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setShowRiskForm(site.id)
                      riskForm.reset({
                        status: "",
                        name: "",
                        category: "operational",
                        description: "",
                      })
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs hover:bg-muted"
                  >
                    <PlusCircle className="h-4 w-4" />{" "}
                    {t("organization.site&entities.addRisk")}
                  </button>

                  <button
                    onClick={() => handleAnalyzeSite(site)}
                    disabled={isAnalyzing && analyzingSiteId === site.id}
                    className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    {isAnalyzing && analyzingSiteId === site.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}{" "}
                    {t("organization.site&entities.analyzeAi")}
                  </button>

                  <button
                    onClick={() => openEdit(site)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteModalOpen(site.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => setExpandedSite(isExpanded ? null : site.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Manual Risk Form */}
              {showRiskForm === site.id && (
                <form
                  onSubmit={riskForm.handleSubmit((values) =>
                    handleAddManualRisk(site.id, values)
                  )}
                  className="border-t border-border bg-muted/30 p-6"
                >
                  <div className="mb-5 flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary"></div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("organization.site&entities.addRiskTitle")}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Risk Name <span className="text-destructive">*</span>
                      </label>
                      <input
                        {...riskForm.register("name", { required: true })}
                        placeholder="Enter risk name"
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors placeholder:text-muted-foreground/50 hover:border-primary/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Status <span className="text-destructive">*</span>
                      </label>
                      <select
                        {...riskForm.register("status", { required: true })}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors hover:border-primary/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Category
                      </label>
                      <select
                        {...riskForm.register("category")}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors hover:border-primary/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        {Object.entries(RISK_CATEGORIES).map(([key, cat]) => (
                          <option key={key} value={key}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Description
                    </label>
                    <textarea
                      {...riskForm.register("description")}
                      placeholder="Describe the risk in detail..."
                      rows={3}
                      className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/50 hover:border-primary/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowRiskForm(null)}
                      className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                      {t("organization.site&entities.cancel")}
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                      <PlusCircle className="h-4 w-4" />
                      {t("organization.site&entities.add")}
                    </button>
                  </div>
                </form>
              )}

              {/* AI-suggested risks — pending review, not yet in the register */}
              {isExpanded &&
                analyzingSiteId === site.id &&
                suggestions.length > 0 && (
                  <div className="border-t border-border bg-primary/5 p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="flex items-center gap-1.5 text-start text-[10px] font-semibold tracking-wider text-primary uppercase">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI-suggested risks — review before importing
                      </p>
                      <button
                        onClick={() => handleImportSuggestions(site.id)}
                        disabled={
                          selectedSuggestionIds.size === 0 ||
                          importingIds.size > 0
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {importingIds.size > 0 ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Import selected ({selectedSuggestionIds.size})
                      </button>
                    </div>

                    <div className="space-y-2 text-start">
                      {suggestions.map((suggestion) => (
                        <label
                          key={suggestion.risk_id}
                          className="flex cursor-pointer flex-col gap-2 rounded-lg border-2 border-primary/20 bg-card p-3 sm:flex-row sm:items-start"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSuggestionIds.has(
                              suggestion.risk_id
                            )}
                            onChange={() =>
                              toggleSuggestionSelected(suggestion.risk_id)
                            }
                            className="mt-1 h-4 w-4 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {suggestion.title}
                              </p>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {suggestion.category}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {suggestion.description}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                              <span>
                                Inherent: {suggestion.inherent_risk_score}
                              </span>
                              <span>
                                Residual: {suggestion.residual_risk_score}
                              </span>
                              <span>
                                Probability:{" "}
                                {Math.round(suggestion.Probability * 100)}%
                              </span>
                              <span>Velocity: {suggestion.Velocity}</span>
                              <span>Trend: {suggestion.Trend}</span>
                              {suggestion.Responsable && (
                                <span>
                                  Suggested owner: {suggestion.Responsable}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

              {/* Expanded Risks Section - Will be implemented with actual risks data */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                  <p className="mb-4 text-start text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    ✅ Confirmed risks (in the register)
                  </p>
                  <div className="space-y-1.5">
                    {riskData?.data.map((risk: Risk) => (
                      <div
                        key={risk.id}
                        className="flex flex-col justify-between gap-2 rounded-lg border-2 border-accent/30 bg-accent/5 p-3 sm:flex-row sm:items-center"
                      >
                        <div className="flex items-center gap-16">
                          <span className="font-mono text-xs font-bold">
                            RS-{risk.id.split("-")[1].toUpperCase()}
                          </span>

                          <div className="flex min-w-0 flex-col items-start gap-1.5">
                            <p className="truncate text-sm font-medium text-foreground">
                              {risk.name}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {risk.description?.slice(0, 120)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <RiskBadge
                            level={getRiskLevel(Number(risk.residual_score))}
                            label={Number(risk.residual_score).toFixed(1)}
                            size="sm"
                          />
                          <span
                            className={`rounded p-1.5 text-[9px] font-medium ${risk.ai_generated ? "bg-accent/20 text-accent" : "bg-primary/10 text-base"}`}
                          >
                            {risk.ai_generated ? "🤖 AI" : "👤 Manual"}
                          </span>
                          <Button
                            onClick={() => handleRiskDelete(risk.id)}
                            variant="destructive"
                            size="sm"
                          >
                            Delete
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {sites.length === 0 && !isFetching && (
          <div className="rounded-2xl border border-border bg-card py-20 text-center">
            <Building className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">
              {searchTerm
                ? t("organization.site&entities.noSearchResults")
                : t("organization.site&entities.noSite")}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Showing {(meta.page - 1) * meta.limit + 1}-
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`h-9 w-9 rounded-lg text-sm font-medium ${
                    pageNum === page
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {pageNum}
                </button>
              )
            )}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingSite ? "Edit Site Information" : "Add New Site"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={siteForm.handleSubmit(handleSave)}>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("organization.site&entities.siteName")} *
                  </label>
                  <input
                    {...siteForm.register("name", {
                      required: "Name is required",
                    })}
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                    placeholder="Example Site"
                  />
                  {siteForm.formState.errors.name && (
                    <p className="mt-1 text-xs text-destructive">
                      {siteForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Location
                  </label>
                  <input
                    {...siteForm.register("location")}
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Country
                    </label>
                    <input
                      {...siteForm.register("country")}
                      className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t("organization.site&entities.siteType")}
                    </label>
                    <select
                      {...siteForm.register("site_type")}
                      className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                    >
                      <option value="headquarters">
                        {t("organization.site&entities.headOffice")}
                      </option>
                      <option value="production">
                        {t("organization.site&entities.production")}
                      </option>
                      <option value="warehouse">
                        {t("organization.site&entities.warehouse")}
                      </option>
                      <option value="other">
                        {t("organization.site&entities.other")}
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("organization.site&entities.activity")}
                  </label>
                  <textarea
                    rows={4}
                    {...siteForm.register("activity")}
                    className="w-full rounded-lg border border-input bg-background p-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Revenue
                    </label>
                    <input
                      type="number"
                      {...siteForm.register("revenue", { valueAsNumber: true })}
                      className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t("organization.site&entities.employees") || "Employees"}
                    </label>
                    <input
                      type="number"
                      {...siteForm.register("employees_count", {
                        valueAsNumber: true,
                      })}
                      className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  {t("organization.site&entities.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSiteCreating || isSiteUpdating}
                  className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {isSiteCreating || isSiteUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingSite
                    ? t("organization.site&entities.update")
                    : t("organization.site&entities.add")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <DeleteAlertModal
        open={isDeleteModalOpen}
        setOpen={setIsDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        loading={isSiteDeleting}
        title="Are you sure ?"
        description="This will permanently remove this site from the system."
      />
    </div>
  )
}
