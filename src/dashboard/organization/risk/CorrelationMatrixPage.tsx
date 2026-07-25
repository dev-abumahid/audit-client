/* eslint-disable @typescript-eslint/no-explicit-any */
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import SiteFilter from "@/components/dashboard/organization/SiteFilter"
import type { Risk } from "@/types/organization"
import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  Layers,
  Loader2,
  MapPin,
  Send,
  Sparkles,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

// All user-facing chrome on this page routes through this namespace; the mock
// fixtures below stay untranslated (seed data, not UI chrome).
const NS = "organization.correlationMatrix"

type MatrixSize = 3 | 4 | 5
type ViewMode = "risks" | "findings" | "buckets" | "ai-buckets"
type GroupMode = "none" | "category" | "rootcause"

interface RiskLink {
  id: string
  source_ref: string
  target_ref: string
  link_type: string
}

interface AuditFinding {
  id: string
  ref: string
  title: string
  severity: string
  cause?: string
  recommendation?: string
}

interface RiskBucket {
  name: string
  category: string
  risks: Risk[]
  sites: string[]
  totalImpact: number
}

interface FindingBucket {
  name: string
  severity: string
  findings: AuditFinding[]
  commonAction: string
}

// This page stays fixture-driven for now: the real correlation engine (a
// risk-to-risk RiskLink backend model) is deliberately deferred — see #142,
// whose core "should we build this" question stays open. What #142 does
// resolve, and what this file now reflects, is the type-safety landmine: the
// mock fixtures were built around a divergent LOCAL `Risk` type carrying a
// human-readable `ref` field that the shared `Risk` in organization.d.ts
// does not have (it keys risks by UUID `id`). The fixtures below now conform
// to the shared `Risk` shape and correlate on `id`, so a future real-API
// wiring pass doesn't inherit a `.ref`-vs-`.id` mismatch.
const RISK_IDS = {
  ransomware: "3f8b1c2a-9d4e-4f5a-8b1c-2a9d4e4f5a01",
  supplyChain: "7a2e5d9c-1b3f-4c6d-8e0a-2b3f4c6d8e02",
  gdpr: "b4d6f8a0-2c4e-4a6b-8d0f-2c4e4a6b8d03",
  fx: "c5e7a9b1-3d5f-4b7c-9e1a-3d5f4b7c9e04",
  siteAccident: "d6f8b0c2-4e6a-4c8d-0f2b-4e6a4c8d0f05",
} as const

// Full UUID `id`s overflow the compact ref labels, so show only the first
// block for long ids while short ids (e.g. test fixtures) render in full; the
// full id is always preserved in a title tooltip. Mirrors RiskGraphPage's
// shortRef so both pages truncate ids identically.
const REF_LABEL_MAX = 12
const shortRef = (id: string) =>
  id.length > REF_LABEL_MAX ? id.slice(0, 8) : id

// Dummy Data
const DUMMY_RISKS: Risk[] = [
  {
    id: RISK_IDS.ransomware,
    org_account_id: "org-1",
    name: "Cyberattaque ransomware",
    description: "Risque de blocage des systèmes",
    category: "cyber",
    inherent_score: 22,
    residual_score: 14,
    pagerank_score: 88,
    financial_impact_min: 500000,
    financial_impact_max: 2500000,
    probability: 0.75,
    velocity: "fast",
    trend: "up",
    status: "open",
    ai_generated: true,
    is_edited: false,
    site_id: "site1",
    control_design_eff: 0,
    control_operating_eff: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: RISK_IDS.supplyChain,
    org_account_id: "org-1",
    name: "Rupture chaîne approvisionnement",
    description: "Dépendance fournisseur unique",
    category: "operational",
    inherent_score: 19,
    residual_score: 16,
    pagerank_score: 75,
    financial_impact_min: 400000,
    financial_impact_max: 1800000,
    probability: 0.85,
    velocity: "medium",
    trend: "up",
    status: "open",
    ai_generated: false,
    is_edited: false,
    site_id: "site2",
    control_design_eff: 0,
    control_operating_eff: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: RISK_IDS.gdpr,
    org_account_id: "org-1",
    name: "Non-conformité RGPD",
    description: "Manque de consentement données",
    category: "compliance",
    inherent_score: 16,
    residual_score: 10,
    pagerank_score: 62,
    financial_impact_min: 200000,
    financial_impact_max: 1200000,
    probability: 0.45,
    velocity: "slow",
    trend: "stable",
    status: "open",
    ai_generated: false,
    is_edited: false,
    site_id: "site1",
    control_design_eff: 0,
    control_operating_eff: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: RISK_IDS.fx,
    org_account_id: "org-1",
    name: "Fluctuation taux de change",
    description: "Exposition devises émergentes",
    category: "financial",
    inherent_score: 13,
    residual_score: 8,
    pagerank_score: 58,
    financial_impact_min: 100000,
    financial_impact_max: 600000,
    probability: 0.6,
    velocity: "medium",
    trend: "stable",
    status: "open",
    ai_generated: false,
    is_edited: false,
    site_id: "site3",
    control_design_eff: 0,
    control_operating_eff: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: RISK_IDS.siteAccident,
    org_account_id: "org-1",
    name: "Accident grave site",
    description: "Risque industriel majeur",
    category: "operational",
    inherent_score: 21,
    residual_score: 18,
    pagerank_score: 91,
    financial_impact_min: 800000,
    financial_impact_max: 3200000,
    probability: 0.55,
    velocity: "fast",
    trend: "up",
    status: "open",
    ai_generated: false,
    is_edited: false,
    site_id: "site2",
    control_design_eff: 0,
    control_operating_eff: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
]

const DUMMY_LINKS: RiskLink[] = [
  {
    id: "l1",
    source_ref: RISK_IDS.supplyChain,
    target_ref: RISK_IDS.ransomware,
    link_type: "CAUSES",
  },
  {
    id: "l2",
    source_ref: RISK_IDS.gdpr,
    target_ref: RISK_IDS.ransomware,
    link_type: "AMPLIFIES",
  },
  {
    id: "l3",
    source_ref: RISK_IDS.fx,
    target_ref: RISK_IDS.supplyChain,
    link_type: "CAUSES",
  },
  {
    id: "l4",
    source_ref: RISK_IDS.siteAccident,
    target_ref: RISK_IDS.supplyChain,
    link_type: "CAUSES",
  },
]

const DUMMY_FINDINGS: AuditFinding[] = [
  {
    id: "f1",
    ref: "F-2025-01",
    title: "Faible contrôle accès systèmes",
    severity: "high",
    cause: "Manque de MFA",
    recommendation: "Implémenter authentification forte",
  },
  {
    id: "f2",
    ref: "F-2025-02",
    title: "Données clients non chiffrées",
    severity: "critical",
    cause: "Stockage non sécurisé",
    recommendation: "Chiffrer les données sensibles",
  },
  {
    id: "f3",
    ref: "F-2025-03",
    title: "Fournisseur unique critique",
    severity: "high",
    cause: "Dépendance excessive",
    recommendation: "Diversifier les fournisseurs",
  },
]

const DUMMY_SITES = [
  { id: "site1", name: "Siège Paris" },
  { id: "site2", name: "Usine Lyon" },
  { id: "site3", name: "Bureau Marseille" },
]

// Category display labels resolve to i18n keys at render time; colors stay
// literal (design tokens, not user-facing text).
const RISK_CATEGORIES = {
  cyber: { labelKey: "catCyber", color: "#ef4444" },
  operational: { labelKey: "catOperational", color: "#f59e0b" },
  compliance: { labelKey: "catCompliance", color: "#8b5cf6" },
  financial: { labelKey: "catFinancial", color: "#10b981" },
}

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

function getCellColor(row: number, col: number, size: MatrixSize): string {
  const score = (row + 1 + (col + 1)) / (size * 2)
  if (score >= 0.8) return "bg-red-600"
  if (score >= 0.6) return "bg-orange-600"
  if (score >= 0.4) return "bg-yellow-600"
  return "bg-green-600"
}

function mapToAxis(value: number, size: MatrixSize): number {
  const max = size - 1
  if (size === 3) return value === 0 ? 0 : value <= 2 ? 1 : 2
  return Math.min(max, value)
}

export default function CorrelationMatrixPage() {
  const { t } = useTranslation()
  const [risks] = useState(DUMMY_RISKS)
  const [links] = useState(DUMMY_LINKS)
  const [findings] = useState(DUMMY_FINDINGS)
  const [sites] = useState(DUMMY_SITES)

  const [siteFilter, setSiteFilter] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<{
    row: number
    col: number
  } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("risks")
  const [groupMode, setGroupMode] = useState<GroupMode>("none")
  const [matrixSize, setMatrixSize] = useState<MatrixSize>(5)
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null)
  const [aiBuckets, setAIBuckets] = useState<any[]>([])
  const [isAILoading, setIsAILoading] = useState(false)
  const [sendingBucket, setSendingBucket] = useState<string | null>(null)

  const filteredRisks = useMemo(() => {
    if (!siteFilter) return risks
    return risks.filter((r) => r.site_id === siteFilter)
  }, [risks, siteFilter])

  const filteredRefs = useMemo(
    () => new Set(filteredRisks.map((r) => r.id)),
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
      metrics[risk.id] = {
        rootCauses: causalLinks.filter(
          (l) => l.target_ref === risk.id && filteredRefs.has(l.source_ref)
        ).length,
        consequences: causalLinks.filter(
          (l) => l.source_ref === risk.id && filteredRefs.has(l.target_ref)
        ).length,
      }
    }
    return metrics
  }, [filteredRisks, links, filteredRefs])

  const riskGrid = useMemo(() => {
    const grid: Record<string, Risk[]> = {}
    for (const risk of filteredRisks) {
      const m = riskMetrics[risk.id]
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
        const cat = RISK_CATEGORIES[category as keyof typeof RISK_CATEGORIES]
        const categoryLabel = cat ? t(`${NS}.${cat.labelKey}`) : category
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
    const bucketMap: Record<string, AuditFinding[]> = {}
    for (const f of findings) {
      const key = `${f.severity}::${f.cause || "general"}`
      if (!bucketMap[key]) bucketMap[key] = []
      bucketMap[key].push(f)
    }
    return Object.entries(bucketMap)
      .filter(([, fs]) => fs.length >= 2)
      .map(([key, fs]) => {
        const [severity] = key.split("::")
        return {
          name: `${severity.charAt(0).toUpperCase() + severity.slice(1)} — ${fs[0]?.cause || t(`${NS}.generalFallback`)}`,
          severity,
          findings: fs,
          commonAction: fs[0]?.recommendation || t(`${NS}.actionToDefine`),
        }
      })
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
      const key =
        groupMode === "category"
          ? risk.category
          : t(`${NS}.simulatedRootCause`)
      if (!groups[key]) groups[key] = []
      groups[key].push(risk)
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
  }, [selectedRisks, groupMode, t])

  const toggleBucket = useCallback((name: string) => {
    setExpandedBucket((prev) => (prev === name ? null : name))
  }, [])

  const runAIBucketing = () => {
    setIsAILoading(true)
    setTimeout(() => {
      const dummyAIBuckets = [
        {
          bucketName: "Dépendance Fournisseurs Critiques",
          rootCause: "Manque de diversification des fournisseurs stratégiques",
          riskRefs: [RISK_IDS.supplyChain, RISK_IDS.siteAccident],
          sitesAffected: ["Usine Lyon"],
          aggregatedImpactMax: 5000000,
          groupedAction: {
            description:
              "Identifier et qualifier au moins deux fournisseurs alternatifs",
            normReference: "ISO 28000",
            owner: "Supply Chain Manager",
            estimatedRiskReduction: 45,
          },
          dominoRisk: "Risque de propagation cyber via fournisseurs",
        },
      ]
      setAIBuckets(dummyAIBuckets)
      setViewMode("ai-buckets")
      setIsAILoading(false)
    }, 1500)
  }

  const handleSendBucketToFindings = (bucket: any) => {
    setSendingBucket(bucket.bucketName)
    setTimeout(() => {
      alert(t(`${NS}.findingCreatedAlert`, { bucket: bucket.bucketName }))
      setSendingBucket(null)
    }, 800)
  }

  const axisRaw = AXIS_LABELS_MAP[matrixSize]
  const axisLabels = {
    rootCause: axisRaw.rootCause.map((k) => t(`${NS}.${k}`)),
    consequence: axisRaw.consequence.map((k) => t(`${NS}.${k}`)),
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              {t(`${NS}.title`)}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">{t(`${NS}.subtitle`)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Matrix Size */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setMatrixSize(s as MatrixSize)}
                className={`px-3 py-1.5 text-xs font-medium ${matrixSize === s ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
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
              ["rootcause", "groupRootCause"],
            ].map(([mode, labelKey]) => (
              <button
                key={mode}
                onClick={() => setGroupMode(mode as GroupMode)}
                className={`px-3 py-1.5 text-xs font-medium ${groupMode === mode ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
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
                onClick={() => setViewMode(mode as ViewMode)}
                className={`px-3 py-1.5 text-xs font-medium ${viewMode === mode ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
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
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t(`${NS}.consequencesAxis`)}
            </span>
          </div>

          <div className="overflow-auto">
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
                    <div className="w-32 pr-3 text-right text-[10px] font-medium text-muted-foreground">
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
                          <button
                            key={col}
                            onClick={() =>
                              setSelectedCell(
                                cellRisks.length ? { row, col } : null
                              )
                            }
                            className={`${getCellColor(row, col, matrixSize)} flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg text-xs font-bold text-white transition-all hover:scale-105 ${isSelected ? "scale-105 ring-2 ring-primary ring-offset-2" : ""} ${cellRisks.length ? "shadow-md" : "opacity-70"}`}
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

              {/* Legend */}
              <div className="mt-6 flex flex-wrap gap-4">
                {[
                  { color: "bg-red-600", labelKey: "legendSystemic" },
                  { color: "bg-orange-600", labelKey: "legendHighInterconnection" },
                  { color: "bg-yellow-600", labelKey: "legendModerate" },
                  { color: "bg-green-600", labelKey: "legendIsolated" },
                ].map(({ color, labelKey }) => (
                  <div key={labelKey} className="flex items-center gap-1.5">
                    <div className={`h-3 w-3 rounded ${color}`} />
                    <span className="text-xs text-muted-foreground">
                      {t(`${NS}.${labelKey}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="rounded-xl border border-border bg-card p-5">
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
                              {key} ({grpRisks.length})
                            </span>
                          </div>
                          {grpRisks.map((risk) => (
                            <RiskDetailCard
                              key={risk.id}
                              risk={risk}
                              sites={sites}
                              riskMetrics={riskMetrics}
                              links={links}
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
                          links={links}
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
                        onClick={() => toggleBucket(bucket.name)}
                        className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
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
                          <div className="rounded bg-blue-500/10 p-2 text-blue-700">
                            {t(`${NS}.groupedAction`, {
                              action: bucket.commonAction,
                            })}
                          </div>
                          {bucket.findings.map((f) => (
                            <div key={f.id} className="flex justify-between">
                              <span>{f.title}</span>
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] ${f.severity === "critical" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}
                              >
                                {f.severity}
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
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">
                    {t(`${NS}.aiBucketsHeading`)}
                  </h3>
                </div>
                <button
                  onClick={runAIBucketing}
                  disabled={isAILoading}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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

              {aiBuckets.length > 0 ? (
                <div className="space-y-3">
                  {aiBuckets.map((bucket, idx) => (
                    <div key={idx} className="rounded-lg border bg-background">
                      <button
                        onClick={() => toggleBucket(bucket.bucketName)}
                        className="flex w-full justify-between p-3 text-left hover:bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{bucket.bucketName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {t(`${NS}.aiBucketMeta`, {
                              risks: bucket.riskRefs.length,
                              sites: bucket.sitesAffected.length,
                            })}
                          </p>
                        </div>
                        {expandedBucket === bucket.bucketName ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      {expandedBucket === bucket.bucketName && (
                        <div className="space-y-3 border-t p-3 text-xs">
                          <div className="rounded bg-amber-500/10 p-2 text-amber-700">
                            {t(`${NS}.aiRootCauseLabel`, {
                              cause: bucket.rootCause,
                            })}
                          </div>
                          <div className="rounded bg-blue-500/10 p-2 text-blue-700">
                            {t(`${NS}.aiActionLabel`, {
                              action: bucket.groupedAction.description,
                            })}
                          </div>
                          <button
                            onClick={() => handleSendBucketToFindings(bucket)}
                            disabled={sendingBucket === bucket.bucketName}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 py-2 text-primary hover:bg-primary/10 disabled:opacity-50"
                          >
                            {sendingBucket === bucket.bucketName ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            {t(`${NS}.sendToFinding`)}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
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
  links: RiskLink[]
}) {
  const { t } = useTranslation()
  const siteName = sites.find((s) => s.id === risk.site_id)?.name
  const m = riskMetrics[risk.id] || { rootCauses: 0, consequences: 0 }

  return (
    <div className="space-y-2 rounded-lg border bg-background p-3">
      <div className="flex justify-between">
        <div>
          <p className="font-mono text-xs text-primary" title={risk.id}>
            {shortRef(risk.id)}
          </p>
          <p className="text-sm font-medium">{risk.name}</p>
        </div>
        <RiskBadge
          level={
            risk.residual_score > 12
              ? "critical"
              : risk.residual_score > 8
                ? "high"
                : "medium"
          }
          size="sm"
        />
      </div>

      {siteName && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {siteName}
        </div>
      )}

      <p className="line-clamp-2 text-xs text-muted-foreground">
        {risk.description}
      </p>

      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>{t(`${NS}.detailCauses`, { count: m.rootCauses })}</span>
        <span>
          {t(`${NS}.detailConsequences`, { count: m.consequences })}
        </span>
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
            onClick={() => toggleBucket(bucket.name)}
            className="flex w-full justify-between p-3 text-left hover:bg-muted/50"
          >
            <div>
              <p className="font-medium">{bucket.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {t(`${NS}.bucketMeta`, {
                  count: bucket.risks.length,
                  impact: (bucket.totalImpact / 1000000).toFixed(1),
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
                      <span className="font-mono" title={risk.id}>
                        {shortRef(risk.id)}
                      </span>
                      <span className="truncate">{risk.name}</span>
                    </div>
                    {siteName && (
                      <span className="text-[10px] text-muted-foreground">
                        {siteName}
                      </span>
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
