import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import SiteFilter from "@/components/dashboard/organization/SiteFilter"
import UnscoredBadge from "@/components/dashboard/organization/UnscoredBadge"
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import { useMyOrgRole } from "@/hooks/useMyOrgRole"
import {
  useCreateActionFromBucketMutation,
  useCreateRiskLinkMutation,
  useDeleteRiskLinkMutation,
  useGetCorrelationMatrixDataQuery,
  useRunRootCauseBucketingMutation,
} from "@/redux/apis/organization/riskLink.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import type { IAction } from "@/types/finding"
import { riskCategoryLabel } from "@/utils/riskConfig"
import { getRiskSeverityLevel, isValidScoreValue } from "@/utils/riskScoring"
import type {
  Risk,
  RiskLink,
  RiskLinkType,
  RootCauseBucketingResult,
  RootCauseFindingBucket,
  RootCauseRiskBucket,
} from "@/types/organization"
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import type { FormEvent } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { toast } from "sonner"
import { severityBadgeClasses } from "@/utils/severityStyles"

// All user-facing chrome on this page routes through this namespace.
const NS = "organization.correlationMatrix"

// Same i18n keys and color scale used for this identical field in
// AllFindingsPage.tsx/FindingDetails.tsx/InspectionActions.tsx -- previously
// this page rendered f.priority raw/untranslated with only "High" special-
// cased, leaving Low/Medium indistinguishable in the UI.
const PRIORITY_KEYS: Record<string, string> = {
  Low: "organization.findings.priorityLow",
  Medium: "organization.findings.priorityMedium",
  High: "organization.findings.priorityHigh",
}
const PRIORITY_BADGES: Record<string, string> = {
  Low: severityBadgeClasses("low"),
  Medium: severityBadgeClasses("medium"),
  High: severityBadgeClasses("high"),
}

// quality-bar-loop round 5 (visual polish, round-1 finding): these
// root-cause/action info chips used bg-*-500/10 + text-*-700 with no
// dark: variant at all -- a dark-mode-only background computed
// against the card's own near-black surface, but the text color
// stayed the same medium-dark shade meant for a light background,
// producing a muddy, low-contrast pairing. Same
// bg-*-500/15 + dark:bg-*-400/15 + dark:text-*-400 pattern already
// established in SourceBadge.tsx/HeroProductVisual.tsx. Used at 3+
// call sites below, so extracted here rather than repeated inline.
// Light-mode amber uses -800/15 (not -700/10) to match
// HeroProductVisual.tsx's own measured finding: amber-700 computes to
// ~4.48:1 against this tint, just under the 4.5:1 AA floor for small
// text -- amber-800 was chosen there specifically for a real margin,
// so reusing the same weaker shade here would just reintroduce that
// same near-miss under a different className.
const INFO_CHIP_AMBER =
  "rounded bg-amber-500/15 p-2 text-amber-800 dark:bg-amber-400/15 dark:text-amber-400"
const INFO_CHIP_BLUE =
  "rounded bg-blue-500/10 p-2 text-blue-700 dark:bg-blue-400/15 dark:text-blue-400"

type MatrixSize = 3 | 4 | 5
type ViewMode = "risks" | "findings" | "buckets" | "ai-buckets"
// "rootcause" grouping was removed (aexa-frontend#393) -- it was a
// non-functional stub that labeled every risk "Simulated Root Cause"
// instead of doing real grouping. Real root-cause grouping already exists
// as the separate AI bucketing feature (viewMode "ai-buckets" /
// runAIBucketing below), so this stub was scrapped rather than reimplemented.
type GroupMode = "none" | "category"

interface RiskBucket {
  name: string
  category: string
  risks: Risk[]
  sites: string[]
  totalImpact: number
}

interface FindingBucket {
  name: string
  priority: string
  findings: IAction[]
  commonAction: string
}

// Same convention as RiskApprovalControls.tsx / RiskRegisterPage.tsx /
// IntelligencePage.tsx for reading a message out of an RTK Query rejected
// mutation error.
const errorMessage = (err: unknown, fallback: string): string =>
  (err as { data?: { message?: string } })?.data?.message || fallback

const LINK_TYPES: RiskLinkType[] = ["CAUSES", "AMPLIFIES", "CORRELATES"]

// Axis tick labels differ per matrix size and are count-specific phrasings, so
// each distinct label maps to its own i18n key (resolved with t() at render).
const AXIS_LABELS_MAP: Record<
  MatrixSize,
  { rootCause: string[]; consequence: string[] }
> = {
  3: {
    rootCause: ["axisCause0", "axisCause12", "axisCause3plus"],
    consequence: [
      "axisConsequence0",
      "axisConsequence12",
      "axisConsequence3plus",
    ],
  },
  4: {
    rootCause: ["axisCause0", "axisCause1", "axisCause2", "axisCause3plus"],
    consequence: [
      "axisConsequence0",
      "axisConsequence1",
      "axisConsequence2",
      "axisConsequence3plus",
    ],
  },
  5: {
    rootCause: [
      "axisCauseNone",
      "axisRootCause1",
      "axisRootCause2",
      "axisRootCause3",
      "axisRootCause4plus",
    ],
    consequence: [
      "axisConsequenceNone",
      "axisConsequence1",
      "axisConsequence2",
      "axisConsequence3",
      "axisConsequence4plus",
    ],
  },
}

// Same --risk-* solid-fill scale as RiskMatrixPage.tsx (both now reuse the
// landing page's HeroProductVisual ramp) instead of this page's own
// independently-invented red/orange/yellow/green-600 scale.
function getCellColor(row: number, col: number, size: MatrixSize): string {
  const score = (row + 1 + (col + 1)) / (size * 2)
  if (score >= 0.8) return "bg-risk-critical"
  if (score >= 0.6) return "bg-risk-high"
  if (score >= 0.4) return "bg-risk-medium"
  return "bg-risk-low"
}

function mapToAxis(value: number, size: MatrixSize): number {
  const max = size - 1
  if (size === 3) return value === 0 ? 0 : value <= 2 ? 1 : 2
  return Math.min(max, value)
}

export default function CorrelationMatrixPage() {
  const { t } = useTranslation()
  const role = useMyOrgRole()
  const canManageLinks = role === "ADMIN" || role === "LEAD_AUDITOR"

  // quality-bar-loop round 4 (resilience, the round-1 finding carried
  // forward): isError was never checked on either query -- a genuine
  // fetch failure fell through to `risks: []`/`links: []`/etc. below and
  // rendered a fully-formed, normal-looking empty matrix, byte-for-byte
  // indistinguishable from "this org genuinely has zero risks." Same
  // resilience gap RiskMatrixPage fixed in its own round 3.
  const {
    data: matrixResponse,
    isLoading: isMatrixLoading,
    isFetching: isMatrixFetching,
    isError: isMatrixError,
  } = useGetCorrelationMatrixDataQuery()
  const risks = useMemo(
    () => matrixResponse?.data.risks ?? [],
    [matrixResponse]
  )
  const links = useMemo(
    () => matrixResponse?.data.riskLinks ?? [],
    [matrixResponse]
  )
  // aexa-frontend#569: the Existing Links panel below shows each link's
  // source/target by ref -- resolve ref -> risk so those can link into the
  // risk's own detail page, same as RiskDetailCard/BucketList already do.
  const riskByRef = useMemo(
    () => new Map(risks.map((r) => [r.ref, r])),
    [risks]
  )
  const findings = useMemo(
    () => matrixResponse?.data.actions ?? [],
    [matrixResponse]
  )

  const { data: sitesResponse, isError: isSitesError } = useGetAllSitesQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })
  const sites = useMemo(() => sitesResponse?.data ?? [], [sitesResponse])

  const [createRiskLink, { isLoading: isCreatingLink }] =
    useCreateRiskLinkMutation()
  const [deleteRiskLink, { isLoading: isDeletingLink }] =
    useDeleteRiskLinkMutation()
  const [runRootCauseBucketing, { isLoading: isAILoading }] =
    useRunRootCauseBucketingMutation()
  const [createActionFromBucket] = useCreateActionFromBucketMutation()

  const [siteFilter, setSiteFilter] = useState<string | null>(null)
  const [linkPendingDelete, setLinkPendingDelete] = useState<RiskLink | null>(
    null
  )
  const [isDeleteLinkModalOpen, setIsDeleteLinkModalOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{
    row: number
    col: number
  } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("risks")
  const [groupMode, setGroupMode] = useState<GroupMode>("none")
  const [matrixSize, setMatrixSize] = useState<MatrixSize>(5)
  // Keyed by array index, not bucketName (aexa-frontend#194): bucketName is
  // AI-generated free text with no uniqueness guarantee, either within one
  // list or across the risk/finding lists (nothing stops the model from
  // reusing the same string for both), so name-keyed state could conflate
  // two distinct buckets. Index is safe here specifically because aiResult
  // is only ever replaced wholesale by a fresh "Analyze" run (setAiResult
  // below) -- never mutated, reordered, or partially updated in place --
  // so the array position stays stable for the entire lifetime of a given
  // aiResult. The risk/finding lists share this one expandedBucket state,
  // so a "risk-"/"finding-" prefix keeps their indices from colliding with
  // each other the same way a shared bucketName could.
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<RootCauseBucketingResult | null>(
    null
  )
  // "Send to Finding" per-bucket state (#191), riskBuckets only -- see the
  // comment above on why index instead of bucketName. Disables a bucket's
  // button after its own successful send, and resets whenever aiResult
  // itself changes (a new AI run) so a stale "sent" flag never survives
  // into buckets from a different analysis.
  const [sendingBucketIndex, setSendingBucketIndex] = useState<number | null>(
    null
  )
  const [sentBucketIndexes, setSentBucketIndexes] = useState<Set<number>>(
    new Set()
  )

  const [showLinkForm, setShowLinkForm] = useState(false)
  const [sourceRef, setSourceRef] = useState("")
  const [targetRef, setTargetRef] = useState("")
  const [linkType, setLinkType] = useState<RiskLinkType>("CAUSES")

  // riskGrid's cells are keyed by mapToAxis(matrixSize)-space coordinates,
  // which is a different coordinate space per matrixSize (3x3 buckets
  // consequences/root-causes into 3 bins, 5x5 into 5), and filteredRisks
  // (hence riskGrid's contents) changes with siteFilter too. A selectedCell
  // picked under one matrixSize/siteFilter can point at a row/col that is
  // out-of-range or simply means something different after either changes,
  // so any stale selection needs to be cleared rather than carried over
  // (aexa-frontend#257).
  useEffect(() => {
    setSelectedCell(null)
  }, [matrixSize, siteFilter])

  const filteredRisks = useMemo(() => {
    if (!siteFilter) return risks
    return risks.filter((r) => r.site_id === siteFilter)
  }, [risks, siteFilter])

  const filteredRefs = useMemo(
    () => new Set(filteredRisks.map((r) => r.ref)),
    [filteredRisks]
  )

  const riskMetrics = useMemo(() => {
    const causalLinks = links.filter(
      (l) => l.link_type === "CAUSES" || l.link_type === "AMPLIFIES"
    )
    const metrics: Record<
      string,
      { rootCauses: number; consequences: number }
    > = {}
    for (const risk of filteredRisks) {
      metrics[risk.ref] = {
        rootCauses: causalLinks.filter(
          (l) => l.target_ref === risk.ref && filteredRefs.has(l.source_ref)
        ).length,
        consequences: causalLinks.filter(
          (l) => l.source_ref === risk.ref && filteredRefs.has(l.target_ref)
        ).length,
      }
    }
    return metrics
  }, [filteredRisks, links, filteredRefs])

  const riskGrid = useMemo(() => {
    const grid: Record<string, Risk[]> = {}
    for (const risk of filteredRisks) {
      const m = riskMetrics[risk.ref]
      if (!m) continue
      const row = mapToAxis(m.rootCauses, matrixSize)
      const col = mapToAxis(m.consequences, matrixSize)
      const key = `${row}-${col}`
      if (!grid[key]) grid[key] = []
      grid[key].push(risk)
    }
    return grid
  }, [filteredRisks, riskMetrics, matrixSize])

  const riskBuckets = useMemo<RiskBucket[]>(() => {
    const bucketMap: Record<string, Risk[]> = {}
    for (const risk of filteredRisks) {
      const siteName =
        sites.find((s) => s.id === risk.site_id)?.name ||
        t(`${NS}.groupFallback`)
      const key = `${risk.category}::${siteName}`
      if (!bucketMap[key]) bucketMap[key] = []
      bucketMap[key].push(risk)
    }
    return Object.entries(bucketMap)
      .filter(([, rs]) => rs.length >= 2)
      .map(([key, rs]) => {
        const [category, site] = key.split("::")
        const categoryLabel = riskCategoryLabel(t, category)
        return {
          name: `${categoryLabel} — ${site}`,
          category,
          risks: rs,
          sites: [
            ...new Set(
              rs.map(
                (r) =>
                  sites.find((s) => s.id === r.site_id)?.name ||
                  t(`${NS}.groupFallback`)
              )
            ),
          ],
          totalImpact: rs.reduce(
            (sum, r) => sum + (r.financial_impact_max || 0),
            0
          ),
        }
      })
      .sort((a, b) => b.totalImpact - a.totalImpact)
  }, [filteredRisks, sites, t])

  const findingBuckets = useMemo<FindingBucket[]>(() => {
    const bucketMap: Record<string, IAction[]> = {}
    for (const f of findings) {
      const key = f.priority
      if (!bucketMap[key]) bucketMap[key] = []
      bucketMap[key].push(f)
    }
    return Object.entries(bucketMap)
      .filter(([, fs]) => fs.length >= 2)
      .map(([priority, fs]) => ({
        name: t(`${NS}.findingPriorityBucketName`, {
          priority: PRIORITY_KEYS[priority]
            ? t(PRIORITY_KEYS[priority])
            : priority,
        }),
        priority,
        findings: fs,
        commonAction: fs[0]?.actionDisc || t(`${NS}.actionToDefine`),
      }))
      .sort((a, b) => b.findings.length - a.findings.length)
  }, [findings, t])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedRisks = selectedCell
    ? riskGrid[`${selectedCell.row}-${selectedCell.col}`] || []
    : []

  const groupedSelectedRisks = useMemo(() => {
    if (groupMode === "none") return null
    const groups: Record<string, Risk[]> = {}
    for (const risk of selectedRisks) {
      const key = risk.category
      if (!groups[key]) groups[key] = []
      groups[key].push(risk)
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
  }, [selectedRisks, groupMode])

  const toggleBucket = useCallback((name: string) => {
    setExpandedBucket((prev) => (prev === name ? null : name))
  }, [])

  const runAIBucketing = async () => {
    try {
      const res = await runRootCauseBucketing().unwrap()
      if (res.success) {
        setAiResult(res.data)
        // New analysis run -- last run's "sent" flags no longer refer to
        // any bucket that still exists.
        setSentBucketIndexes(new Set())
        setViewMode("ai-buckets")
      } else {
        toast.error(res.message || t(`${NS}.aiBucketingFailed`))
      }
    } catch (err) {
      toast.error(errorMessage(err, t(`${NS}.aiBucketingFailed`)))
    }
  }

  const handleSendToFinding = async (
    bucket: RootCauseRiskBucket,
    index: number
  ) => {
    setSendingBucketIndex(index)
    try {
      const res = await createActionFromBucket({
        ...bucket.groupedAction,
        riskRefs: bucket.riskRefs,
      }).unwrap()
      if (res.success) {
        toast.success(t(`${NS}.sendToFindingSuccess`))
        setSentBucketIndexes((prev) => new Set(prev).add(index))
      } else {
        toast.error(res.message || t(`${NS}.sendToFindingFailed`))
      }
    } catch (err) {
      toast.error(errorMessage(err, t(`${NS}.sendToFindingFailed`)))
    } finally {
      setSendingBucketIndex(null)
    }
  }

  const resetLinkForm = () => {
    setShowLinkForm(false)
    setSourceRef("")
    setTargetRef("")
    setLinkType("CAUSES")
  }

  const handleCreateLink = async (e: FormEvent) => {
    e.preventDefault()
    if (!sourceRef || !targetRef) return
    if (sourceRef === targetRef) {
      toast.error(t(`${NS}.linkSelfRejected`))
      return
    }
    try {
      const res = await createRiskLink({
        source_ref: sourceRef,
        target_ref: targetRef,
        link_type: linkType,
      }).unwrap()
      if (res.success) {
        toast.success(t(`${NS}.linkCreatedToast`))
        resetLinkForm()
      } else {
        toast.error(res.message || t(`${NS}.linkCreateFailed`))
      }
    } catch (err) {
      toast.error(errorMessage(err, t(`${NS}.linkCreateFailed`)))
    }
  }

  const openDeleteLinkModal = (link: RiskLink) => {
    setLinkPendingDelete(link)
    setIsDeleteLinkModalOpen(true)
  }

  const confirmDeleteLink = async () => {
    // Same discarded-isLoading double-submission bug fixed for
    // RiskRegisterPage/aexa-frontend#620 -- the disabled button prop is the
    // primary guard, but a defensive check inside the handler closes the
    // theoretical window where a second call could land before a re-render
    // commits the disabled state.
    if (!linkPendingDelete || isDeletingLink) return

    try {
      const res = await deleteRiskLink(linkPendingDelete.id).unwrap()
      if (res.success) {
        toast.success(t(`${NS}.linkDeletedToast`))
        setIsDeleteLinkModalOpen(false)
        setLinkPendingDelete(null)
      } else {
        toast.error(res.message || t(`${NS}.linkDeleteFailed`))
      }
    } catch (err) {
      toast.error(errorMessage(err, t(`${NS}.linkDeleteFailed`)))
    }
  }

  const axisRaw = AXIS_LABELS_MAP[matrixSize]
  const axisLabels = {
    rootCause: axisRaw.rootCause.map((k) => t(`${NS}.${k}`)),
    consequence: axisRaw.consequence.map((k) => t(`${NS}.${k}`)),
  }

  if (isMatrixLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>{t(`${NS}.loadingMatrix`)}</p>
      </div>
    )
  }

  // Replaces the whole matrix (controls included -- none of them are
  // meaningful without data to filter/size/group) rather than letting a
  // fetch failure fall through to a normal-looking, fully-rendered but
  // completely empty matrix. Same full-page-replacement precedent
  // RiskMatrixPage's own round 3 established.
  if (isMatrixError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-2 text-center">
        <AlertCircle className="h-10 w-10 text-destructive/60" />
        <p role="alert" className="text-sm text-destructive">
          {t(`${NS}.loadError`)}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* This page's own useGetAllSitesQuery call (used for site-name
          lookups) failing doesn't block the matrix itself -- risks still
          render, just without a site name. Same resilience gap round-1
          flagged: previously zero indication anything failed. */}
      {isSitesError && (
        <p role="alert" className="text-xs text-destructive">
          {t(`${NS}.siteLoadError`)}
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {t(`${NS}.title`)}
            </h1>
            {isMatrixFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t(`${NS}.subtitle`)}</p>
          {/* quality-bar-loop round 7 (industry-standards, round-6 review
              finding): round 6's link to the real PageRank network view
              only lived inside the AI Buckets tab -- a user who never opens
              that tab never sees it, and every OTHER tab's cell colors are
              still the grid-position heuristic with no visible pointer to
              the real metric. Header-level placement is visible regardless
              of which of the four view modes (Risks/Buckets/Findings/AI
              Buckets) is active. */}
          <Link
            to="/organization/risk-graph"
            className="mt-1 flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            {t(`${NS}.viewFullNetworkAnalysis`)}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* quality-bar-loop round 2 (mobile, round-1 finding): these
              toggle buttons were 28px tall with zero gap between adjacent
              buttons (mis-tap risk), under the 44px touch-target
              guideline -- same fix RiskMatrixPage round 7 already
              shipped for its own identical toggle groups. */}
          {/* Matrix Size */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setMatrixSize(s as MatrixSize)}
                aria-pressed={matrixSize === s}
                className={`focus-ring flex h-11 min-w-11 items-center justify-center px-3 text-xs font-medium ${matrixSize === s ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                {s}×{s}
              </button>
            ))}
          </div>

          {/* Group Mode */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[
              ["none", "groupAll"],
              ["category", "groupByType"],
            ].map(([mode, labelKey]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setGroupMode(mode as GroupMode)}
                aria-pressed={groupMode === mode}
                className={`focus-ring flex h-11 items-center justify-center px-3 text-xs font-medium ${groupMode === mode ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                {t(`${NS}.${labelKey}`)}
              </button>
            ))}
          </div>

          {/* View Mode */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[
              ["risks", "viewRisks"],
              ["buckets", "viewBuckets"],
              ["findings", "viewFindings"],
              ["ai-buckets", "viewAiBuckets"],
            ].map(([mode, labelKey]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode as ViewMode)}
                aria-pressed={viewMode === mode}
                className={`focus-ring flex h-11 items-center justify-center px-3 text-xs font-medium ${viewMode === mode ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                {t(`${NS}.${labelKey}`)}
              </button>
            ))}
          </div>

          <SiteFilter
            value={siteFilter}
            onChange={setSiteFilter}
            className="w-56"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Matrix */}
        {/* aexa-frontend#473 -- h1 (above) was followed directly by h3s
            further down with no h2 in between, breaking heading-level order
            for screen-reader users. The matrix panel and the detail panel
            below are this page's two top-level sections, so each gets its
            own visually-hidden h2 -- the existing h3/h4 headings inside them
            stay nested exactly as they render today. */}
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h2 className="sr-only">{t(`${NS}.matrixSectionHeading`)}</h2>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t(`${NS}.consequencesAxis`)}
            </span>
          </div>

          {/* quality-bar-loop round 2 (mobile, round-1 finding): `isolate`
              gives this scroll region its own stacking context so the
              cell buttons' hover/selected z-20 (added below, to escape
              the sticky row-label column) can never paint above the
              legend/link-form content that used to sit inside this same
              wrapper -- same fix already verified on RiskMatrixPage. */}
          <div className="isolate overflow-auto">
            <div className="min-w-105">
              {/* Consequence Labels */}
              <div className="flex">
                <div className="w-32 shrink-0" />
                <div
                  className="mb-2 grid flex-1 gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${matrixSize}, 1fr)` }}
                >
                  {axisLabels.consequence.map((label, i) => (
                    <div
                      key={i}
                      className="text-center text-[10px] font-medium text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Matrix Rows */}
              {[...axisLabels.rootCause].reverse().map((label, reversedRow) => {
                const row = matrixSize - 1 - reversedRow
                return (
                  <div key={row} className="mb-2 flex items-center">
                    {/* quality-bar-loop round 2 (mobile, the axis's most
                        severe round-1 finding): this column used to
                        scroll away together with the grid cells inside
                        the same horizontal-scroll wrapper, so a phone
                        user couldn't see a cell's row label and a
                        rightmost-column cell at the same time --
                        measured live scrolling this off-screen (x:-151).
                        sticky+self-stretch+bg-card pins it to the scroll
                        container's left edge with an opaque background
                        covering the full row height, not just the
                        text's own line height. */}
                    <div className="sticky left-0 z-10 flex w-32 shrink-0 items-center justify-end self-stretch bg-card pr-3 text-right text-[10px] font-medium text-muted-foreground">
                      {label}
                    </div>
                    <div
                      className="grid flex-1 gap-1.5"
                      style={{
                        gridTemplateColumns: `repeat(${matrixSize}, 1fr)`,
                      }}
                    >
                      {axisLabels.consequence.map((_, col) => {
                        const cellKey = `${row}-${col}`
                        const cellRisks = riskGrid[cellKey] || []
                        const isSelected =
                          selectedCell?.row === row && selectedCell?.col === col

                        return (
                          // quality-bar-loop round 2 (mobile review):
                          // the sticky row-label column (z-10) would
                          // otherwise paint over the ~5% growth from
                          // hover:scale-105/the selected ring on a
                          // leftmost-column cell -- relative + z-20 on
                          // hover/selected lifts the cell above the
                          // label for exactly that moment. Same fix as
                          // RiskMatrixPage.
                          <button
                            key={col}
                            type="button"
                            onClick={() =>
                              setSelectedCell(
                                cellRisks.length ? { row, col } : null
                              )
                            }
                            aria-pressed={isSelected}
                            aria-label={t(`${NS}.cellRisksHeading`, {
                              count: cellRisks.length,
                              rootCause: label,
                              consequence: axisLabels.consequence[col],
                            })}
                            className={`focus-ring ${getCellColor(row, col, matrixSize)} relative flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg text-xs font-bold text-black transition-all hover:z-20 hover:scale-105 ${isSelected ? "z-20 scale-105 ring-2 ring-primary ring-offset-2" : ""} ${cellRisks.length ? "shadow-md" : "opacity-70"}`}
                          >
                            {cellRisks.length > 0 && (
                              <>
                                <span className="text-lg">
                                  {cellRisks.length}
                                </span>
                                <span className="text-[9px] opacity-90">
                                  {t(`${NS}.riskWord`, {
                                    count: cellRisks.length,
                                  })}
                                </span>
                              </>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <div className="mt-4 text-[10px] text-muted-foreground italic">
                {t(`${NS}.rootCausesAxis`)}
              </div>
            </div>
          </div>

          {/* quality-bar-loop round 2 (mobile, round-1 finding): this used
              to sit INSIDE the overflow-auto/min-w-105 wrapper above, so
              it inherited the grid's forced min-width and two full
              swatches rendered entirely outside the visible viewport at
              375px with no scroll affordance -- measured live. Moved
              outside the scroll wrapper so flex-wrap can do its job at
              the real container width. Same fix as RiskMatrixPage. */}
          {/* quality-bar-loop round 3 (visual polish, round-1 finding):
              this legend used to say "Systemic node/High interconnection/
              Moderate/Isolated" -- a one-off vocabulary invented just for
              this page -- while this SAME page's own RiskDetailCard (a
              few hundred pixels away) shows a RiskBadge reading
              "Critical/High/Medium/Low", the canonical shared severity
              vocabulary (src/utils/severityStyles.ts). Two labels for the
              same 4-bucket concept on one screen. Now pulling the label
              text from the same `riskLevel.*` i18n keys RiskBadge itself
              uses, exactly mirroring RiskMatrixPage's own round 9 fix.
              Swatch colors are unchanged. */}
          <div className="mt-6 flex flex-wrap gap-4">
            {[
              { color: "bg-risk-critical", label: t("riskLevel.critical") },
              { color: "bg-risk-high", label: t("riskLevel.high") },
              { color: "bg-risk-medium", label: t("riskLevel.medium") },
              { color: "bg-risk-low", label: t("riskLevel.low") },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded ${color}`} />
                <span className="text-xs text-muted-foreground">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Risk Links (create/delete) */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t(`${NS}.existingLinksHeading`, { count: links.length })}
              </h3>
              {canManageLinks && !showLinkForm && (
                <button
                  type="button"
                  onClick={() => setShowLinkForm(true)}
                  className="focus-ring flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t(`${NS}.addLink`)}
                </button>
              )}
            </div>

            {canManageLinks && showLinkForm && (
              <form
                onSubmit={handleCreateLink}
                className="mb-4 space-y-2 rounded-lg border border-border bg-background p-3"
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <select
                    aria-label={t(`${NS}.linkFormSourceLabel`)}
                    value={sourceRef}
                    onChange={(e) => {
                      const next = e.target.value
                      setSourceRef(next)
                      // The target <select> filters out whatever is
                      // currently selected as source -- if the user changes
                      // source to what target already held, clear target
                      // rather than leaving it pointed at a now-removed
                      // <option>.
                      if (next === targetRef) setTargetRef("")
                    }}
                    required
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">
                      {t(`${NS}.linkFormSourcePlaceholder`)}
                    </option>
                    {risks.map((r) => (
                      <option key={r.id} value={r.ref}>
                        {r.ref} — {r.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label={t(`${NS}.linkFormTargetLabel`)}
                    value={targetRef}
                    onChange={(e) => setTargetRef(e.target.value)}
                    required
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">
                      {t(`${NS}.linkFormTargetPlaceholder`)}
                    </option>
                    {risks
                      .filter((r) => r.ref !== sourceRef)
                      .map((r) => (
                        <option key={r.id} value={r.ref}>
                          {r.ref} — {r.name}
                        </option>
                      ))}
                  </select>

                  <select
                    aria-label={t(`${NS}.linkFormTypeLabel`)}
                    value={linkType}
                    onChange={(e) =>
                      setLinkType(e.target.value as RiskLinkType)
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {LINK_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(
                          `${NS}.linkType${type.charAt(0)}${type.slice(1).toLowerCase()}`
                        )}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetLinkForm}
                    className="focus-ring flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                    {t(`${NS}.linkFormCancel`)}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingLink}
                    className="focus-ring flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isCreatingLink && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {t(`${NS}.linkFormSubmit`)}
                  </button>
                </div>
              </form>
            )}

            {links.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {t(`${NS}.noLinksYet`)}
              </p>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-mono">
                      {riskByRef.has(link.source_ref) ? (
                        <Link
                          to={`/organization/risks/${riskByRef.get(link.source_ref)!.id}`}
                          className="focus-ring text-primary hover:underline"
                        >
                          {link.source_ref}
                        </Link>
                      ) : (
                        link.source_ref
                      )}
                      <span className="mx-1.5 text-muted-foreground">
                        {t(
                          `${NS}.linkType${link.link_type.charAt(0)}${link.link_type.slice(1).toLowerCase()}`
                        )}
                      </span>
                      {riskByRef.has(link.target_ref) ? (
                        <Link
                          to={`/organization/risks/${riskByRef.get(link.target_ref)!.id}`}
                          className="focus-ring text-primary hover:underline"
                        >
                          {link.target_ref}
                        </Link>
                      ) : (
                        link.target_ref
                      )}
                    </span>
                    {canManageLinks && (
                      <button
                        type="button"
                        onClick={() => openDeleteLinkModal(link)}
                        aria-label={t(`${NS}.deleteLinkLabel`, {
                          source: link.source_ref,
                          target: link.target_ref,
                        })}
                        className="focus-ring rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="sr-only">{t(`${NS}.detailSectionHeading`)}</h2>
          {viewMode === "risks" && (
            <>
              <h3 className="mb-3 text-sm font-semibold">
                {selectedCell
                  ? t(`${NS}.cellRisksHeading`, {
                      count: selectedRisks.length,
                      rootCause: axisLabels.rootCause[selectedCell.row],
                      consequence: axisLabels.consequence[selectedCell.col],
                    })
                  : t(`${NS}.selectCellHeading`)}
              </h3>

              {selectedRisks.length > 0 ? (
                <div className="max-h-130 space-y-3 overflow-y-auto">
                  {groupMode !== "none" && groupedSelectedRisks
                    ? groupedSelectedRisks.map(([key, grpRisks]) => (
                        <div key={key}>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs font-semibold">
                              {riskCategoryLabel(t, key)} ({grpRisks.length})
                            </span>
                          </div>
                          {grpRisks.map((risk) => (
                            <RiskDetailCard
                              key={risk.id}
                              risk={risk}
                              sites={sites}
                              riskMetrics={riskMetrics}
                            />
                          ))}
                        </div>
                      ))
                    : selectedRisks.map((risk) => (
                        <RiskDetailCard
                          key={risk.id}
                          risk={risk}
                          sites={sites}
                          riskMetrics={riskMetrics}
                        />
                      ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <GitBranch className="mb-2 h-10 w-10 opacity-30" />
                  <p>{t(`${NS}.clickCellHint`)}</p>
                </div>
              )}
            </>
          )}

          {viewMode === "buckets" && (
            <BucketList
              buckets={riskBuckets}
              expandedBucket={expandedBucket}
              toggleBucket={toggleBucket}
              sites={sites}
            />
          )}

          {viewMode === "findings" && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {t(`${NS}.findingsBucketsHeading`, {
                    count: findingBuckets.length,
                  })}
                </h3>
              </div>
              {findingBuckets.length > 0 ? (
                <div className="max-h-125 space-y-2 overflow-y-auto">
                  {findingBuckets.map((bucket) => (
                    <div
                      key={bucket.name}
                      className="rounded-lg border bg-background"
                    >
                      <button
                        type="button"
                        onClick={() => toggleBucket(bucket.name)}
                        aria-expanded={expandedBucket === bucket.name}
                        className="focus-ring flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
                      >
                        <div>
                          <p className="text-sm font-medium">{bucket.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {t(`${NS}.constatsCount`, {
                              count: bucket.findings.length,
                            })}
                          </p>
                        </div>
                        {expandedBucket === bucket.name ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      {expandedBucket === bucket.name && (
                        <div className="space-y-2 px-3 pb-3 text-xs">
                          <div className={INFO_CHIP_BLUE}>
                            {t(`${NS}.groupedAction`, {
                              action: bucket.commonAction,
                            })}
                          </div>
                          {bucket.findings.map((f) => (
                            <div key={f.id} className="flex justify-between">
                              <span>{f.actionTitle}</span>
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] ${PRIORITY_BADGES[f.priority] || "bg-muted text-muted-foreground"}`}
                              >
                                {PRIORITY_KEYS[f.priority]
                                  ? t(PRIORITY_KEYS[f.priority])
                                  : f.priority}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  {t(`${NS}.noFindingBuckets`)}
                </p>
              )}
            </div>
          )}

          {viewMode === "ai-buckets" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">
                    {t(`${NS}.aiBucketsHeading`)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={runAIBucketing}
                  disabled={isAILoading}
                  className="focus-ring flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isAILoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {isAILoading
                    ? t(`${NS}.aiAnalyzing`)
                    : t(`${NS}.aiRunAnalysis`)}
                </button>
              </div>

              {/* quality-bar-loop round 6 (industry-standards, round-1
                  finding): a cell's color here is a pure function of grid
                  position, not a real interconnection metric -- while a
                  genuine PageRank-based network view already exists at
                  /organization/risk-graph. Round 6 put a link to it here;
                  round 7 review flagged that as invisible on the other 3
                  tabs, so round 7 added a second copy at the page header
                  (visible on every tab, see above) and removed this one --
                  two identical, visually-adjacent "View full network
                  analysis" links on this one tab read as accidental
                  duplication, not a deliberate second CTA. */}

              {aiResult ? (
                <div className="space-y-4">
                  <p className="rounded bg-muted/50 p-2 text-[11px] text-muted-foreground italic">
                    {t(`${NS}.aiMethodologyLabel`, {
                      methodology: aiResult.methodology,
                    })}
                  </p>

                  <div>
                    <h4 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t(`${NS}.aiRiskBucketsHeading`)}
                    </h4>
                    <div className="space-y-2">
                      {aiResult.riskBuckets.map((bucket, index) => (
                        <AIRiskBucketCard
                          key={index}
                          bucket={bucket}
                          expanded={expandedBucket === `risk-${index}`}
                          onToggle={() => toggleBucket(`risk-${index}`)}
                          canSendToFinding={canManageLinks}
                          isSending={sendingBucketIndex === index}
                          isSent={sentBucketIndexes.has(index)}
                          onSendToFinding={() =>
                            handleSendToFinding(bucket, index)
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t(`${NS}.aiFindingBucketsHeading`)}
                    </h4>
                    <div className="space-y-2">
                      {aiResult.findingBuckets.map((bucket, index) => (
                        <AIFindingBucketCard
                          key={index}
                          bucket={bucket}
                          expanded={expandedBucket === `finding-${index}`}
                          onToggle={() => toggleBucket(`finding-${index}`)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Sparkles className="mb-3 h-12 w-12 opacity-30" />
                  <p>{t(`${NS}.aiEmptyHint`)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Link Modal -- every other delete action in this codebase
          (RiskRegisterPage, SitesEntities, InspectionTable, TemplatesPage,
          UploadNotesModal) confirms via this shared component first; this
          was the one delete action that fired immediately on click with no
          confirmation step at all. */}
      <DeleteAlertModal
        open={isDeleteLinkModalOpen}
        setOpen={setIsDeleteLinkModalOpen}
        title={t(`${NS}.deleteLinkConfirmTitle`)}
        description={t(`${NS}.deleteLinkConfirmDescription`)}
        onConfirm={confirmDeleteLink}
        loading={isDeletingLink}
      />
    </div>
  )
}

// Risk Detail Card
function RiskDetailCard({
  risk,
  sites,
  riskMetrics,
}: {
  risk: Risk
  sites: { id: string; name: string }[]
  riskMetrics: Record<string, { rootCauses: number; consequences: number }>
}) {
  const { t } = useTranslation()
  const siteName = sites.find((s) => s.id === risk.site_id)?.name
  const m = riskMetrics[risk.ref] || { rootCauses: 0, consequences: 0 }

  return (
    <div className="space-y-2 rounded-lg border bg-background p-3">
      <div className="flex justify-between">
        <div>
          <p className="font-mono text-xs text-primary">{risk.ref}</p>
          {/* aexa-frontend#549: risk.id/site_id were already on this card's
              data but rendered as plain text -- same gap #548 fixed on the
              functionally-identical RiskDetailCard in RiskMatrixPage.tsx. */}
          <Link
            to={`/organization/risks/${risk.id}`}
            className="focus-ring text-sm font-medium text-primary hover:underline"
          >
            {risk.name}
          </Link>
        </div>
        {isValidScoreValue(risk.residual_score) ? (
          <RiskBadge
            level={getRiskSeverityLevel(risk.residual_score)}
            size="sm"
          />
        ) : (
          <UnscoredBadge />
        )}
      </div>

      {siteName && (
        <Link
          to={`/organization/sites?siteId=${encodeURIComponent(risk.site_id)}&search=${encodeURIComponent(siteName)}`}
          className="focus-ring flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          <MapPin className="h-3 w-3" />
          {siteName}
        </Link>
      )}

      <p className="line-clamp-2 text-xs text-muted-foreground">
        {risk.description}
      </p>

      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>{t(`${NS}.detailCauses`, { count: m.rootCauses })}</span>
        <span>{t(`${NS}.detailConsequences`, { count: m.consequences })}</span>
      </div>
    </div>
  )
}

// Bucket List Component
function BucketList({
  buckets,
  expandedBucket,
  toggleBucket,
  sites,
}: {
  buckets: RiskBucket[]
  expandedBucket: string | null
  toggleBucket: (name: string) => void
  sites: { id: string; name: string }[]
}) {
  const { t } = useTranslation()
  if (buckets.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        {t(`${NS}.notEnoughRisks`)}
      </p>
    )
  }

  return (
    <div className="max-h-130 space-y-2 overflow-y-auto">
      {buckets.map((bucket) => (
        <div key={bucket.name} className="rounded-lg border bg-background">
          <button
            type="button"
            onClick={() => toggleBucket(bucket.name)}
            aria-expanded={expandedBucket === bucket.name}
            className="focus-ring flex w-full justify-between p-3 text-left hover:bg-muted/50"
          >
            <div>
              <p className="font-medium">{bucket.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {/* aexa-frontend#376 -- totalImpact sums financial_impact_max
                    values, which are stored in k€ (per the risk form's own
                    "k€" label); divide by 1,000 for M€, not 1,000,000. */}
                {t(`${NS}.bucketMeta`, {
                  count: bucket.risks.length,
                  impact: (bucket.totalImpact / 1000).toFixed(1),
                })}
              </p>
            </div>
            {expandedBucket === bucket.name ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {expandedBucket === bucket.name && (
            <div className="space-y-2 border-t p-3 text-xs">
              {bucket.risks.map((risk) => {
                const siteName = sites.find((s) => s.id === risk.site_id)?.name
                return (
                  <div
                    key={risk.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{risk.ref}</span>
                      <Link
                        to={`/organization/risks/${risk.id}`}
                        className="focus-ring truncate text-primary hover:underline"
                      >
                        {risk.name}
                      </Link>
                    </div>
                    {siteName && (
                      <Link
                        to={`/organization/sites?siteId=${encodeURIComponent(risk.site_id)}&search=${encodeURIComponent(siteName)}`}
                        className="focus-ring text-[10px] text-primary hover:underline"
                      >
                        {siteName}
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// AI risk-bucket card (real POST /risk/root-cause-bucketing shape).
function AIRiskBucketCard({
  bucket,
  expanded,
  onToggle,
  canSendToFinding,
  isSending,
  isSent,
  onSendToFinding,
}: {
  bucket: RootCauseRiskBucket
  expanded: boolean
  onToggle: () => void
  canSendToFinding: boolean
  isSending: boolean
  isSent: boolean
  onSendToFinding: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border bg-background">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="focus-ring flex w-full justify-between p-3 text-left hover:bg-muted/50"
      >
        <div>
          <p className="font-medium">{bucket.bucketName}</p>
          <p className="text-[10px] text-muted-foreground">
            {t(`${NS}.aiBucketMeta`, {
              count: bucket.riskRefs.length,
              score: bucket.pageRankScore,
            })}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t p-3 text-xs">
          <div className={INFO_CHIP_AMBER}>
            {t(`${NS}.aiRootCauseLabel`, { cause: bucket.rootCause })}
          </div>
          <div className={INFO_CHIP_BLUE}>
            {t(`${NS}.aiActionLabel`, {
              action: bucket.groupedAction.description,
            })}
          </div>
          <div className="text-muted-foreground">
            {t(`${NS}.aiImpactRangeLabel`, {
              min: bucket.aggregatedImpactMin,
              max: bucket.aggregatedImpactMax,
            })}
          </div>
          <div className="text-muted-foreground">
            {t(`${NS}.aiOwnerLabel`, { owner: bucket.groupedAction.owner })}
          </div>
          <div className="text-muted-foreground">
            {t(`${NS}.aiEstRiskReductionLabel`, {
              value: bucket.groupedAction.estimatedRiskReduction,
            })}
          </div>
          {bucket.dominoRisk && (
            <div
              className={`rounded p-2 ${severityBadgeClasses("critical")}`}
            >
              {t(`${NS}.aiDominoRiskLabel`, { risk: bucket.dominoRisk })}
            </div>
          )}

          {canSendToFinding && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onSendToFinding}
                disabled={isSending || isSent}
                className="focus-ring flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isSent ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                {isSending
                  ? t(`${NS}.sendToFindingSending`)
                  : isSent
                    ? t(`${NS}.sendToFindingSent`)
                    : t(`${NS}.sendToFinding`)}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// AI finding-bucket card (real POST /risk/root-cause-bucketing shape).
function AIFindingBucketCard({
  bucket,
  expanded,
  onToggle,
}: {
  bucket: RootCauseFindingBucket
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border bg-background">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="focus-ring flex w-full justify-between p-3 text-left hover:bg-muted/50"
      >
        <div>
          <p className="font-medium">{bucket.bucketName}</p>
          <p className="text-[10px] text-muted-foreground">
            {t(`${NS}.aiFindingRefsLabel`, {
              count: bucket.findingRefs.length,
            })}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t p-3 text-xs">
          <div className={INFO_CHIP_AMBER}>
            {t(`${NS}.aiRootCauseLabel`, { cause: bucket.rootCause })}
          </div>
          <div className={INFO_CHIP_BLUE}>
            {t(`${NS}.aiActionLabel`, {
              action: bucket.commonAction.description,
            })}
          </div>
          <div className="text-muted-foreground">
            {t(`${NS}.aiOwnerLabel`, { owner: bucket.commonAction.owner })}
          </div>
        </div>
      )}
    </div>
  )
}
