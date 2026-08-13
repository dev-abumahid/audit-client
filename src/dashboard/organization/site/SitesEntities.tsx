/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import UnscoredBadge from "@/components/dashboard/organization/UnscoredBadge"
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import Pagination from "@/components/shared/Pagination"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { useDebouncedValue } from "@/hooks/Usedebouncedvalue"
import { useModalA11y } from "@/hooks/useModalA11y"
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
import { getRiskSeverityLevel, isValidScoreValue } from "@/utils/riskScoring"
import { SEVERITY_STYLES } from "@/utils/severityStyles"
import {
  AlertTriangle,
  Bot,
  Brain,
  Building,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  PlusCircle,
  Save,
  Search,
  Shield,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router"
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

  // aexa-frontend#533: a ?siteId=&search= link (from FindingDetails.tsx)
  // pre-fills the search box with the target site's name so it's on page 1
  // regardless of which page it originally lived on -- see the highlight
  // effect below for the id match + auto-expand that completes the link.
  const [searchParams] = useSearchParams()
  const highlightSiteId = searchParams.get("siteId")

  // Search and pagination state
  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get("search") ?? ""
  )
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const debouncedSearch = useDebouncedValue(searchTerm, 500)
  const [expandedSite, setExpandedSite] = useState<string | null>(null)
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null)
  const highlightedRef = useRef<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteSiteId, setDeleteSiteId] = useState<string | null>(null)
  // quality-bar-loop round 3 (industry-standards/UX, the only finding both
  // axes independently converged on across 2 rounds): risk deletion used to
  // fire straight from the button's onClick with no confirmation step at
  // all, unlike site deletion 4 lines below -- one misclick permanently
  // removed a risk from the register. Mirrors the site-delete modal state
  // shape exactly.
  const [isRiskDeleteModalOpen, setIsRiskDeleteModalOpen] = useState(false)
  const [deleteRiskId, setDeleteRiskId] = useState<string | null>(null)

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
  // quality-bar-loop round 1 (resilience): neither of these two risk
  // queries checked isError -- the same "false all-clear" pattern fixed
  // repeatedly on Overview.tsx earlier this session (a fetch failure
  // rendered identically to "zero risks" with no error indication at
  // all). Unlike `useGetAllSitesQuery` above, which already handles its
  // own isError with a real error card, these two never got the same
  // treatment.
  // quality-bar-loop round 9 (resilience finding, open since round 1):
  // isLoading was never destructured here -- while this query is
  // in-flight, `riskData` is undefined, so `riskData?.data.length === 0`
  // is false (undefined !== 0) and the map fallback is also empty. The
  // expanded panel silently rendered nothing at all during a real
  // multi-second load, not even a false "0" -- no spinner, no content,
  // no indication anything was happening.
  const {
    data: riskData,
    isError: riskError,
    isLoading: isRiskLoading,
  } = useGetAllRisksQuery(
    {
      siteId: expandedSite ?? "",
      page: 1,
      limit: 100,
      searchTerm: "",
      category: "",
    },
    { skip: !expandedSite }
  )
  // Org-wide (unscoped by site) risk list, same limit:100/no-siteId shape
  // RiskMatrixPage.tsx uses, purely to drive the summary strip's aggregate
  // counts -- distinct from `riskData` above, which is scoped to whichever
  // single site is currently expanded.
  const { data: allRisksData, isError: allRisksError } = useGetAllRisksQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    category: "",
  })
  const allRisks: Risk[] = allRisksData?.data ?? []
  // The critical/AI-flagged tiles are filtered client-side over the
  // limit:100 page fetched above, so once an org has more than 100 risks
  // those two counts become a lower bound, not an exact total (unlike the
  // "Org-wide risks" tile, which uses the server's real meta.total). Flag
  // it with a "+" rather than silently under-reporting a headline stat.
  const isRiskSummaryCapped = (allRisksData?.meta?.total ?? 0) > allRisks.length
  // getRiskSeverityLevel silently maps a missing/malformed residual_score to
  // 0 ("low"), so filtering straight on its result would silently exclude
  // an unscored risk from this count -- not just mis-color a badge like the
  // other consumers of getRiskSeverityLevel, but actually hide a risk that
  // might really be critical from this headline stat. Unscored risks are
  // excluded from the count (their true severity is unknown) but flagged
  // via hasUnscoredRisks below so the tile reads as a lower bound, the same
  // "+" treatment isRiskSummaryCapped already uses for the 100-row cap.
  const hasUnscoredRisks = allRisks.some(
    (r) => !isValidScoreValue(r.residual_score)
  )
  const criticalRiskCount = allRisks.filter(
    (r) =>
      isValidScoreValue(r.residual_score) &&
      getRiskSeverityLevel(r.residual_score) === "critical"
  ).length
  const aiGeneratedRiskCount = allRisks.filter((r) => r.ai_generated).length
  const [deleteRisk, { isLoading: isRiskDeleting }] = useDeleteRiskMutation()
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

  // aexa-frontend#533: once the search-narrowed list resolves, auto-expand
  // + scroll + ring-highlight the site the link was for -- same
  // mechanism/reasoning as KriDashboardPage.tsx's ?highlight= effect
  // (#530), including the `sites.length`-not-`sites` dependency (a fresh
  // array reference every render would otherwise re-run this constantly)
  // and guarding against a no-op re-render vs. a genuine new navigation.
  // The DOM lookup itself is the "is this id actually in the current,
  // search-narrowed, current-page list" check -- no separate `.find()`
  // over `sites` needed, which also avoids depending on that fresh-
  // reference array directly.
  useEffect(() => {
    if (!highlightSiteId || sites.length === 0) return
    if (highlightedRef.current === highlightSiteId) return
    const el = document.getElementById(`site-${highlightSiteId}`)
    if (!el) return
    highlightedRef.current = highlightSiteId
    setExpandedSite(highlightSiteId)
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setActiveHighlight(highlightSiteId)
    const timeout = setTimeout(() => setActiveHighlight(null), 3000)
    return () => clearTimeout(timeout)
  }, [highlightSiteId, sites.length])

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

  const siteFormModalRef = useModalA11y(showForm, closeSiteForm)

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
      } else {
        // quality-bar-loop round 9 (resilience finding, open since round
        // 1): a non-throwing `success: false` response fell through
        // silently -- no toast, modal stayed open with no indication
        // anything went wrong. handleConfirmRiskDelete already has this
        // else branch; this brings the site-delete handler in line.
        toast.error(t("organization.site&entities.deleteSiteFailed"))
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

  const handleRiskDeleteModalOpen = (riskId: string) => {
    setIsRiskDeleteModalOpen(true)
    setDeleteRiskId(riskId)
  }

  const handleConfirmRiskDelete = async () => {
    if (!deleteRiskId) return
    try {
      const res = await deleteRisk(deleteRiskId).unwrap()
      if (res?.success) {
        toast.success(t("organization.site&entities.riskDeletedSuccess"))
        setIsRiskDeleteModalOpen(false)
        setDeleteRiskId(null)
      } else {
        toast.error(t("organization.site&entities.deleteRiskFailed"))
      }
    } catch (error: any) {
      // Translated fallback takes precedence over the raw backend message --
      // see the comment in handleAnalyzeSite's catch block (aexa-frontend#399).
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
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
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
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />{" "}
              {t("organization.site&entities.newSite")}
            </button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Building className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-mono-data text-xl font-bold text-foreground">
              {meta.total}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("organization.site&entities.summary.totalSites")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-mono-data text-xl font-bold text-foreground">
              {allRisksError ? "—" : (allRisksData?.meta?.total ?? allRisks.length)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("organization.site&entities.summary.totalRisks")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-risk-critical/10">
            <AlertTriangle className={`h-4 w-4 ${SEVERITY_STYLES.critical.text}`} />
          </div>
          <div>
            <p
              className={`font-mono-data text-xl font-bold ${SEVERITY_STYLES.critical.text}`}
              title={
                isRiskSummaryCapped
                  ? t("organization.site&entities.summary.cappedHint")
                  : hasUnscoredRisks
                    ? t("organization.site&entities.summary.unscoredHint")
                    : undefined
              }
            >
              {allRisksError ? (
                "—"
              ) : (
                <>
                  {criticalRiskCount}
                  {(isRiskSummaryCapped || hasUnscoredRisks) && "+"}
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("organization.site&entities.summary.criticalRisks")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p
              className="font-mono-data text-xl font-bold text-foreground"
              title={
                isRiskSummaryCapped
                  ? t("organization.site&entities.summary.cappedHint")
                  : undefined
              }
            >
              {allRisksError ? (
                "—"
              ) : (
                <>
                  {aiGeneratedRiskCount}
                  {isRiskSummaryCapped && "+"}
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("organization.site&entities.summary.aiGeneratedRisks")}
            </p>
          </div>
        </div>
      </div>

      {/* Sites List */}
      <div className="space-y-4">
        {sites.map((site: SiteSummary) => {
          const isExpanded = expandedSite === site.id

          return (
            <div
              key={site.id}
              id={`site-${site.id}`}
              className={`overflow-hidden rounded-xl border border-border bg-card transition-shadow ${
                activeHighlight === site.id
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : ""
              }`}
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

                {/* quality-bar-loop round 6 (review round 1 of PR #613):
                    gap-3 (12px) rather than gap-2 (8px) -- the kebab
                    trigger's before:-inset-1.5 (6px) and the chevron's
                    before:-inset-1 (4px) hit-slops extend toward each other
                    across this gap, and 6+4=10px > 8px would leave a ~2px
                    zone where both invisible hit areas overlapped, letting
                    a tap in that sliver hit the wrong (later-painted)
                    button. 12px gives both hit-slops room without
                    overlapping. */}
                <div className="flex flex-wrap items-center gap-3">
                  {canWrite && (
                    <button
                      type="button"
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
                    type="button"
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={t(
                            "organization.site&entities.moreActionsLabel",
                            { name: site.name }
                          )}
                          disabled={
                            isLoadingEditSite && editingSite?.id === site.id
                          }
                          className="focus-ring relative rounded-lg p-2 text-muted-foreground before:absolute before:-inset-1.5 before:content-[''] hover:bg-muted disabled:opacity-50"
                        >
                          {/* quality-bar-loop round 5 (mobile) bumped this to
                              p-3.5 (44x44px visible) to clear the touch-
                              target guideline, but round 6's visual-polish
                              judge caught the real regression: 44px visibly
                              overshoots the ~32px-tall "Analyze AI"/"Add
                              Risk" buttons right next to it, breaking the
                              row's visual rhythm. Reverted the VISIBLE size
                              back to p-2 (32x32px, matching its neighbors)
                              and instead extended the invisible CLICKABLE
                              area to 44x44px via a `before:` pseudo-element
                              with a negative inset -- the standard "hit
                              slop" pattern (WCAG 2.5.8 explicitly allows the
                              target size and the visible control to differ;
                              iOS/Android HIG recommend the same technique)
                              -- so mobile's touch-target requirement and
                              visual polish's alignment complaint are both
                              satisfied without trading one for the other. */}
                          {isLoadingEditSite && editingSite?.id === site.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreVertical className="h-4 w-4" />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(site)}>
                          <Pencil className="h-3.5 w-3.5" />
                          {t("organization.site&entities.editAction")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDeleteModalOpen(site.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("organization.site&entities.deleteAction")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedSite(isExpanded ? null : site.id)}
                    aria-expanded={isExpanded}
                    aria-label={t(
                      isExpanded
                        ? "organization.site&entities.collapseSiteLabel"
                        : "organization.site&entities.expandSiteLabel",
                      { name: site.name }
                    )}
                    className="relative rounded-lg p-2 text-muted-foreground before:absolute before:-inset-1 before:content-[''] hover:bg-muted"
                  >
                    {/* quality-bar-loop round 5/6 (mobile/visual-polish): see
                        the "more actions" trigger's comment above -- same
                        hit-slop fix, same reasoning. Visible box back to
                        p-2 (36x36px, matching its row neighbors), invisible
                        clickable area extended to 44x44px via `before:`. */}
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
                          type="button"
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

              {/* Expanded Risks Section */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                  <p className="mb-4 flex items-center justify-start gap-1.5 text-start text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    <Check className="h-3 w-3" />
                    {t("organization.site&entities.confirmedRisksHeading")}
                  </p>
                  {isRiskLoading ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : riskError ? (
                    <p role="alert" className="py-3 text-xs text-muted-foreground">
                      {t("organization.site&entities.riskLoadFailed")}
                    </p>
                  ) : riskData?.data.length === 0 ? (
                    <p className="py-3 text-xs text-muted-foreground">
                      {t("organization.site&entities.noConfirmedRisks")}
                    </p>
                  ) : (
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

                          <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                            {/* `items-start` sizes flex-col children to their
                                own content width instead of stretching them
                                -- without `w-full` here, `truncate`'s
                                overflow:hidden has nothing to clip against
                                and long text spills past the card instead of
                                being ellipsized (live-verified: a risk
                                description spilled off the right edge of the
                                mobile card). */}
                            {/* aexa-frontend#551: risk.id was already the
                                list key but rendered as plain text -- same
                                gap #548/#549/#550 fixed elsewhere. */}
                            <Link
                              to={`/organization/risks/${risk.id}`}
                              className="focus-ring w-full truncate text-sm font-medium text-primary hover:underline"
                            >
                              {risk.name}
                            </Link>
                            <p className="w-full truncate text-[10px] text-muted-foreground">
                              {risk.description?.slice(0, 120)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* A malformed residual_score would otherwise render
                              a confident severity color and a "NaN" label --
                              same treatment as RiskMatrixPage's RiskCard. */}
                          {isValidScoreValue(risk.residual_score) ? (
                            <RiskBadge
                              level={getRiskSeverityLevel(risk.residual_score)}
                              label={Number(risk.residual_score).toFixed(1)}
                              size="sm"
                            />
                          ) : (
                            <UnscoredBadge />
                          )}
                          <span
                            className={`flex items-center gap-1 rounded p-1.5 text-[9px] font-medium ${risk.ai_generated ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary"}`}
                          >
                            {risk.ai_generated ? (
                              <Bot className="h-2.5 w-2.5" />
                            ) : (
                              <User className="h-2.5 w-2.5" />
                            )}
                            {risk.ai_generated
                              ? t("organization.site&entities.aiGeneratedBadge")
                              : t("organization.site&entities.manualBadge")}
                          </span>
                          {canWrite && (
                            // quality-bar-loop round 5 (mobile): size="sm"
                            // resolves to h-6 (24px), roughly half the 44px
                            // touch-target guideline. Round 5 first fixed
                            // this with a plain `h-11` override, but round
                            // 6's visual-polish judge caught the real
                            // regression: a 44px-tall button next to this
                            // row's ~24px badges reads as an uneven, bolted-
                            // on baseline. Same hit-slop fix as the two icon
                            // buttons above: visible height stays h-6
                            // (matching its row neighbors), invisible
                            // clickable area extended via `before:`.
                            //
                            // Round 7 found 2 precise bugs in the first
                            // attempt (a uniform before:-inset-2.5 on all 4
                            // sides): (a) it also extended sideways into the
                            // gap-2 (8px) toward this row's "Manual"/"AI
                            // Generated" badge, live-measured to overlap it
                            // by 2px -- fixed by dropping the horizontal
                            // extension entirely (inset-x-0) since this
                            // button is already 71px wide, well over 44px,
                            // so it never needed one. (b) shadcn's Button
                            // includes its own `border border-transparent`
                            // (see buttonVariants in button.tsx) -- since an
                            // absolutely-positioned `before:`'s containing
                            // block is the padding box (border-box minus
                            // border-width) of its positioned ancestor, that
                            // 1px border ate 1px off each edge's reach,
                            // measuring a real 42px instead of 44px.
                            // -inset-y-[12px] closes the gap and adds a
                            // small safety margin -- live `elementFromPoint`
                            // edge-sampling (not just getComputedStyle,
                            // which can mask sub-pixel rounding at exact
                            // boundaries) confirmed -11px still landed 1px
                            // short at the exact edge; -12px measures a
                            // clean ≥44px real hit area with no ambiguity.
                            <Button
                              onClick={() => handleRiskDeleteModalOpen(risk.id)}
                              variant="destructive"
                              size="sm"
                              className="relative before:absolute before:inset-x-0 before:-inset-y-[12px] before:content-['']"
                            >
                              {t("organization.site&entities.deleteButton")}
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {sites.length === 0 && !isFetching && (
          <div className="rounded-xl border border-border bg-card py-20 text-center">
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
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={goToPage}
            prevAriaLabel={t("organization.site&entities.prevPage")}
            nextAriaLabel={t("organization.site&entities.nextPage")}
            label={t("organization.site&entities.showingRange", {
              from: (meta.page - 1) * meta.limit + 1,
              to: Math.min(meta.page * meta.limit, meta.total),
              total: meta.total,
            })}
          />
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeSiteForm}
        >
          <div
            ref={siteFormModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="site-form-modal-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 id="site-form-modal-title" className="text-xl font-semibold">
                {editingSite
                  ? t("organization.site&entities.editSiteTitle")
                  : t("organization.site&entities.addNewSiteTitle")}
              </h2>
              <button
                type="button"
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
      <DeleteAlertModal
        open={isRiskDeleteModalOpen}
        setOpen={setIsRiskDeleteModalOpen}
        onConfirm={handleConfirmRiskDelete}
        loading={isRiskDeleting}
        title={t("organization.site&entities.deleteRiskConfirmTitle")}
        description={t("organization.site&entities.deleteRiskConfirmDescription")}
      />
    </div>
  )
}
