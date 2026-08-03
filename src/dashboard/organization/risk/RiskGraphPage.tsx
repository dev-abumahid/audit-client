import SiteFilter from "@/components/dashboard/organization/SiteFilter"
import { useGetCorrelationMatrixDataQuery } from "@/redux/apis/organization/riskLink.api"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import type { Risk, RiskLink, RiskLinkType } from "@/types/organization"
import {
  buildRiskCorrelationEdges,
  computePageRank,
  topPercentileByPageRank,
} from "@/utils/pageRank"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

interface DominoChain {
  refs: string[]
  totalImpact: number
}

// Real risk ids are full UUIDs (~36 chars) that overflow the small circular
// graph nodes. Show only the first block (8 chars) for long ids so they fit,
// while short human-readable ids (e.g. test fixtures) render in full. The full
// id is always preserved elsewhere (SVG <title> tooltip, side-panel header).
const NODE_LABEL_MAX = 12
const shortRef = (id: string) =>
  id.length > NODE_LABEL_MAX ? id.slice(0, 8) : id

// Single source of truth for both the badge color and the translated label
// per link_type, same convention as CorrelationMatrixPage.tsx's PRIORITY_KEYS/
// PRIORITY_BADGES maps -- avoids repeating the same three-way ternary once
// for className and again for label text.
const LINK_TYPE_META: Record<
  RiskLinkType,
  { badgeClassName: string; labelKey: string }
> = {
  CAUSES: {
    badgeClassName: "bg-destructive/10 text-destructive",
    labelKey: "organization.riskGraph.legendCauses",
  },
  AMPLIFIES: {
    badgeClassName: "bg-orange-500/10 text-orange-600",
    labelKey: "organization.riskGraph.legendAmplifies",
  },
  CORRELATES: {
    badgeClassName: "bg-blue-500/10 text-blue-600",
    labelKey: "organization.riskGraph.legendCorrelates",
  },
}

export default function RiskGraphPage() {
  const { t } = useTranslation()
  const { data: riskResponse, isLoading } = useGetAllRisksQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    category: "",
  })
  // Real RiskLink rows (CAUSES/AMPLIFIES/CORRELATES), same source Overview.tsx's
  // "Systemic Tipping Points" section and CorrelationMatrixPage.tsx already use.
  // aexa-frontend#473 -- this used to feed only the PageRank computation
  // below, while `links`/`filteredLinks` (which drive the graph's own edge
  // rendering, cascade highlighting, and domino chains) stayed hardcoded to
  // an always-empty array, so the Domino Scenarios / Corrélations panels
  // could never show anything regardless of real org data even though this
  // exact query result was sitting right here. Now the single source for
  // both.
  //
  // Same known gap as Overview.tsx's own "Tipping Points" section:
  // correlationMatrixResponse.data.risks is unpaginated (every risk in the
  // org), but `risks`/`filteredRisks` below come from the capped
  // limit:100 useGetAllRisksQuery -- a link whose source/target risk falls
  // past the first 100 simply won't have a position to draw at (`if
  // (!source || !target) return null` below already handles that
  // gracefully), it just won't render. Not fixed here, same as Overview.tsx's
  // own callout on the same asymmetry.
  const { data: correlationMatrixResponse, isLoading: isCorrelationLoading } =
    useGetCorrelationMatrixDataQuery()
  const risks: Risk[] = useMemo(() => riskResponse?.data ?? [], [riskResponse])
  const links: RiskLink[] = useMemo(
    () => correlationMatrixResponse?.data?.riskLinks ?? [],
    [correlationMatrixResponse]
  )
  const [siteFilter, setSiteFilter] = useState<string | null>(null)
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null)
  const [showDomino, setShowDomino] = useState(true)

  // Filter risks by site
  const filteredRisks = useMemo(() => {
    if (!siteFilter) return risks
    return risks.filter((r) => r.site_id === siteFilter)
  }, [risks, siteFilter])

  // RiskLink.source_ref/target_ref reference risks by their `ref` field
  // (e.g. "RISK-001"), not their uuid `id` -- confirmed against
  // CorrelationMatrixPage.tsx's own identical filteredRefs, which is the
  // page already correctly rendering these same links. Everything derived
  // from `selectedRisk` below (positions, cascadeRefs, dominoChains) is
  // keyed the same way, so a risk is identified by `ref` throughout this
  // component now, not `id`.
  const filteredRefs = useMemo(
    () => new Set(filteredRisks.map((r) => r.ref)),
    [filteredRisks]
  )

  const filteredLinks = useMemo(() => {
    return links.filter(
      (l) => filteredRefs.has(l.source_ref) && filteredRefs.has(l.target_ref)
    )
  }, [links, filteredRefs])

  // Build domino chains (longest causal paths)
  const dominoChains = useMemo((): DominoChain[] => {
    const causesLinks = filteredLinks.filter(
      (l) => l.link_type === "CAUSES" || l.link_type === "AMPLIFIES"
    )
    const adjacency: Record<string, string[]> = {}
    for (const l of causesLinks) {
      if (!adjacency[l.source_ref]) adjacency[l.source_ref] = []
      adjacency[l.source_ref].push(l.target_ref)
    }

    const chains: DominoChain[] = []
    const riskMap = new Map(filteredRisks.map((r) => [r.ref, r]))

    const dfs = (ref: string, path: string[], visited: Set<string>) => {
      if (visited.has(ref)) return
      visited.add(ref)
      path.push(ref)
      const next = adjacency[ref] || []
      if (next.length === 0 && path.length >= 3) {
        const totalImpact = path.reduce((sum, p) => {
          const risk = riskMap.get(p)
          return sum + (risk ? Number(risk.financial_impact_max) : 0)
        }, 0)
        chains.push({
          refs: [...path],
          totalImpact,
        })
      }
      for (const n of next) {
        dfs(n, path, visited)
      }
      path.pop()
      visited.delete(ref)
    }

    for (const ref of Object.keys(adjacency)) {
      dfs(ref, [], new Set())
    }

    return chains.sort((a, b) => b.totalImpact - a.totalImpact).slice(0, 5)
  }, [filteredRisks, filteredLinks])

  // A "tipping point" node is one in the top 15% by real PageRank over the
  // org's actual risk-correlation graph (RiskLink CAUSES/AMPLIFIES/CORRELATES
  // edges, resolved by ref) -- the same methodology and threshold as
  // Overview.tsx's "Systemic Tipping Points" section (aexa-frontend#25).
  // Risk.pagerank_score is NOT used here: it's a manually-entered form field
  // never derived from anything (see risk.validation.ts / Overview.tsx's own
  // comment), so it isn't a real centrality measure despite the name.
  const correlationEdges = useMemo(
    () =>
      buildRiskCorrelationEdges(
        correlationMatrixResponse?.data?.riskLinks ?? []
      ),
    [correlationMatrixResponse]
  )
  const tippingPointRefs = useMemo(() => {
    const refs = filteredRisks.map((r) => r.ref)
    if (refs.length === 0) return new Set<string>()
    return new Set(topPercentileByPageRank(refs, correlationEdges, 0.15))
  }, [filteredRisks, correlationEdges])

  // Real computed PageRank per risk, normalized to a 0-100 scale (same
  // normalization Overview.tsx's "Systemic Tipping Points" section uses)
  // for node sizing, node labels, and the side panel -- replaces the fake
  // manually-entered risk.pagerank_score field (see comment above,
  // aexa-frontend#422).
  const pageRankScores = useMemo(
    () =>
      computePageRank(
        filteredRisks.map((r) => r.ref),
        correlationEdges
      ),
    [filteredRisks, correlationEdges]
  )
  const maxPageRankScore = Math.max(0, ...Object.values(pageRankScores))
  const getNormalizedPageRank = (ref: string) =>
    maxPageRankScore > 0
      ? (pageRankScores[ref] / maxPageRankScore) * 100
      : 0

  // Get cascade effects for a selected risk
  const cascadeRefs = useMemo(() => {
    if (!selectedRisk) return new Set<string>()
    const refs = new Set<string>()
    const queue = [selectedRisk]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (refs.has(current)) continue
      refs.add(current)
      for (const l of filteredLinks) {
        if (l.source_ref === current && !refs.has(l.target_ref)) {
          queue.push(l.target_ref)
        }
      }
    }
    refs.delete(selectedRisk)
    return refs
  }, [selectedRisk, filteredLinks])

  // Force-directed-ish layout using category clustering
  // Keyed by risk.ref (not risk.id) -- see the filteredRefs comment above on
  // why this component identifies risks by ref throughout, to match how
  // RiskLink.source_ref/target_ref actually reference them.
  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {}
    const categories = Array.from(new Set(filteredRisks.map((r) => r.category)))
    const cx = 450,
      cy = 300

    // Arrange category clusters in a larger circle
    const catPositions: Record<string, { cx: number; cy: number }> = {}
    categories.forEach((cat, i) => {
      const angle = (2 * Math.PI * i) / categories.length - Math.PI / 2
      catPositions[cat] = {
        cx: cx + 180 * Math.cos(angle),
        cy: cy + 160 * Math.sin(angle),
      }
    })

    // Position each risk within its category cluster
    categories.forEach((cat) => {
      const catRisks = filteredRisks.filter((r) => r.category === cat)
      const { cx: ccx, cy: ccy } = catPositions[cat]
      catRisks.forEach((r, i) => {
        const angle = (2 * Math.PI * i) / catRisks.length
        const spread = Math.min(60, 30 + catRisks.length * 8)
        pos[r.ref] = {
          x: ccx + spread * Math.cos(angle),
          y: ccy + spread * Math.sin(angle),
        }
      })
    })

    return pos
  }, [filteredRisks])

  if (isLoading || isCorrelationLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const selectedRiskData = selectedRisk
    ? filteredRisks.find((r) => r.ref === selectedRisk)
    : null

  return (
    <div className="space-y-5 p-6">
      <div className="animate-fade-in flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("organization.riskGraph.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.riskGraph.description")}
          </p>
        </div>
        <SiteFilter
          value={siteFilter}
          onChange={setSiteFilter}
          className="w-56"
        />
      </div>

      {/* Legend */}
      <div className="animate-slide-up flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-destructive" />
          {t("organization.riskGraph.legendCauses")}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-orange-500" />
          {t("organization.riskGraph.legendAmplifies")}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-blue-500 opacity-60" />
          {t("organization.riskGraph.legendCorrelates")}
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-accent" />
          {t("organization.riskGraph.legendTippingPoint")}
        </div>
        {selectedRisk && (
          <button
            onClick={() => setSelectedRisk(null)}
            className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-primary hover:bg-primary/20"
          >
            ✕ {t("organization.riskGraph.clearSelection")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Graph */}
        {/* aexa-frontend#473 -- h1 (above) was followed directly by h3s
            further down with no h2 in between, breaking heading-level order
            for screen-reader users. The graph panel and the side panel are
            this page's two top-level sections, so each gets its own
            visually-hidden h2 -- the h3s already inside them stay nested as
            they render today. */}
        <div className="animate-slide-up rounded-xl border border-border bg-card p-4 xl:col-span-2">
          <h2 className="sr-only">{t("organization.riskGraph.graphSectionHeading")}</h2>
          <svg
            viewBox="0 0 900 600"
            className="h-auto w-full"
            style={{ minHeight: 400 }}
          >
            {/* Links */}
            {filteredLinks.map((link, i) => {
              const source = positions[link.source_ref]
              const target = positions[link.target_ref]
              if (!source || !target) return null

              const isCascade =
                selectedRisk &&
                (link.source_ref === selectedRisk ||
                  cascadeRefs.has(link.source_ref)) &&
                cascadeRefs.has(link.target_ref)
              const isDimmed =
                selectedRisk && !isCascade && link.source_ref !== selectedRisk

              const color =
                link.link_type === "CAUSES"
                  ? "hsl(0, 72%, 51%)"
                  : link.link_type === "AMPLIFIES"
                    ? "hsl(25, 95%, 53%)"
                    : "hsl(199, 89%, 48%)"

              // Arrow marker
              const dx = target.x - source.x
              const dy = target.y - source.y
              const len = Math.sqrt(dx * dx + dy * dy)
              const nodeR = 22
              const ratio = (len - nodeR) / len
              const ex = source.x + dx * ratio
              const ey = source.y + dy * ratio

              return (
                <g key={i}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={ex}
                    y2={ey}
                    stroke={isCascade ? "hsl(0, 90%, 50%)" : color}
                    // The real RiskLink model (aexa-frontend#142) has no
                    // strength/weight column -- Fullbloom's own RiskLink
                    // doesn't carry one either -- so a fixed width per
                    // link_type is the correct stand-in rather than a
                    // strength this model doesn't have.
                    strokeWidth={isCascade ? 5 : 3}
                    strokeOpacity={isDimmed ? 0.08 : isCascade ? 0.8 : 0.35}
                    strokeLinecap="round"
                    markerEnd={isCascade ? "url(#arrowCascade)" : undefined}
                  />
                </g>
              )
            })}

            {/* Arrow defs */}
            <defs>
              <marker
                id="arrowCascade"
                viewBox="0 0 10 7"
                refX="10"
                refY="3.5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="hsl(0, 90%, 50%)" />
              </marker>
            </defs>

            {/* Nodes */}
            {filteredRisks.map((risk) => {
              const pos = positions[risk.ref]
              if (!pos) return null
              const nodeRadius = 18 + getNormalizedPageRank(risk.ref) / 6
              const cat = RISK_CATEGORIES[risk.category]
              const catColor = cat?.color || "hsl(220, 10%, 46%)"
              const isSelected = risk.ref === selectedRisk
              const isCascaded = cascadeRefs.has(risk.ref)
              const isDimmed = selectedRisk && !isSelected && !isCascaded

              return (
                <g
                  key={risk.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedRisk(isSelected ? null : risk.ref)}
                  opacity={isDimmed ? 0.15 : 1}
                >
                  {/* Cascade highlight */}
                  {(isSelected || isCascaded) && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={nodeRadius + 6}
                      fill="none"
                      stroke={
                        isSelected ? "hsl(var(--primary))" : "hsl(0, 80%, 50%)"
                      }
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        values="0;12"
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={nodeRadius}
                    fill={catColor}
                    fillOpacity={isSelected ? 0.35 : 0.15}
                    stroke={catColor}
                    strokeWidth={2}
                    strokeOpacity={0.7}
                  />
                  <title>{risk.id}</title>
                  {tippingPointRefs.has(risk.ref) && (
                    <Zap
                      x={pos.x + nodeRadius * 0.5}
                      y={pos.y - nodeRadius - 10}
                      width={12}
                      height={12}
                      className="fill-accent text-accent"
                    >
                      <title>
                        {t("organization.riskGraph.legendTippingPoint")}
                      </title>
                    </Zap>
                  )}
                  <text
                    x={pos.x}
                    y={pos.y - 4}
                    textAnchor="middle"
                    className="fill-foreground text-[11px] font-bold select-none"
                  >
                    {shortRef(risk.id)}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + 9}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono text-[8px] select-none"
                  >
                    PR:{getNormalizedPageRank(risk.ref).toFixed(0)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Side panel */}
        <div className="animate-slide-up stagger-2 space-y-4">
          <h2 className="sr-only">{t("organization.riskGraph.sidePanelSectionHeading")}</h2>
          {/* Selected risk detail */}
          {selectedRiskData && (
            <div className="space-y-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
              <h3 className="text-sm font-bold text-foreground">
                {selectedRiskData.id} — {selectedRiskData.name}
              </h3>
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {selectedRiskData.description}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-card p-2">
                  <span className="text-muted-foreground">
                    {t("organization.riskGraph.pageRank")}
                  </span>
                  <p className="font-mono font-bold text-foreground">
                    {getNormalizedPageRank(selectedRiskData.ref).toFixed(0)}
                  </p>
                </div>
                <div className="rounded-md bg-card p-2">
                  <span className="text-muted-foreground">
                    {t("organization.riskGraph.maxImpact")}
                  </span>
                  <p className="font-mono font-bold text-foreground">
                    {/* aexa-frontend#376 -- financial_impact_max is stored
                        in k€ (the form's own "k€" label, submitted
                        unmodified), so divide by 1,000 to get M€, not
                        1,000,000. */}
                    {(
                      Number(selectedRiskData.financial_impact_max) / 1000
                    ).toFixed(1)}
                    M€
                  </p>
                </div>
              </div>
              {cascadeRefs.size > 0 && (
                <div className="rounded-md bg-destructive/10 p-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    {t("organization.riskGraph.dominoEffect", {
                      count: cascadeRefs.size,
                    })}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {Array.from(cascadeRefs).map(shortRef).join(" → ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Domino chains */}
          <div className="rounded-xl border border-border bg-card p-4">
            <button
              onClick={() => setShowDomino(!showDomino)}
              aria-expanded={showDomino}
              className="flex w-full items-center justify-between text-sm font-semibold text-foreground"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {t("organization.riskGraph.dominoScenarios")} (
                {dominoChains.length})
              </span>
              {showDomino ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showDomino && (
              <div className="mt-3 space-y-2">
                {dominoChains.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("organization.riskGraph.noDominoChains")}
                  </p>
                ) : (
                  dominoChains.map((chain, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          {t("organization.riskGraph.chainName", {
                            source: shortRef(chain.refs[0]),
                            target: shortRef(chain.refs[chain.refs.length - 1]),
                          })}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-destructive">
                          {/* aexa-frontend#376 -- totalImpact sums
                              financial_impact_max values, which are stored
                              in k€; divide by 1,000 for M€. */}
                          {(chain.totalImpact / 1000).toFixed(1)}M€
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        {chain.refs.map((ref, j) => (
                          <span key={ref} className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedRisk(ref)}
                              className="font-mono font-bold text-foreground hover:text-primary"
                              title={ref}
                            >
                              {shortRef(ref)}
                            </button>
                            {j < chain.refs.length - 1 && (
                              <ArrowRight className="h-2.5 w-2.5 text-destructive" />
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Links list */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t("organization.riskGraph.correlations")} ({filteredLinks.length}
              )
            </h3>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {filteredLinks.map((link, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
                >
                  <span
                    className="font-mono font-bold text-foreground"
                    title={link.source_ref}
                  >
                    {shortRef(link.source_ref)}
                  </span>
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                  <span
                    className="font-mono font-bold text-foreground"
                    title={link.target_ref}
                  >
                    {shortRef(link.target_ref)}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-medium ${LINK_TYPE_META[link.link_type].badgeClassName}`}
                  >
                    {t(LINK_TYPE_META[link.link_type].labelKey)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
