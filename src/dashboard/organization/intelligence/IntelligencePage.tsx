import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useDebouncedValue } from "@/hooks/Usedebouncedvalue"
import { useMyOrgRole } from "@/hooks/useMyOrgRole"
import {
  useAnalyzeIntelligenceMutation,
  useCreateRiskFromItemMutation,
  useGenerateMitigationsMutation,
  useGenerateRcsaMutation,
  useGetIntelligenceItemsQuery,
  useGetIntelligenceRunsQuery,
  usePredictTrendsMutation,
  useResilienceScanMutation,
  useScrapeIntelligenceMutation,
} from "@/redux/apis/organization/intelligence.api"
import type { IntelligenceItem } from "@/types/organization"
import { formatLocaleDate } from "@/utils/formatDate"
import { SEVERITY_STYLES } from "@/utils/severityStyles"
import {
  AlertCircle,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Globe,
  Loader2,
  Minus,
  Radio,
  Search,
  Shield,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { toast } from "sonner"
import {
  isMitigationsResult,
  isPredictResult,
  isRcsaResult,
  isResilienceScanResult,
} from "./intelligenceRunTypes"

const SEVERITIES = ["all", "critical", "high", "medium", "low"] as const
type SeverityFilter = (typeof SEVERITIES)[number]

// #78 round-2 audit finding: the trend panel always rendered TrendingUp
// regardless of predictResult.result.trend, so an "improving" trend showed
// the same up-arrow as "worsening" -- direction is the whole point of the
// icon here, so it must actually flip with the value.
const TREND_DISPLAY: Record<
  "worsening" | "stable" | "improving",
  { icon: typeof TrendingUp; className: string }
> = {
  worsening: { icon: TrendingUp, className: SEVERITY_STYLES.high.text },
  stable: { icon: Minus, className: "text-muted-foreground" },
  improving: { icon: TrendingDown, className: SEVERITY_STYLES.low.text },
}

// Extracts a readable message from an RTK Query rejected-mutation error,
// same convention as RiskApprovalControls.tsx / RiskRegisterPage.tsx.
const errorMessage = (err: unknown, fallback: string): string =>
  (err as { data?: { message?: string } })?.data?.message || fallback

export default function IntelligencePage() {
  const { t, i18n } = useTranslation()
  const role = useMyOrgRole()
  const canCreateRisk = role === "ADMIN" || role === "LEAD_AUDITOR"

  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 500)
  const [filterSeverity, setFilterSeverity] = useState<SeverityFilter>("all")
  const [page, setPage] = useState(1)
  const [creatingRiskId, setCreatingRiskId] = useState<string | null>(null)
  // Round-4 UX finding: Create Risk used to fire the mutation directly on
  // click, with zero chance to review the AI's analysis (severity,
  // summary, recommended actions) before a real risk record was created
  // from it. Holds the item awaiting confirmation; null means the dialog
  // is closed.
  const [confirmRiskItem, setConfirmRiskItem] =
    useState<IntelligenceItem | null>(null)

  // Reset to page 1 whenever the debounced search term changes, same
  // convention as SitesEntities.tsx.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  // Main displayed list -- all items (any analysis state), newest scraped
  // first (server default order). Search/severity filtering now happens
  // server-side (aexa-server#293/PR #295) -- the query results ARE the
  // filtered results, so no client-side filtering here.
  // quality-bar-loop round 2 (resilience, round-1 finding): isError was
  // never checked on any of the 5 queries below -- a genuine fetch
  // failure fell through to the default/empty states and rendered a
  // normal-looking "no items yet"/no-panel UI, byte-for-byte
  // indistinguishable from a real empty state. Same resilience gap
  // already fixed on 3 sibling pages this session.
  const {
    data: itemsData,
    isLoading: itemsLoading,
    isFetching: itemsFetching,
    isError: itemsError,
  } = useGetIntelligenceItemsQuery({
    page,
    limit: 20,
    searchTerm: debouncedSearch || undefined,
    severity: filterSeverity === "all" ? undefined : filterSeverity,
  })

  // Separate, small query just for the un-analyzed count so the "Analyze"
  // button's label is accurate regardless of what's currently paginated in
  // the main list above -- RTK Query caches this independently since the
  // args differ.
  const { data: unanalyzedData } = useGetIntelligenceItemsQuery({
    analyzed: false,
    page: 1,
    limit: 1,
  })
  const unanalyzedCount = unanalyzedData?.meta.total ?? 0

  const { data: predictRuns, isError: predictError } =
    useGetIntelligenceRunsQuery({
      run_type: "PREDICT",
      page: 1,
      limit: 1,
    })
  const { data: mitigationsRuns, isError: mitigationsError } =
    useGetIntelligenceRunsQuery({
      run_type: "MITIGATIONS",
      page: 1,
      limit: 1,
    })
  const { data: rcsaRuns, isError: rcsaError } = useGetIntelligenceRunsQuery({
    run_type: "RCSA",
    page: 1,
    limit: 1,
  })
  const { data: resilienceRuns, isError: resilienceError } =
    useGetIntelligenceRunsQuery({
      run_type: "RESILIENCE_SCAN",
      page: 1,
      limit: 1,
    })

  const [scrape, { isLoading: isScraping }] = useScrapeIntelligenceMutation()
  const [analyze, { isLoading: isAnalyzing }] = useAnalyzeIntelligenceMutation()
  const [predict, { isLoading: isPredicting }] = usePredictTrendsMutation()
  const [generateMitigations, { isLoading: isGeneratingMitigations }] =
    useGenerateMitigationsMutation()
  const [generateRcsa, { isLoading: isGeneratingRcsa }] =
    useGenerateRcsaMutation()
  const [resilienceScan, { isLoading: isScanningResilience }] =
    useResilienceScanMutation()
  const [createRiskFromItem] = useCreateRiskFromItemMutation()

  const handleScrape = async () => {
    try {
      const res = await scrape().unwrap()
      if (res.success) {
        toast.success(
          t("organization.intelligence.toasts.scrapeSuccess", {
            itemsNew: res.data.itemsNew,
            sourcesSucceeded: res.data.sourcesSucceeded,
            sourcesTotal: res.data.sourcesTotal,
          })
        )
      } else {
        toast.error(
          res.message || t("organization.intelligence.toasts.scrapeFailed")
        )
      }
    } catch (err) {
      toast.error(
        errorMessage(err, t("organization.intelligence.toasts.scrapeFailed"))
      )
    }
  }

  const handleAnalyze = async () => {
    try {
      const res = await analyze().unwrap()
      if (res.success) {
        toast.success(
          t("organization.intelligence.toasts.analyzeSuccess", {
            count: res.data.count,
          })
        )
      } else {
        toast.error(
          res.message || t("organization.intelligence.toasts.analyzeFailed")
        )
      }
    } catch (err) {
      toast.error(
        errorMessage(err, t("organization.intelligence.toasts.analyzeFailed"))
      )
    }
  }

  const handlePredict = async () => {
    try {
      const res = await predict().unwrap()
      if (res.success) {
        toast.success(t("organization.intelligence.toasts.predictSuccess"))
      } else {
        toast.error(
          res.message || t("organization.intelligence.toasts.predictFailed")
        )
      }
    } catch (err) {
      toast.error(
        errorMessage(err, t("organization.intelligence.toasts.predictFailed"))
      )
    }
  }

  const handleMitigations = async () => {
    try {
      const res = await generateMitigations().unwrap()
      if (res.success) {
        toast.success(t("organization.intelligence.toasts.mitigationsSuccess"))
      } else {
        toast.error(
          res.message || t("organization.intelligence.toasts.mitigationsFailed")
        )
      }
    } catch (err) {
      toast.error(
        errorMessage(
          err,
          t("organization.intelligence.toasts.mitigationsFailed")
        )
      )
    }
  }

  const handleRcsa = async () => {
    try {
      const res = await generateRcsa().unwrap()
      if (res.success) {
        toast.success(t("organization.intelligence.toasts.rcsaSuccess"))
      } else {
        toast.error(
          res.message || t("organization.intelligence.toasts.rcsaFailed")
        )
      }
    } catch (err) {
      toast.error(
        errorMessage(err, t("organization.intelligence.toasts.rcsaFailed"))
      )
    }
  }

  const handleResilienceScan = async () => {
    try {
      const res = await resilienceScan().unwrap()
      if (res.success) {
        toast.success(
          t("organization.intelligence.toasts.resilienceScanSuccess")
        )
      } else {
        toast.error(
          res.message ||
            t("organization.intelligence.toasts.resilienceScanFailed")
        )
      }
    } catch (err) {
      toast.error(
        errorMessage(
          err,
          t("organization.intelligence.toasts.resilienceScanFailed")
        )
      )
    }
  }

  const handleCreateRisk = async (item: IntelligenceItem) => {
    setCreatingRiskId(item.id)
    try {
      const res = await createRiskFromItem({ itemId: item.id }).unwrap()
      if (res.success) {
        toast.success(t("organization.intelligence.toasts.createRiskSuccess"))
      } else {
        toast.error(
          res.message || t("organization.intelligence.toasts.createRiskFailed")
        )
      }
    } catch (err) {
      toast.error(
        errorMessage(
          err,
          t("organization.intelligence.toasts.createRiskFailed")
        )
      )
    } finally {
      setCreatingRiskId(null)
    }
  }

  const items = itemsData?.data ?? []
  const meta = itemsData?.meta
  const totalPages = meta?.totalPage ?? 1

  const predictResult = predictRuns?.data[0]
  const mitigationsResult = mitigationsRuns?.data[0]
  const rcsaResult = rcsaRuns?.data[0]
  const resilienceResult = resilienceRuns?.data[0]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="animate-fade-in">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {t("organization.intelligence.title")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("organization.intelligence.subtitle")}
        </p>
      </div>

      {/* Action Bar -- primary ingestion actions (Scrape/Analyze) stay as
          prominent filled buttons; the four downstream AI-report actions
          (Predict/Mitigations/RCSA/Resilience Scan) are visually grouped
          into a single labeled cluster (#68) so the bar reads as "get data
          in" then "run a report", not six equal-weight buttons in a row.
          quality-bar-loop round 3 (mobile, round-1 finding): every
          button in this bar measured under the 44px touch-target
          guideline (40px for these two, 28px for the AI-report cluster
          below) -- same h-11 fix already shipped on 3 sibling pages this
          session. */}
      <div className="animate-slide-up flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleScrape}
          disabled={isScraping}
          className="flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40"
        >
          {isScraping ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          {isScraping
            ? t("organization.intelligence.actions.scraping")
            : t("organization.intelligence.actions.scrape")}
        </button>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing || unanalyzedCount === 0}
          className="flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground transition-all hover:opacity-90 disabled:opacity-40"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {isAnalyzing
            ? t("organization.intelligence.actions.analyzing")
            : t("organization.intelligence.actions.analyzeCount", {
                count: unanalyzedCount,
              })}
        </button>

        <div className="h-6 w-px bg-border" aria-hidden="true" />

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-1.5">
          <span className="pl-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("organization.intelligence.actions.aiReportsLabel")}
          </span>

          <button
            type="button"
            onClick={handlePredict}
            disabled={isPredicting}
            className="flex h-11 items-center gap-1.5 rounded-md bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-all hover:bg-muted disabled:opacity-40"
          >
            {isPredicting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {isPredicting
              ? t("organization.intelligence.actions.predicting")
              : t("organization.intelligence.actions.predict")}
          </button>

          <button
            type="button"
            onClick={handleMitigations}
            disabled={isGeneratingMitigations}
            className="flex h-11 items-center gap-1.5 rounded-md bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-all hover:bg-muted disabled:opacity-40"
          >
            {isGeneratingMitigations ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {isGeneratingMitigations
              ? t("organization.intelligence.actions.mitigationsRunning")
              : t("organization.intelligence.actions.mitigations")}
          </button>

          <button
            type="button"
            onClick={handleRcsa}
            disabled={isGeneratingRcsa}
            className="flex h-11 items-center gap-1.5 rounded-md bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-all hover:bg-muted disabled:opacity-40"
          >
            {isGeneratingRcsa ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ClipboardList className="h-3.5 w-3.5" />
            )}
            {isGeneratingRcsa
              ? t("organization.intelligence.actions.rcsaRunning")
              : t("organization.intelligence.actions.rcsa")}
          </button>

          <button
            type="button"
            onClick={handleResilienceScan}
            disabled={isScanningResilience}
            className="flex h-11 items-center gap-1.5 rounded-md bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-all hover:bg-muted disabled:opacity-40"
          >
            {isScanningResilience ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {isScanningResilience
              ? t("organization.intelligence.actions.resilienceScanRunning")
              : t("organization.intelligence.actions.resilienceScan")}
          </button>
        </div>
      </div>

      {/* quality-bar-loop round 2 (resilience, round-1 finding): a
          failed run-history fetch used to leave this panel simply
          absent -- indistinguishable from "no report has ever been
          run." Only shown when there's no (possibly stale) result
          already on screen to replace. */}
      {predictError && !predictResult && (
        <p role="alert" className="text-xs text-destructive">
          {t("organization.intelligence.sections.predictLoadError")}
        </p>
      )}
      {/* Predictions Panel */}
      {predictResult && isPredictResult(predictResult.result) && (
        <div className="animate-fade-in rounded-xl border border-primary/20 bg-primary/5 p-5">
          {/* quality-bar-loop round 4 (industry-standards, round-1
              finding): this panel used to give no indication of when it
              was generated -- IntelligenceRun.createdAt already exists
              on every run row (uniformly across all 4 report types,
              unlike rcsa_date/analysis_date which only exist on 2 of
              them), it just wasn't rendered. */}
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("organization.intelligence.sections.predictions")}
            </h2>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {t("organization.intelligence.sections.generatedOn", {
                date: formatLocaleDate(predictResult.createdAt, i18n.language),
              })}
            </span>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t("organization.intelligence.predictions.score7d")}
              </p>
              <p className="text-xl font-bold text-foreground">
                {predictResult.result.score_7d.toFixed(1)}
                <span className="text-xs text-muted-foreground">/10</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t("organization.intelligence.predictions.score30d")}
              </p>
              <p className="text-xl font-bold text-foreground">
                {predictResult.result.score_30d.toFixed(1)}
                <span className="text-xs text-muted-foreground">/10</span>
              </p>
            </div>
            {/* quality-bar-loop round 4 (industry-standards, round-1
                finding): PredictResult.confidence was already part of
                the typed AI response but was never rendered -- exactly
                the kind of AI-confidence signal a reference tool would
                surface alongside the scores it qualifies. */}
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t("organization.intelligence.predictions.confidence")}
              </p>
              <p className="text-xl font-bold text-foreground">
                {(predictResult.result.confidence * 100).toFixed(0)}
                <span className="text-xs text-muted-foreground">%</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t("organization.intelligence.predictions.trend")}
              </p>
              <p className="flex items-center gap-2 text-xl font-bold text-foreground">
                {(() => {
                  const { icon: TrendIcon, className } =
                    TREND_DISPLAY[predictResult.result.trend]
                  return <TrendIcon className={`h-4 w-4 ${className}`} />
                })()}
                {t(
                  `organization.intelligence.predictions.trend_${predictResult.result.trend}`
                )}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {predictResult.result.board_summary}
          </p>

          {predictResult.result.emerging_risks.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold text-foreground">
                {t("organization.intelligence.predictions.emergingRisks")}
              </p>
              <div className="space-y-1">
                {predictResult.result.emerging_risks.map((er, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <AlertTriangle
                      className={`h-3 w-3 shrink-0 ${SEVERITY_STYLES.high.text}`}
                    />
                    <span>{er.title}</span>
                    <span className="font-mono">
                      ({(er.probability * 100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mitigationsError && !mitigationsResult && (
        <p role="alert" className="text-xs text-destructive">
          {t("organization.intelligence.sections.mitigationsLoadError")}
        </p>
      )}
      {/* Mitigations Panel */}
      {mitigationsResult && isMitigationsResult(mitigationsResult.result) && (
        <div className="animate-fade-in rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("organization.intelligence.sections.mitigations")}
            </h2>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {t("organization.intelligence.sections.generatedOn", {
                date: formatLocaleDate(
                  mitigationsResult.createdAt,
                  i18n.language
                ),
              })}
            </span>
          </div>
          {mitigationsResult.result.mitigations.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("organization.intelligence.mitigations.empty")}
            </p>
          ) : (
            <div className="space-y-3">
              {mitigationsResult.result.mitigations.map((riskMitigation) => (
                <div
                  key={riskMitigation.risk_id}
                  className="rounded-lg border border-border p-3"
                >
                  {/* aexa-frontend#540: same risk_id -> risk cross-link
                      already applied a few sections down on this page for
                      item.created_risk_id -- this second mitigations-panel
                      instance was missed in that pass. */}
                  <Link
                    to={`/organization/risks/${riskMitigation.risk_id}`}
                    className="focus-ring mb-2 block text-sm font-medium text-primary hover:underline"
                  >
                    {riskMitigation.risk_name}
                  </Link>
                  <div className="space-y-2">
                    {riskMitigation.actions.map((action, i) => (
                      <div
                        key={i}
                        className="rounded-md bg-muted/50 p-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <RiskBadge level={action.priority} size="sm" />
                          <span className="font-medium text-foreground">
                            {action.title}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {action.description}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {t("organization.intelligence.mitigations.owner")}:{" "}
                          {action.owner} ·{" "}
                          {t(
                            "organization.intelligence.mitigations.effectiveness"
                          )}
                          : {(action.effectiveness_score * 100).toFixed(0)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {rcsaError && !rcsaResult && (
        <p role="alert" className="text-xs text-destructive">
          {t("organization.intelligence.sections.rcsaLoadError")}
        </p>
      )}
      {/* RCSA Panel */}
      {rcsaResult && isRcsaResult(rcsaResult.result) && (
        <div className="animate-fade-in rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("organization.intelligence.sections.rcsa")}
            </h2>
            {/* rcsa_date (the assessment's own as-of date, already part
                of the typed AI response) rather than the run row's
                createdAt -- more meaningful for an RCSA specifically. */}
            <span className="ml-auto text-[10px] text-muted-foreground">
              {t("organization.intelligence.sections.generatedOn", {
                date: formatLocaleDate(
                  rcsaResult.result.rcsa_date,
                  i18n.language
                ),
              })}
            </span>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {t("organization.intelligence.rcsa.controlEnvironmentScore")}
              </p>
              <p className="text-xl font-bold text-foreground">
                {rcsaResult.result.control_environment_score}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {t("organization.intelligence.rcsa.riskAppetite")}
              </p>
              <p className="text-sm font-medium text-foreground">
                {rcsaResult.result.overall_risk_appetite}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {rcsaResult.result.risk_universe.map((entry, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">
                  {entry.risk_category}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t("organization.intelligence.rcsa.inherent")}:{" "}
                  {entry.inherent_risk_score} ·{" "}
                  {t("organization.intelligence.rcsa.residual")}:{" "}
                  {entry.residual_risk_score} ·{" "}
                  {t("organization.intelligence.rcsa.controlEffectiveness")}:{" "}
                  {entry.control_effectiveness}
                </p>
              </div>
            ))}
          </div>
          {rcsaResult.result.key_control_deficiencies.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-foreground">
                {t("organization.intelligence.rcsa.deficiencies")}
              </p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {rcsaResult.result.key_control_deficiencies.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {resilienceError && !resilienceResult && (
        <p role="alert" className="text-xs text-destructive">
          {t("organization.intelligence.sections.resilienceLoadError")}
        </p>
      )}
      {/* Resilience Scan Panel */}
      {resilienceResult && isResilienceScanResult(resilienceResult.result) && (
        <div className="animate-fade-in rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("organization.intelligence.sections.resilienceScan")}
            </h2>
            {/* analysis_date (the scan's own as-of date, already part of
                the typed AI response) rather than the run row's
                createdAt. */}
            <span className="ml-auto text-[10px] text-muted-foreground">
              {t("organization.intelligence.sections.generatedOn", {
                date: formatLocaleDate(
                  resilienceResult.result.analysis_date,
                  i18n.language
                ),
              })}
            </span>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {t("organization.intelligence.resilience.overall")}
              </p>
              <p className="text-xl font-bold text-foreground">
                {resilienceResult.result.resilience_score.overall}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {t("organization.intelligence.resilience.supplyChain")}
              </p>
              <p className="text-xl font-bold text-foreground">
                {resilienceResult.result.resilience_score.supply_chain}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {t("organization.intelligence.resilience.financial")}
              </p>
              <p className="text-xl font-bold text-foreground">
                {resilienceResult.result.resilience_score.financial}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {t("organization.intelligence.resilience.geopolitical")}
              </p>
              <p className="text-xl font-bold text-foreground">
                {resilienceResult.result.resilience_score.geopolitical}
              </p>
            </div>
          </div>

          {resilienceResult.result.immediate_alerts.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold text-foreground">
                {t("organization.intelligence.resilience.immediateAlerts")}
              </p>
              <div className="space-y-2">
                {resilienceResult.result.immediate_alerts.map((alert, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <RiskBadge level={alert.severity} size="sm" />
                      <span className="text-sm font-medium text-foreground">
                        {alert.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {alert.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resilienceResult.result.resilience_score.top_vulnerabilities.length >
            0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-foreground">
                {t("organization.intelligence.resilience.topVulnerabilities")}
              </p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {resilienceResult.result.resilience_score.top_vulnerabilities.map(
                  (v, i) => (
                    <li key={i}>{v}</li>
                  )
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              "organization.intelligence.filters.searchPlaceholder"
            )}
            aria-label={t("organization.intelligence.filters.searchLabel")}
            className="h-11 w-full rounded-md border border-input bg-background pr-4 pl-9 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
          />
        </div>

        <div className="flex gap-1">
          {SEVERITIES.map((sev) => (
            <button
              key={sev}
              type="button"
              aria-pressed={filterSeverity === sev}
              onClick={() => {
                setFilterSeverity(sev)
                setPage(1)
              }}
              className={`flex h-11 items-center rounded-md px-3 text-xs font-medium transition-colors ${
                filterSeverity === sev
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t(`organization.intelligence.filters.severity_${sev}`)}
            </button>
          ))}
        </div>
        {itemsFetching && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Intelligence Items */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("organization.intelligence.sections.itemsCount", {
            count: meta?.total ?? 0,
          })}
        </h2>

        {itemsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : itemsError && items.length === 0 ? (
          // Replaces the item list (search/pagination included -- none of
          // it is meaningful without data) rather than letting a fetch
          // failure fall through to the empty state below, which would be
          // byte-for-byte indistinguishable from a genuinely empty org.
          // `items.length === 0` (not just `itemsError` alone) so a failed
          // REFETCH after an already-successful page (e.g. paginating,
          // changing the search/filter) keeps showing the still-valid
          // stale list RTK Query retains, instead of discarding real data
          // in favor of an error message -- same guard shape as the 4
          // report panels' `xError && !xResult` below.
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-destructive/60" />
            <p role="alert" className="text-sm text-destructive">
              {t("organization.intelligence.sections.itemsLoadError")}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Shield className="mb-3 h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">
              {t("organization.intelligence.sections.itemsEmpty")}
            </p>
            <p className="mt-1 text-xs">
              {t("organization.intelligence.sections.itemsEmptyHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80"
              >
                <div className="flex items-start gap-3">
                  {item.severity && (
                    <RiskBadge level={item.severity} size="sm" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    {item.risk_summary && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.risk_summary}
                      </p>
                    )}
                    {!item.risk_summary && item.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="font-medium">{item.source_name}</span>
                      {item.relevance_score != null && (
                        <>
                          <span>·</span>
                          <span className="font-mono">
                            {(item.relevance_score * 100).toFixed(0)}%
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {formatLocaleDate(item.scraped_at, i18n.language)}
                      </span>
                      {!item.analyzed_at && (
                        <>
                          <span>·</span>
                          <span>
                            {t("organization.intelligence.item.notAnalyzedYet")}
                          </span>
                        </>
                      )}
                    </div>

                    {canCreateRisk && item.analyzed_at && (
                      <div className="mt-2">
                        {item.created_risk_id ? (
                          <Link
                            // aexa-frontend#529: now links to the specific
                            // risk instead of the whole register list.
                            to={`/organization/risks/${item.created_risk_id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {t("organization.intelligence.item.viewRisk")}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRiskItem(item)}
                            disabled={creatingRiskId === item.id}
                            className="flex h-11 items-center gap-1 rounded-md border border-primary/40 px-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                          >
                            {creatingRiskId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Shield className="h-3 w-3" />
                            )}
                            {t("organization.intelligence.item.createRisk")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-11 items-center rounded-md border border-border px-3 text-xs disabled:opacity-40"
            >
              {t("organization.intelligence.pagination.previous")}
            </button>
            <span className="text-xs text-muted-foreground">
              {t("organization.intelligence.pagination.pageOf", {
                page,
                totalPages,
              })}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-11 items-center rounded-md border border-border px-3 text-xs disabled:opacity-40"
            >
              {t("organization.intelligence.pagination.next")}
            </button>
          </div>
        )}
      </div>

      {/* Round-4 UX finding: Create Risk fired the mutation directly on
          click with zero chance to review the AI's own analysis first --
          a formal risk record was created from a summary the user hadn't
          actually read. Surfaces the item's severity/summary/impact/
          recommended-actions before the real creation happens. */}
      <AlertDialog
        open={confirmRiskItem !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRiskItem(null)
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("organization.intelligence.createRiskConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>{t("organization.intelligence.createRiskConfirm.description")}</p>
                {confirmRiskItem && (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      {confirmRiskItem.severity && (
                        <RiskBadge level={confirmRiskItem.severity} />
                      )}
                      <span className="font-semibold text-foreground">
                        {confirmRiskItem.title}
                      </span>
                    </div>
                    {confirmRiskItem.risk_summary && (
                      <p className="text-muted-foreground">
                        {confirmRiskItem.risk_summary}
                      </p>
                    )}
                    {confirmRiskItem.potential_impact && (
                      <p>
                        <span className="font-medium text-foreground">
                          {t(
                            "organization.intelligence.createRiskConfirm.potentialImpact"
                          )}
                          :{" "}
                        </span>
                        <span className="text-muted-foreground">
                          {confirmRiskItem.potential_impact}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("organization.intelligence.createRiskConfirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRiskItem) handleCreateRisk(confirmRiskItem)
                setConfirmRiskItem(null)
              }}
            >
              {t("organization.intelligence.createRiskConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
