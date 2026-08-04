/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import { Button } from "@/components/ui/button"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { useDebouncedValue } from "@/hooks/Usedebouncedvalue"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import enTranslations from "@/i18n/locales/en.json"
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
  useLazyGetSiteByIdQuery,
  useUpdateSiteMutation,
} from "@/redux/apis/organization/sites.api"
import type { RiskSuggestion } from "@/types/ai"
import type { Risk, SiteSummary } from "@/types/organization"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
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
// This is a plain function outside any component, so it can't use the
// useTranslation() hook — it resolves each label straight from the English
// locale resource instead (the AI is always prompted in English, regardless
// of the UI's active language), without needing a live i18next instance.
const matchKnownCategory = (aiCategory: string): string => {
  const normalized = aiCategory.trim().toLowerCase()
  const match = Object.entries(RISK_CATEGORIES).find(([key, cat]) => {
    // Falls back to the key match alone if a labelKey ever has no matching
    // en.json entry, rather than crashing on .toLowerCase() of undefined —
    // this function's whole point is a safe fallback, so a key-parity slip
    // must degrade gracefully here too, not become a harder failure than
    // the "no match at all" case it's designed to already tolerate.
    const label = (
      enTranslations.organization.riskCategories as Record<
        string,
        string | undefined
      >
    )[cat.labelKey]?.toLowerCase()
    return (
      key.toLowerCase() === normalized ||
      label === normalized ||
      label?.includes(normalized) ||
      (label !== undefined && normalized.includes(label))
    )
  })
  return match ? match[0] : aiCategory
}

// AI returns a qualitative High/Medium/Low label for these two scores. The
// Risk model stores them as Int?, and src/utils/riskScoring.ts documents the
// real scale used everywhere else in the app: 0-100, with >75 critical,
// >50 high, >25 medium, else low (aexa-ai's risk-generation prompts spec
// inherent_risk_score/residual_risk_score as 0-100). Map each qualitative
// label into the matching severity band on that scale, rather than a 1-10
// guess that made every AI-imported "High" risk render as "low" severity
// (aexa-frontend#398).
const mapQualitativeScore = (level: string): number => {
  const normalized = level.trim().toLowerCase()
  // riskScoring.ts's bands are >75 critical / >50 high / >25 medium / else
  // low -- 70 lands inside the "high" band itself rather than spilling into
  // "critical" the way 80 would (found in review round 1: aexa-frontend#398).
  if (normalized === "high") return 70
  if (normalized === "medium") return 50
  if (normalized === "low") return 20
  return 50
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
}

interface RiskFormValues {
  status: string
  name: string
  category: string
  description: string
}

export default function SitesEntities() {
  const { t } = useTranslation()
  // aexa-frontend#217
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)

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
  const [fetchSiteById] = useLazyGetSiteByIdQuery()
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
  const [editingSite, setEditingSite] = useState<SiteSummary | null>(null)
  // GET /site's list select omits site_type (see SiteSummary's comment in
  // types/organization.d.ts), so opening Edit fetches the single-site
  // detail first rather than trusting the list row -- otherwise the form's
  // site_type fallback silently reset every site to "production"
  // (aexa-frontend#401). Tracked separately from isSiteUpdating/isFetching
  // so the Edit button can show its own brief loading state.
  const [isLoadingEditSite, setIsLoadingEditSite] = useState(false)

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
  // Same pattern as latestAnalysisRequestRef above, for the edit-detail
  // fetch (aexa-frontend#401): nothing stops clicking Edit on a different
  // site (or clicking "New Site") while a previous openEdit's fetchSiteById
  // is still in flight. Without this guard, a slow response for a site the
  // user has since moved away from would silently overwrite whatever form
  // is currently on screen, or clear its loading spinner out from under it.
  // Set to the site id whose result is still wanted; null means no edit
  // fetch's result should be applied (e.g. after openCreate or closing the
  // modal). Found in review round 1.
  const latestEditRequestRef = useRef<string | null>(null)

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

  // aexa-frontend#265: deleting the last site on the last page shrinks
  // totalPages without any filter change (the debouncedSearch effect above
  // only resets page on a SEARCH change), stranding the user on an
  // out-of-range empty page. Delete-path counterpart to #234/#243.
  useClampPageToTotal(page, totalPages, setPage)

  const openCreate = () => {
    // Invalidate any in-flight openEdit detail fetch so a slow response
    // that resolves after switching to "New Site" can't silently populate
    // this blank form with the previous site's data (found in review
    // round 1: aexa-frontend#401).
    latestEditRequestRef.current = null
    setEditingSite(null)
    setIsLoadingEditSite(false)
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

  const closeSiteForm = () => {
    // Same guard as openCreate: closing the modal shouldn't leave a stale
    // fetch free to reopen it (via an error toast) or repopulate it if the
    // user reopens Edit on a different site before this one's request
    // settles.
    latestEditRequestRef.current = null
    setIsLoadingEditSite(false)
    setShowForm(false)
  }

  const openEdit = async (site: SiteSummary) => {
    latestEditRequestRef.current = site.id
    setEditingSite(site)
    // Pre-fill from the list row immediately so the modal isn't blank while
    // the detail fetch below is in flight; site_type is corrected once that
    // resolves.
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

    setIsLoadingEditSite(true)
    try {
      const res = await fetchSiteById(site.id).unwrap()
      // The user may have moved on to a different site's edit form (or
      // closed/created) while this request was in flight -- discard a late
      // result rather than clobbering whatever's now on screen (found in
      // review round 1: aexa-frontend#401).
      if (latestEditRequestRef.current !== site.id) return
      const fullSite = res?.success ? res.data : undefined
      if (fullSite) {
        siteForm.reset({
          name: fullSite.name,
          location: fullSite.location || "",
          country: fullSite.country || "",
          activity: fullSite.activity || "",
          revenue: fullSite.revenue || 0,
          employees_count: fullSite.employees_count || 0,
          site_type: fullSite.site_type || "production",
        })
      } else {
        // A 200 response with success: false (or no data) is still a
        // failure to load the real detail -- keep the list-row prefill and
        // surface it the same way a network/unwrap rejection does below.
        toast.error(t("organization.site&entities.loadSiteDetailFailed"))
      }
    } catch {
      if (latestEditRequestRef.current !== site.id) return
      // Detail fetch failed -- keep the list-row prefill (including its
      // "production" site_type fallback) rather than blocking the edit
      // form; the user can still correct the dropdown manually.
      toast.error(t("organization.site&entities.loadSiteDetailFailed"))
    } finally {
      if (latestEditRequestRef.current === site.id) {
        setIsLoadingEditSite(false)
      }
    }
  }

  const handleSave = async (values: SiteFormValues) => {
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
            ? t("organization.site&entities.siteUpdatedSuccess")
            : t("organization.site&entities.siteCreatedSuccess")
        )
        closeSiteForm()
      }
    } catch (error: any) {
      toast.error(t("organization.site&entities.saveSiteFailed"))
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
        toast.success(t("organization.site&entities.siteDeletedSuccess"))
        setIsDeleteModalOpen(false)
        setDeleteSiteId(null)
      }
    } catch (error) {
      toast.error(t("organization.site&entities.deleteSiteFailed"))
    }
  }

  const handleAnalyzeSite = async (site: SiteSummary) => {
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
        toast(t("organization.site&entities.noAdditionalRisks"))
      }
    } catch (error: any) {
      if (latestAnalysisRequestRef.current !== site.id) return
      // Prefer the translated fallback over the raw backend message: the
      // backend always responds in English regardless of the UI's active
      // language, so leading with error?.data?.message leaked English text
      // into a French UI even when a correct FR string already existed
      // (aexa-frontend#399).
      toast.error(
        t("organization.site&entities.aiRiskAnalysisFailed") ||
          error?.data?.message,
      )
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
        toast.error(
          t("organization.site&entities.importRiskFailed", {
            title: suggestion.title,
          }),
        )
      }
    }
    setImportingIds(new Set())
    if (importedCount > 0) {
      toast.success(
        importedCount === 1
          ? t("organization.site&entities.riskImportedSingle")
          : t("organization.site&entities.riskImportedMultiple", {
              count: importedCount,
            })
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
    if (!values.status || !values.name) {
      // Belt-and-suspenders guard for a state bug that slips past RHF's own
      // required validation (which already renders inline errors below) --
      // still needs its own toast so the form doesn't fail completely
      // silently in that case (aexa-frontend#425).
      toast.error(t("organization.site&entities.riskRequiredFieldsMissing"))
      return
    }
    const payload = { ...values, site_id: siteId }
    try {
      const res = await createNewRisk(payload).unwrap()
      if (res?.success) {
        toast.success(t("organization.site&entities.riskCreatedSuccess"))
        setShowRiskForm(null)
      } else {
        toast.error(t("organization.site&entities.createRiskFailed"))
      }
    } catch (error: any) {
      // Keep the inline risk form open on failure so the user doesn't lose
      // what they typed and can retry, same as handleSave above. Translated
      // fallback takes precedence over the raw backend message -- see the
      // comment in handleAnalyzeSite's catch block (aexa-frontend#399).
      toast.error(
        t("organization.site&entities.createRiskFailed") || error?.data?.message,
      )
    }
  }

  const handleRiskDelete = async (id: string) => {
    try {
      const res = await deleteRisk(id).unwrap()
      if (res?.success) {
        toast.success(t("organization.site&entities.riskDeletedSuccess"))
      } else {
        toast.error(t("organization.site&entities.deleteRiskFailed"))
      }
    } catch (error: any) {
      // Direct action button, no confirmation modal/form state to reset here
      // (unlike handleSave/handleConfirmDelete above). Translated fallback
      // takes precedence over the raw backend message -- see the comment in
      // handleAnalyzeSite's catch block (aexa-frontend#399).
      toast.error(
        t("organization.site&entities.deleteRiskFailed") || error?.data?.message,
      )
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
            {t("organization.site&entities.errorLoadingSitesTitle")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("organization.site&entities.errorLoadingSitesDescription")}
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
              placeholder={t("organization.site&entities.searchPlaceholder")}
              aria-label={t("organization.site&entities.searchSitesLabel")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pr-4 pl-10 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            />
            {isFetching && (
              <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {canWrite && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />{" "}
              {t("organization.site&entities.newSite")}
            </button>
          )}
        </div>
      </div>

      {/* Sites List */}
      <div className="space-y-4">
        {sites.map((site: SiteSummary) => {
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

                      {/* Site/SiteSummary has no ai_generated/is_edited fields
                          (unlike compliance obligations), so sites are always
                          manually-sourced -- isEdited is meaningless without
                          aiGenerated ever being true and was removed rather
                          than fed a fake value. */}
                      <SourceBadge aiGenerated={false} isEdited={false} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[
                        site.activity,
                        site.location &&
                          `${t("organization.site&entities.siteLocationLabel")}: ${site.location}`,
                        site.country &&
                          `${t("organization.site&entities.siteCountryLabel")}: ${site.country}`,
                      ]
                        .filter(Boolean)
                        .join(" • ") ||
                        t("organization.site&entities.noAdditionalDetails")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canWrite && (
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
                  )}

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

                  {canWrite && (
                    <>
                      <button
                        onClick={() => openEdit(site)}
                        disabled={
                          isLoadingEditSite && editingSite?.id === site.id
                        }
                        aria-label={t(
                          "organization.site&entities.editSiteLabel",
                          { name: site.name }
                        )}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {isLoadingEditSite && editingSite?.id === site.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Pencil className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteModalOpen(site.id)}
                        aria-label={t(
                          "organization.site&entities.deleteSiteLabel",
                          { name: site.name }
                        )}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setExpandedSite(isExpanded ? null : site.id)}
                    aria-expanded={isExpanded}
                    aria-label={t(
                      isExpanded
                        ? "organization.site&entities.collapseSiteLabel"
                        : "organization.site&entities.expandSiteLabel",
                      { name: site.name }
                    )}
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
                        {t("organization.site&entities.riskNameLabel")}{" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <input
                        {...riskForm.register("name", {
                          required: t(
                            "organization.site&entities.riskNameRequired",
                          ),
                        })}
                        placeholder={t(
                          "organization.site&entities.enterRiskNamePlaceholder",
                        )}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors placeholder:text-muted-foreground/50 hover:border-primary/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                      {riskForm.formState.errors.name && (
                        <p className="mt-1 text-xs text-destructive">
                          {riskForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("organization.site&entities.statusLabel")}{" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <select
                        {...riskForm.register("status", {
                          required: t(
                            "organization.site&entities.riskStatusRequired",
                          ),
                        })}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors hover:border-primary/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        <option value="open">
                          {t("organization.site&entities.statusOpen")}
                        </option>
                        <option value="in_progress">
                          {t("organization.site&entities.statusInProgress")}
                        </option>
                        <option value="completed">
                          {t("organization.site&entities.statusCompleted")}
                        </option>
                        <option value="closed">
                          {t("organization.site&entities.statusClosed")}
                        </option>
                      </select>
                      {riskForm.formState.errors.status && (
                        <p className="mt-1 text-xs text-destructive">
                          {riskForm.formState.errors.status.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("organization.site&entities.categoryLabel")}
                      </label>
                      <select
                        {...riskForm.register("category")}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors hover:border-primary/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        {Object.entries(RISK_CATEGORIES).map(([key, cat]) => (
                          <option key={key} value={key}>
                            {t(`organization.riskCategories.${cat.labelKey}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("organization.site&entities.descriptionLabel")}
                    </label>
                    <textarea
                      {...riskForm.register("description")}
                      placeholder={t(
                        "organization.site&entities.describeRiskPlaceholder",
                      )}
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
                        {t("organization.site&entities.aiSuggestedRisksHeading")}
                      </p>
                      {canWrite && (
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
                          {t("organization.site&entities.importSelected", {
                            count: selectedSuggestionIds.size,
                          })}
                        </button>
                      )}
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
                                {t("organization.site&entities.inherentLabel")}{" "}
                                {suggestion.inherent_risk_score}
                              </span>
                              <span>
                                {t("organization.site&entities.residualLabel")}{" "}
                                {suggestion.residual_risk_score}
                              </span>
                              <span>
                                {t(
                                  "organization.site&entities.probabilityLabel",
                                )}{" "}
                                {Math.round(suggestion.Probability * 100)}%
                              </span>
                              <span>
                                {t("organization.site&entities.velocityLabel")}{" "}
                                {suggestion.Velocity}
                              </span>
                              <span>
                                {t("organization.site&entities.trendLabel")}{" "}
                                {suggestion.Trend}
                              </span>
                              {suggestion.Responsable && (
                                <span>
                                  {t(
                                    "organization.site&entities.suggestedOwnerLabel",
                                  )}{" "}
                                  {suggestion.Responsable}
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
                    ✅ {t("organization.site&entities.confirmedRisksHeading")}
                  </p>
                  <div className="space-y-1.5">
                    {riskData?.data.map((risk: Risk) => (
                      <div
                        key={risk.id}
                        className="flex flex-col justify-between gap-2 rounded-lg border-2 border-accent/30 bg-accent/5 p-3 sm:flex-row sm:items-center"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">
                            {risk.ref}
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
                            level={getRiskSeverityLevel(risk.residual_score)}
                            label={Number(risk.residual_score).toFixed(1)}
                            size="sm"
                          />
                          <span
                            className={`rounded p-1.5 text-[9px] font-medium ${risk.ai_generated ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary"}`}
                          >
                            {risk.ai_generated
                              ? `🤖 ${t("organization.site&entities.aiGeneratedBadge")}`
                              : `👤 ${t("organization.site&entities.manualBadge")}`}
                          </span>
                          {canWrite && (
                            <Button
                              onClick={() => handleRiskDelete(risk.id)}
                              variant="destructive"
                              size="sm"
                            >
                              {t("organization.site&entities.deleteButton")}
                              <Trash2 />
                            </Button>
                          )}
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
            {t("organization.site&entities.showingRange", {
              from: (meta.page - 1) * meta.limit + 1,
              to: Math.min(meta.page * meta.limit, meta.total),
              total: meta.total,
            })}
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
          onClick={closeSiteForm}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingSite
                  ? t("organization.site&entities.editSiteTitle")
                  : t("organization.site&entities.addNewSiteTitle")}
              </h2>
              <button
                onClick={closeSiteForm}
                aria-label={t("organization.site&entities.closeModalLabel")}
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
                      required: t("organization.site&entities.nameRequired"),
                      // RHF's `required` rule only checks truthiness, so a
                      // whitespace-only name (e.g. "   ") passes it and used
                      // to fall through to a silent `if (!values.name.trim())
                      // return` in handleSave, making Save appear to do
                      // nothing. Mirrors the risk-creation form's own fix in
                      // this same file (aexa-frontend#425/PR #455).
                      validate: (v) =>
                        v.trim().length > 0 ||
                        t("organization.site&entities.nameRequired"),
                    })}
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                    placeholder={t(
                      "organization.site&entities.exampleSitePlaceholder",
                    )}
                  />
                  {siteForm.formState.errors.name && (
                    <p className="mt-1 text-xs text-destructive">
                      {siteForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("organization.site&entities.siteLocationLabel")}
                  </label>
                  <input
                    {...siteForm.register("location")}
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t("organization.site&entities.siteCountryLabel")}
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
                      {t("organization.site&entities.revenueLabel")}
                    </label>
                    <input
                      type="number"
                      {...siteForm.register("revenue", { valueAsNumber: true })}
                      className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t("organization.site&entities.employees")}
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
                  onClick={closeSiteForm}
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
        title={t("organization.site&entities.deleteSiteConfirmTitle")}
        description={t("organization.site&entities.deleteSiteConfirmDescription")}
      />
    </div>
  )
}
