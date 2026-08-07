import SiteFilter from "@/components/dashboard/organization/SiteFilter"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useGetCorrelationMatrixDataQuery } from "@/redux/apis/organization/riskLink.api"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import type { Risk, RiskLink, RiskLinkType } from "@/types/organization"
import {
  buildRiskCorrelationEdges,
  computePageRank,
  topPercentileFromScores,
} from "@/utils/pageRank"
import { RISK_CATEGORIES, riskCategoryLabel } from "@/utils/riskConfig"
import { computeRiskGraphLayout } from "@/utils/riskGraphLayout"
import { severityBadgeClasses } from "@/utils/severityStyles"
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Maximize,
  Search,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { toast } from "sonner"

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const DEFAULT_VIEW = { scale: 1, x: 0, y: 0 }
// aexa-frontend#577: mouse-drag/touch-drag panning had no keyboard
// equivalent -- a keyboard-only user could zoom (the +/- buttons are
// already real, tabbable buttons) but had no way to pan at all once
// zoomed in. Graph units, not screen pixels, so the step feels consistent
// regardless of current zoom -- same reasoning as handlePanMove's own
// unitsPerPixel conversion, just skipping the conversion since there's no
// pixel delta to convert from a key press.
const KEYBOARD_PAN_STEP = 40

// aexa-frontend#577: the domino-chain DFS below explores every simple path
// through the CAUSES/AMPLIFIES subgraph. Two independent safety valves,
// since either alone can still blow up on real data:
//   - MAX_CHAIN_DEPTH bounds any single path's length. Without it, a chain
//     that legitimately has no depth limit (only per-path cycle guarding)
//     can traverse the entire graph on a long, densely-linked causal chain.
//   - MAX_PATHS_EXPLORED is a hard budget on total DFS calls, independent
//     of depth: a wide (high branching factor) graph can still explode
//     combinatorially within a shallow depth limit (e.g. 8 levels of
//     branching factor 5 is ~5^8 = ~390,625 paths). This caps worst-case
//     work to a constant, regardless of graph shape.
// Both are generous enough to never trigger on realistic risk-register
// sizes (dozens to low hundreds of risks) while bounding the pathological
// case (a densely-interlinked causal graph, e.g. adversarial or malformed
// import data) to bounded, interactive-speed work.
const MAX_CHAIN_DEPTH = 8
const MAX_PATHS_EXPLORED = 5000

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
    badgeClassName: severityBadgeClasses("critical"),
    labelKey: "organization.riskGraph.legendCauses",
  },
  AMPLIFIES: {
    badgeClassName: severityBadgeClasses("high"),
    labelKey: "organization.riskGraph.legendAmplifies",
  },
  CORRELATES: {
    badgeClassName: severityBadgeClasses("info"),
    labelKey: "organization.riskGraph.legendCorrelates",
  },
}

// aexa-frontend#577 round 5 (efficiency re-score, flagged across three
// consecutive judge passes): every pan-drag mousemove and wheel-zoom tick
// only ever changes the parent <g transform> -- node/link position, color,
// and selection state are untouched by pan/zoom -- but without memoization
// the plain .map() JSX below re-created and re-reconciled every node/link
// element on every one of those events anyway. Extracted as React.memo'd
// components with only primitive props (numbers/strings/booleans, no fresh
// object/array/closure identities) so React can bail out of re-rendering
// them when a pan/zoom-only parent re-render doesn't change any of their
// actual inputs. onSelect is passed down from a useCallback below (stable
// identity) rather than each item creating its own inline arrow function,
// which would otherwise defeat the memoization by giving every node/link a
// "new" onClick prop on every parent render regardless.
interface RiskGraphNodeProps {
  riskRef: string
  x: number
  y: number
  nodeRadius: number
  catColor: string
  isSelected: boolean
  isCascaded: boolean
  isDimmed: boolean
  isTippingPoint: boolean
  tippingPointLabel: string
  titleText: string
  labelText: string
  pagerankText: string
  ariaLabel: string
  onSelect: (ref: string) => void
}

const RiskGraphNode = memo(function RiskGraphNode({
  riskRef,
  x,
  y,
  nodeRadius,
  catColor,
  isSelected,
  isCascaded,
  isDimmed,
  isTippingPoint,
  tippingPointLabel,
  titleText,
  labelText,
  pagerankText,
  ariaLabel,
  onSelect,
}: RiskGraphNodeProps) {
  return (
    <g
      className="focus-ring-svg cursor-pointer"
      onClick={() => onSelect(riskRef)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(riskRef)
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={ariaLabel}
      opacity={isDimmed ? 0.15 : 1}
    >
      {/* Cascade highlight */}
      {(isSelected || isCascaded) && (
        <circle
          cx={x}
          cy={y}
          r={nodeRadius + 6}
          fill="none"
          stroke={
            isSelected ? "hsl(var(--primary))" : "hsl(var(--destructive))"
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
        cx={x}
        cy={y}
        r={nodeRadius}
        fill={catColor}
        fillOpacity={isSelected ? 0.35 : 0.15}
        stroke={catColor}
        strokeWidth={2}
        strokeOpacity={0.7}
      />
      <title>{titleText}</title>
      {isTippingPoint && (
        <Zap
          x={x + nodeRadius * 0.5}
          y={y - nodeRadius - 10}
          width={12}
          height={12}
          className="fill-accent text-accent"
        >
          <title>{tippingPointLabel}</title>
        </Zap>
      )}
      <text
        x={x}
        y={y - 4}
        textAnchor="middle"
        className="fill-foreground text-[11px] font-bold select-none"
      >
        {labelText}
      </text>
      <text
        x={x}
        y={y + 9}
        textAnchor="middle"
        className="font-mono-data fill-muted-foreground text-[8px] select-none"
      >
        {pagerankText}
      </text>
    </g>
  )
})

interface RiskGraphLinkLineProps {
  linkType: RiskLinkType
  x1: number
  y1: number
  x2: number
  y2: number
  isCascade: boolean
  isDimmed: boolean
}

const RiskGraphLinkLine = memo(function RiskGraphLinkLine({
  linkType,
  x1,
  y1,
  x2,
  y2,
  isCascade,
  isDimmed,
}: RiskGraphLinkLineProps) {
  // hsl(var(--x)) so these track the theme's actual light/dark token values
  // -- this used to hardcode the light-mode HSL literals directly, so every
  // edge kept its light-mode hue in dark mode too (--risk-critical/high/info
  // all shift lightness between themes).
  const color =
    linkType === "CAUSES"
      ? "hsl(var(--risk-critical))"
      : linkType === "AMPLIFIES"
        ? "hsl(var(--risk-high))"
        : "hsl(var(--risk-info))"

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={isCascade ? "hsl(var(--destructive))" : color}
      // The real RiskLink model (aexa-frontend#142) has no strength/weight
      // column -- Fullbloom's own RiskLink doesn't carry one either -- so a
      // fixed width per link_type is the correct stand-in rather than a
      // strength this model doesn't have.
      strokeWidth={isCascade ? 5 : 3}
      strokeOpacity={isDimmed ? 0.08 : isCascade ? 0.8 : 0.35}
      strokeLinecap="round"
      // Test hook only (not used for rendering) -- lets tests target a
      // specific link_type's <line> directly instead of inferring it from
      // marker-end/stroke-opacity, which only disambiguates correctly for a
      // specific fixture shape (aexa-frontend#577 review).
      data-link-type={linkType}
      // aexa-frontend#575 review: CAUSES/AMPLIFIES direction was only
      // visible once a cascade was selected (arrowCascade), so the
      // unselected graph couldn't communicate direction at all even though
      // these are directed edges (CORRELATES has no inherent direction, per
      // pageRank.ts, so it stays arrowless here too).
      markerEnd={
        isCascade
          ? "url(#arrowCascade)"
          : linkType === "CAUSES"
            ? "url(#arrowCauses)"
            : linkType === "AMPLIFIES"
              ? "url(#arrowAmplifies)"
              : undefined
      }
    />
  )
})

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
  // aexa-frontend#577: RISK_CATEGORIES already drives node color and the
  // category-clustered layout (riskGraphLayout.ts), but there was no way to
  // isolate or hide a category -- only the site filter existed. Categories
  // *excluded* from view (empty = show all) rather than an included-set, so
  // a newly-appearing category (e.g. after switching sites) defaults to
  // visible instead of silently hidden.
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(
    new Set()
  )
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null)
  const [showDomino, setShowDomino] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  // aexa-frontend#577: the single most-cited gap against every reference
  // graph-viz tool (Cytoscape/Gephi/Neo4j Bloom) -- the graph only ever
  // shrunk-to-fit as more risks were added, with no way to zoom in on a
  // dense cluster or pan around. `view` holds the pan/zoom transform
  // applied to the graph's content group; svgRef/panState back the wheel
  // and drag handlers below.
  const [view, setView] = useState(DEFAULT_VIEW)
  const svgRef = useRef<SVGSVGElement>(null)
  const panState = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  // aexa-frontend#577 round-3 review: the svg's `touch-none` class (added
  // alongside round 2's mouse-only pan/zoom) blocks the browser's native
  // touch scroll/pinch-zoom with no replacement -- touch/tablet users had
  // *worse* graph interaction after round 2 than before it. pinchState
  // backs the two-finger pinch-to-zoom handlers below.
  const pinchState = useRef<{
    initialDistance: number
    initialScale: number
  } | null>(null)

  // Filter risks by site
  const siteFilteredRisks = useMemo(() => {
    if (!siteFilter) return risks
    return risks.filter((r) => r.site_id === siteFilter)
  }, [risks, siteFilter])

  // Every category actually present in the current site's risks, in a
  // stable order -- drives the filter chip row below. Computed from
  // siteFilteredRisks (not the category-filtered result) so a category the
  // user has hidden still shows its own chip to toggle back on.
  const availableCategories = useMemo(
    () => Array.from(new Set(siteFilteredRisks.map((r) => r.category))).sort(),
    [siteFilteredRisks]
  )

  function toggleCategory(category: string) {
    // Toggling a category reshuffles the whole category-ring layout
    // (riskGraphLayout.ts), so the same reasoning as handleSiteFilterChange
    // applies: reset the view rather than leave the user panned/zoomed into
    // a region that no longer has anything at that position.
    setView(DEFAULT_VIEW)
    setExcludedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const filteredRisks = useMemo(() => {
    if (excludedCategories.size === 0) return siteFilteredRisks
    return siteFilteredRisks.filter((r) => !excludedCategories.has(r.category))
  }, [siteFilteredRisks, excludedCategories])

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

  // aexa-frontend#570: the Links list below shows each link's source/target
  // by ref -- resolve ref -> risk so those can link into the risk's own
  // detail page, same as #549's CorrelationMatrixPage.tsx and #550's
  // selected-risk side panel above.
  const riskByRef = useMemo(
    () => new Map(filteredRisks.map((r) => [r.ref, r])),
    [filteredRisks]
  )

  // aexa-frontend#575 review: with 80+ risks on the graph, there was no way
  // to find a specific one except visually hunting the canvas or scrolling
  // the Correlations list -- every reference graph tool in the research
  // (Neo4j Bloom's search, Datadog's faceted search) treats search as the
  // primary way power users navigate a large graph, not an enhancement.
  const searchMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []
    return filteredRisks
      .filter(
        (r) =>
          r.ref.toLowerCase().includes(query) ||
          r.name.toLowerCase().includes(query)
      )
      .slice(0, 8)
  }, [searchQuery, filteredRisks])

  function selectSearchMatch(ref: string) {
    setSelectedRisk(ref)
    setSearchQuery("")
  }

  // Stable identity (empty deps, functional setState update so it never
  // needs `selectedRisk` in its closure) so RiskGraphNode's memoization
  // above actually holds -- an inline `() => setSelectedRisk(...)` recreated
  // on every render would give every node a "new" onSelect prop each time,
  // defeating the point of memoizing them.
  const handleNodeSelect = useCallback((ref: string) => {
    setSelectedRisk((prev) => (prev === ref ? null : ref))
  }, [])

  // Build domino chains (longest causal paths)
  const dominoChains = useMemo((): DominoChain[] => {
    const causesLinks = filteredLinks.filter(
      (l) => l.link_type === "CAUSES" || l.link_type === "AMPLIFIES"
    )
    const adjacency: Record<string, string[]> = {}
    const hasIncoming = new Set<string>()
    for (const l of causesLinks) {
      if (!adjacency[l.source_ref]) adjacency[l.source_ref] = []
      adjacency[l.source_ref].push(l.target_ref)
      hasIncoming.add(l.target_ref)
    }

    const chains: DominoChain[] = []
    const riskMap = new Map(filteredRisks.map((r) => [r.ref, r]))
    // Clamped to >= 0: the root-restriction below relies on "a chain
    // starting mid-graph never outscores its root's full chain," which is
    // only true if extending a chain can never *decrease* its total. The
    // form has no min/validate rule on financial_impact_max (it's a plain
    // number field), so a saved risk really can carry a negative value --
    // without the clamp a root's real chain could rank below a mid-graph
    // suffix that skips a negative-impact node, silently dropping the
    // higher-impact chain the root-restriction assumes it always keeps.
    const recordChain = (path: string[]) => {
      const totalImpact = path.reduce((sum, p) => {
        const risk = riskMap.get(p)
        return sum + Math.max(0, risk ? Number(risk.financial_impact_max) : 0)
      }, 0)
      chains.push({ refs: [...path], totalImpact })
    }

    let pathsExplored = 0
    const dfs = (ref: string, path: string[], visited: Set<string>) => {
      if (pathsExplored >= MAX_PATHS_EXPLORED) return
      pathsExplored++
      if (visited.has(ref)) return
      visited.add(ref)
      path.push(ref)
      const next = adjacency[ref] || []
      if (next.length === 0 && path.length >= 3) {
        recordChain(path)
      } else if (path.length >= MAX_CHAIN_DEPTH) {
        // Hit the depth cap (>= 3, since MAX_CHAIN_DEPTH is) with more
        // causal links still ahead -- record the chain as far as it was
        // explored rather than silently dropping it (a truncated real
        // chain still ranks and displays fine; only its financial-impact
        // total is a lower bound).
        recordChain(path)
      } else {
        for (const n of next) {
          dfs(n, path, visited)
        }
      }
      path.pop()
      visited.delete(ref)
    }

    // Starting DFS only from true roots (nodes with no incoming CAUSES/
    // AMPLIFIES edge), not every node with an outgoing one: any chain
    // starting mid-graph is a suffix of some root's chain (never a higher
    // total, given the clamp above), and skipping non-root starts avoids
    // re-exploring the same downstream subgraph once per node that feeds
    // into it -- the main source of the combinatorial blowup on
    // densely-linked graphs.
    const roots = Object.keys(adjacency).filter((ref) => !hasIncoming.has(ref))

    // Full graph reachability from the roots above (plain BFS, unbounded
    // depth -- NOT the chain-building dfs() above, so it isn't itself
    // limited by MAX_CHAIN_DEPTH/MAX_PATHS_EXPLORED) used only to find the
    // root-restriction's one real gap: a cycle with no true root of its
    // own, e.g. A->B->C->A plus C->D -- A/B/C all have an incoming edge so
    // none qualifies as a root, but D is a real, non-cyclic terminus the
    // pre-restriction DFS (which started from every outgoing-edge node)
    // did reach. This is deliberately a *different* set than "every node
    // dfs() actually visited": a node past MAX_CHAIN_DEPTH from its root is
    // reachable (this BFS has no depth limit) but dfs() stopped short of
    // it on purpose -- conflating the two would re-explore that node from
    // scratch as a fresh "root" and report its causal path a second time
    // as a separate, confusing chain instead of the single truncated one.
    const reachableFromRoot = new Set<string>(roots)
    const bfsQueue = [...roots]
    while (bfsQueue.length > 0) {
      const ref = bfsQueue.shift()!
      for (const next of adjacency[ref] || []) {
        if (!reachableFromRoot.has(next)) {
          reachableFromRoot.add(next)
          bfsQueue.push(next)
        }
      }
    }

    for (const ref of roots) {
      if (pathsExplored >= MAX_PATHS_EXPLORED) break
      dfs(ref, [], new Set())
    }

    // Second pass: any node with an outgoing edge that's outside every
    // root's reachable set is only reachable via a cycle with no true root
    // of its own (see reachableFromRoot's comment above) -- start DFS from
    // one representative per such rootless component so a real acyclic
    // tail hanging off it still gets found.
    for (const ref of Object.keys(adjacency)) {
      if (pathsExplored >= MAX_PATHS_EXPLORED) break
      if (reachableFromRoot.has(ref)) continue
      // Extend reachability with everything this pseudo-root can reach
      // *before* moving to the next adjacency key -- otherwise every other
      // node in this same rootless component would look "unreached" too
      // and get its own redundant DFS start, reproducing the exact
      // duplicate-suffix problem the root-restriction exists to avoid.
      const extra = [ref]
      while (extra.length > 0) {
        const next = extra.shift()!
        if (reachableFromRoot.has(next)) continue
        reachableFromRoot.add(next)
        for (const n of adjacency[next] || []) {
          if (!reachableFromRoot.has(n)) extra.push(n)
        }
      }
      dfs(ref, [], new Set())
    }

    return chains.sort((a, b) => b.totalImpact - a.totalImpact).slice(0, 5)
  }, [filteredRisks, filteredLinks])

  // Real computed PageRank per risk, normalized to a 0-100 scale (same
  // normalization Overview.tsx's "Systemic Tipping Points" section uses)
  // for node sizing, node labels, and the side panel -- replaces the fake
  // manually-entered risk.pagerank_score field (aexa-frontend#422).
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
  const pageRankScores = useMemo(
    () =>
      computePageRank(
        filteredRisks.map((r) => r.ref),
        correlationEdges
      ),
    [filteredRisks, correlationEdges]
  )
  // A "tipping point" node is one in the top 15% by the PageRank just
  // computed above -- the same methodology and threshold as Overview.tsx's
  // "Systemic Tipping Points" section (aexa-frontend#25). Derived from
  // pageRankScores via topPercentileFromScores rather than calling
  // topPercentileByPageRank (which would recompute PageRank from scratch on
  // the same nodes/edges): this used to run the full 100-iteration power
  // iteration twice on every render.
  const tippingPointRefs = useMemo(() => {
    const refs = filteredRisks.map((r) => r.ref)
    if (refs.length === 0) return new Set<string>()
    return new Set(topPercentileFromScores(refs, pageRankScores, 0.15))
  }, [filteredRisks, pageRankScores])
  const maxPageRankScore = Object.values(pageRankScores).reduce(
    (max, score) => Math.max(max, score),
    0
  )
  const getNormalizedPageRank = (ref: string) =>
    maxPageRankScore > 0 ? (pageRankScores[ref] / maxPageRankScore) * 100 : 0

  // Outgoing-edge adjacency for cascade BFS below, built once per
  // filteredLinks change instead of the BFS rescanning the full link array
  // on every queue pop (was O(V*E) per click; this makes it O(V+E)).
  const outgoingAdjacency = useMemo(() => {
    const adjacency = new Map<string, string[]>()
    for (const l of filteredLinks) {
      if (!adjacency.has(l.source_ref)) adjacency.set(l.source_ref, [])
      adjacency.get(l.source_ref)!.push(l.target_ref)
    }
    return adjacency
  }, [filteredLinks])

  // Get cascade effects for a selected risk
  const cascadeRefs = useMemo(() => {
    if (!selectedRisk) return new Set<string>()
    const refs = new Set<string>()
    const queue = [selectedRisk]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (refs.has(current)) continue
      refs.add(current)
      for (const target of outgoingAdjacency.get(current) ?? []) {
        if (!refs.has(target)) queue.push(target)
      }
    }
    refs.delete(selectedRisk)
    return refs
  }, [selectedRisk, outgoingAdjacency])

  // Force-directed-ish layout using category clustering, extracted to
  // computeRiskGraphLayout (src/utils/riskGraphLayout.ts) so its
  // no-overlap-at-scale behavior is independently unit-tested rather than
  // only exercised through this component. Keyed by risk.ref (not risk.id)
  // -- see the filteredRefs comment above on why this component identifies
  // risks by ref throughout, to match how RiskLink.source_ref/target_ref
  // actually reference them.
  const {
    positions,
    width: graphWidth,
    height: graphHeight,
  } = useMemo(
    () =>
      computeRiskGraphLayout(
        filteredRisks.map((r) => ({ ref: r.ref, category: r.category }))
      ),
    [filteredRisks]
  )

  // Reset pan/zoom when the site filter changes -- otherwise a user zoomed
  // into one filter's graph could land disoriented, panned off-canvas,
  // after switching sites. Reset from the event handler that changes
  // siteFilter (below), not a useEffect keyed on it: an effect-based reset
  // still renders one frame with the stale view before the effect fires,
  // an avoidable cascading render for something already known at the
  // moment the filter actually changes.
  function handleSiteFilterChange(next: string | null) {
    setSiteFilter(next)
    setView(DEFAULT_VIEW)
    setExcludedCategories(new Set())
  }

  // Native (non-passive) wheel listener, since React's onWheel is passive
  // by default -- e.dontDefault() on a passive listener is a no-op, and the
  // page would scroll underneath the graph on every zoom gesture.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      setView((v) => {
        const nextScale = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, v.scale * (1 - e.deltaY * 0.001))
        )
        // Keep the graph's visual center anchored under the cursor's
        // general area (the viewBox center, not the literal cursor
        // position -- see zoomBy's comment for why) as scale changes.
        const cx = graphWidth / 2
        const cy = graphHeight / 2
        return {
          scale: nextScale,
          x: v.x + (v.scale - nextScale) * cx,
          y: v.y + (v.scale - nextScale) * cy,
        }
      })
    }
    svg.addEventListener("wheel", handleWheel, { passive: false })
    return () => svg.removeEventListener("wheel", handleWheel)
  }, [graphWidth, graphHeight])

  // Zoom in/out around the viewBox center, same anchor math as the wheel
  // handler above, for the on-screen +/- buttons (touch-friendly, and
  // discoverable without knowing scroll-to-zoom is even possible).
  function zoomBy(factor: number) {
    setView((v) => {
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale * factor))
      const cx = graphWidth / 2
      const cy = graphHeight / 2
      return {
        scale: nextScale,
        x: v.x + (v.scale - nextScale) * cx,
        y: v.y + (v.scale - nextScale) * cy,
      }
    })
  }

  // Arrow keys pan (like a map: Right reveals content further right, so
  // the transform's x shifts left -- the opposite sign from dragging,
  // which moves the content with the pointer); +/- zoom (mirrors the
  // on-screen buttons); 0 resets (mirrors the reset-zoom button). Attached
  // to the whole graph panel below, not just the <svg>, so it fires
  // whether keyboard focus is on the canvas itself or on a node inside it
  // -- a keyboard user tabbing onto a node still needs to pan around it.
  function handleGraphKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault()
        setView((v) => ({ ...v, y: v.y + KEYBOARD_PAN_STEP }))
        break
      case "ArrowDown":
        e.preventDefault()
        setView((v) => ({ ...v, y: v.y - KEYBOARD_PAN_STEP }))
        break
      case "ArrowLeft":
        e.preventDefault()
        setView((v) => ({ ...v, x: v.x + KEYBOARD_PAN_STEP }))
        break
      case "ArrowRight":
        e.preventDefault()
        setView((v) => ({ ...v, x: v.x - KEYBOARD_PAN_STEP }))
        break
      case "+":
      case "=":
        e.preventDefault()
        zoomBy(1.2)
        break
      case "-":
      case "_":
        e.preventDefault()
        zoomBy(1 / 1.2)
        break
      case "0":
        e.preventDefault()
        setView(DEFAULT_VIEW)
        break
    }
  }

  // aexa-frontend#577: every reference graph-viz tool in the original
  // research (Cytoscape, Gephi, Neo4j Bloom) supports exporting the current
  // view as an image and the underlying data as a table -- this graph had
  // neither, so a risk manager wanting to drop the dependency graph into a
  // board deck or hand the risk list to someone in Excel had no way to.
  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Recursively copies each element's actually-rendered style (fill,
  // stroke, font, etc.) from the live DOM onto the matching node in a
  // detached clone, as inline `style`. This is the one thing that makes
  // the clone renderable as a standalone file: most of the graph's colors
  // come from Tailwind utility classes (fill-foreground, bg-risk-critical
  // via the .stroke-current pattern, etc.) whose actual CSS rules live in
  // the app's compiled stylesheet, which an exported SVG/PNG obviously
  // doesn't carry with it -- and the handful of colors set as literal
  // hsl(var(--x)) attributes (RiskGraphNode's selection ring, cascade/link
  // colors) reference custom properties defined on :root, which are
  // equally absent outside this document. getComputedStyle resolves both
  // to their actual rendered value (e.g. "rgb(16, 139, 116)"), which is
  // theme-correct (light/dark) and needs no separate <style>/token setup
  // in the export.
  function inlineComputedStyles(source: Element, clone: Element) {
    const computed = getComputedStyle(source)
    const styleProps = [
      "fill",
      "stroke",
      "stroke-width",
      "stroke-opacity",
      "stroke-dasharray",
      "fill-opacity",
      "opacity",
      "font-family",
      "font-size",
      "font-weight",
      "text-anchor",
    ]
    // Preserve whatever inline style cloneNode already carried over (e.g.
    // the root <svg>'s own style={{ minHeight: 400 }}) instead of
    // overwriting it -- harmless today since width/height get set
    // explicitly afterward regardless, but there's no reason to clobber it.
    let styleText = clone.getAttribute("style") ?? ""
    if (styleText && !styleText.endsWith(";")) styleText += ";"
    for (const prop of styleProps) {
      const value = computed.getPropertyValue(prop)
      if (value) styleText += `${prop}:${value};`
    }
    if (styleText) clone.setAttribute("style", styleText)
    // Pairs children by index rather than identity -- only safe because
    // `clone` is a cloneNode(true) of `source` taken (and walked) in the
    // same synchronous call, so the two trees are still structurally
    // identical. Do not call this across a render/await boundary (e.g.
    // after a state update that could change selectedRisk/cascadeRefs and
    // thus which conditional children exist) -- the index pairing would
    // silently misapply styles to the wrong sibling with no error.
    for (let i = 0; i < source.children.length; i++) {
      const sourceChild = source.children[i]
      const cloneChild = clone.children[i]
      if (sourceChild && cloneChild) {
        inlineComputedStyles(sourceChild, cloneChild)
      }
    }
  }

  // Builds a standalone, self-contained SVG document string from the live
  // graph -- shared by both the SVG and PNG export paths below (PNG just
  // rasterizes this via an <img>/<canvas> round-trip).
  function buildExportSvgString(): string | null {
    if (!svgRef.current) return null
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement
    inlineComputedStyles(svgRef.current, clone)
    clone.setAttribute("width", String(graphWidth))
    clone.setAttribute("height", String(graphHeight))
    // The live <svg> has no background of its own (it's transparent, and
    // relies on the surrounding card's bg-card) -- without one, an
    // exported file opened outside the app renders dark theme text/shapes
    // on a transparent (usually white, in most viewers) background.
    const cardHsl = getComputedStyle(document.documentElement)
      .getPropertyValue("--card")
      .trim()
    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    )
    background.setAttribute("width", "100%")
    background.setAttribute("height", "100%")
    background.setAttribute("fill", cardHsl ? `hsl(${cardHsl})` : "white")
    clone.insertBefore(background, clone.firstChild)
    const serialized = new XMLSerializer().serializeToString(clone)
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${serialized}`
  }

  function exportGraphAsSvg() {
    const svgString = buildExportSvgString()
    if (!svgString) return
    const blob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    })
    triggerDownload(blob, "risk-graph.svg")
  }

  function exportGraphAsPng() {
    const svgString = buildExportSvgString()
    if (!svgString) return
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    })
    const url = URL.createObjectURL(svgBlob)
    const image = new Image()
    image.onload = () => {
      // 2x the graph's own coordinate size for a crisp export regardless
      // of the browser's current on-screen render size (which shrinks to
      // fit its container width, per computeRiskGraphLayout).
      const scaleFactor = 2
      const canvas = document.createElement("canvas")
      canvas.width = graphWidth * scaleFactor
      canvas.height = graphHeight * scaleFactor
      const ctx = canvas.getContext("2d")
      URL.revokeObjectURL(url)
      if (!ctx) return
      ctx.scale(scaleFactor, scaleFactor)
      ctx.drawImage(image, 0, 0, graphWidth, graphHeight)
      canvas.toBlob((blob) => {
        if (blob) triggerDownload(blob, "risk-graph.png")
      }, "image/png")
    }
    // Without this, a decode failure (malformed SVG from an edge case
    // inlineComputedStyles doesn't handle, or a browser refusing to
    // rasterize it) leaked the blob URL for the tab's lifetime and left
    // the user thinking the export just silently did nothing.
    image.onerror = () => {
      URL.revokeObjectURL(url)
      toast.error(t("organization.riskGraph.exportPngFailed"))
    }
    image.src = url
  }

  // risk.ref/name/category are free text from the Risk Register, not
  // sanitized before this export -- a cell starting with =, +, -, or @
  // executes as a formula when the CSV is opened in Excel/LibreOffice
  // ("CSV injection"), e.g. a risk named =HYPERLINK("http://evil","x").
  // Prefixing with a leading apostrophe is the standard mitigation: Excel
  // treats a leading `'` as "force text" and doesn't display it, so a
  // legitimate risk name is unaffected.
  //
  // Text fields only, not the numeric columns below: a leading `-` also
  // matches this same regex, and financial_impact_min/max have no
  // min="0" constraint in the risk form -- a legitimately negative value
  // would otherwise get force-text-prefixed too, silently turning a real
  // number column into text in the exported spreadsheet (breaks
  // SUM/sorting-as-number) for a value that was never attacker-controlled
  // input in the first place.
  function csvTextField(value: string) {
    const escaped = /^[=+\-@]/.test(value) ? `'${value}` : value
    return /[",\n]/.test(escaped) ? `"${escaped.replace(/"/g, '""')}"` : escaped
  }

  // The graph's own data, not the full Risk Register export (a separate,
  // already-existing concern) -- scoped to exactly what's visible on the
  // current graph (respecting the site/category filters), with the same
  // real computed PageRank the nodes themselves display.
  function exportDataAsCsv() {
    const header = [
      "Ref",
      "Name",
      "Category",
      "Financial Impact Min (k€)",
      "Financial Impact Max (k€)",
      "Probability (%)",
      "PageRank",
    ]
    const rows = filteredRisks.map((risk) => [
      csvTextField(risk.ref),
      csvTextField(risk.name),
      csvTextField(risk.category),
      // Plain numbers, not user-editable free text -- no CSV-injection
      // guard needed, and applying one would corrupt legitimate negative
      // values (see csvTextField's comment above).
      String(risk.financial_impact_min),
      String(risk.financial_impact_max),
      String(risk.probability),
      getNormalizedPageRank(risk.ref).toFixed(0),
    ])
    const csv = [header, ...rows].map((row) => row.join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    triggerDownload(blob, "risk-graph-data.csv")
  }

  function handlePanStart(e: React.MouseEvent) {
    panState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: view.x,
      originY: view.y,
    }
  }
  function handlePanMove(e: React.MouseEvent) {
    if (!panState.current || !svgRef.current) return
    // Convert screen-pixel drag distance to the graph's own coordinate
    // units via the SVG's actual rendered width vs. its viewBox width --
    // a 1:1 pixel mapping would pan too fast/slow depending on how much
    // the viewBox is currently scaled down to fit the container.
    const renderedWidth = svgRef.current.getBoundingClientRect().width
    const unitsPerPixel = renderedWidth > 0 ? graphWidth / renderedWidth : 1
    // Capture everything needed from panState.current now, before calling
    // setView -- React may run this updater after a later render (a
    // mouseup that nulls panState.current in between), so reading
    // panState.current again *inside* the updater risks a null deref.
    const nextX =
      panState.current.originX +
      (e.clientX - panState.current.startX) * unitsPerPixel
    const nextY =
      panState.current.originY +
      (e.clientY - panState.current.startY) * unitsPerPixel
    setView((v) => ({ ...v, x: nextX, y: nextY }))
  }
  function handlePanEnd() {
    panState.current = null
  }

  // Touch equivalents of the mouse handlers above: one finger pans (same
  // math as handlePanMove, driven from the background rect so a tap on a
  // node still just selects it), two fingers pinch-to-zoom (same
  // center-anchor math as zoomBy/the wheel handler).
  function touchDistance(touches: React.TouchList) {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.hypot(dx, dy)
  }
  function handleTouchStartPan(e: React.TouchEvent) {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    panState.current = {
      startX: t.clientX,
      startY: t.clientY,
      originX: view.x,
      originY: view.y,
    }
  }
  function handleTouchStartPinch(e: React.TouchEvent) {
    if (e.touches.length !== 2) return
    // A second finger landing mid-pan supersedes the pan -- resuming pan
    // cleanly once the pinch ends would need re-basing panState's origin,
    // which isn't worth the complexity here; the user just re-touches to
    // resume panning after a pinch, same as most touch graph UIs.
    panState.current = null
    pinchState.current = {
      initialDistance: touchDistance(e.touches),
      initialScale: view.scale,
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchState.current) {
      const distance = touchDistance(e.touches)
      const nextScale = Math.min(
        MAX_ZOOM,
        Math.max(
          MIN_ZOOM,
          pinchState.current.initialScale *
            (distance / pinchState.current.initialDistance)
        )
      )
      const cx = graphWidth / 2
      const cy = graphHeight / 2
      setView((v) => ({
        scale: nextScale,
        x: v.x + (v.scale - nextScale) * cx,
        y: v.y + (v.scale - nextScale) * cy,
      }))
      return
    }
    if (e.touches.length === 1 && panState.current && svgRef.current) {
      const t = e.touches[0]
      const renderedWidth = svgRef.current.getBoundingClientRect().width
      const unitsPerPixel = renderedWidth > 0 ? graphWidth / renderedWidth : 1
      const nextX =
        panState.current.originX +
        (t.clientX - panState.current.startX) * unitsPerPixel
      const nextY =
        panState.current.originY +
        (t.clientY - panState.current.startY) * unitsPerPixel
      setView((v) => ({ ...v, x: nextX, y: nextY }))
    }
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchState.current = null
    if (e.touches.length < 1) panState.current = null
  }

  if (isLoading || isCorrelationLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // riskByRef map lookup instead of filteredRisks.find() -- same O(1) win
  // the Links list below already gets from the same map.
  const selectedRiskData = selectedRisk ? riskByRef.get(selectedRisk) : null

  return (
    <div className="space-y-5 p-6">
      <div className="animate-fade-in flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {t("organization.riskGraph.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.riskGraph.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("organization.riskGraph.searchPlaceholder")}
              aria-label={t("organization.riskGraph.searchLabel")}
              // aexa-frontend#577 review: the results dropdown had no ARIA
              // wiring at all -- a screen-reader user tabbing through the
              // input had no indication matches existed or how to reach
              // them. role="combobox" is a simplification of the full
              // ARIA 1.2 combobox pattern (no aria-activedescendant/arrow-
              // key roving focus -- results are reached via Tab, same as
              // any other button on the page), but it does announce that
              // expanding a listbox of results is possible and where it is.
              role="combobox"
              aria-expanded={searchMatches.length > 0}
              aria-controls="risk-graph-search-results"
              aria-autocomplete="list"
              className="focus-ring h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-xs"
            />
            {searchMatches.length > 0 && (
              <ul
                id="risk-graph-search-results"
                role="listbox"
                aria-label={t("organization.riskGraph.searchLabel")}
                className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg"
              >
                {searchMatches.map((r) => (
                  <li key={r.ref} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => selectSearchMatch(r.ref)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                    >
                      <span className="font-mono-data font-bold text-foreground">
                        {r.ref}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {r.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <SiteFilter
            value={siteFilter}
            onChange={handleSiteFilterChange}
            className="w-56"
          />
        </div>
      </div>

      {/* Category filter -- RISK_CATEGORIES already drives node color and
          the category-clustered layout, but there was no way to isolate or
          hide a category, only the site filter (aexa-frontend#577). */}
      {availableCategories.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {availableCategories.map((category) => {
            const isExcluded = excludedCategories.has(category)
            const color =
              RISK_CATEGORIES[category]?.color || "hsl(220, 10%, 46%)"
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                aria-pressed={!isExcluded}
                className={`focus-ring flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-opacity ${
                  isExcluded
                    ? "border-border text-muted-foreground opacity-50"
                    : "border-transparent text-foreground"
                }`}
                style={
                  isExcluded ? undefined : { backgroundColor: `${color}26` }
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {riskCategoryLabel(t, category)}
              </button>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="animate-slide-up flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-risk-critical" />
          {t("organization.riskGraph.legendCauses")}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-risk-high" />
          {t("organization.riskGraph.legendAmplifies")}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-risk-info opacity-60" />
          {t("organization.riskGraph.legendCorrelates")}
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-accent" />
          {t("organization.riskGraph.legendTippingPoint")}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="ml-0.5 h-2.5 w-2.5 rounded-full bg-muted-foreground" />
          </span>
          {t("organization.riskGraph.legendNodeSize")}
        </div>
        {selectedRisk && (
          <button
            onClick={() => setSelectedRisk(null)}
            className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-primary hover:bg-primary/20"
          >
            <X className="h-3 w-3" />
            {t("organization.riskGraph.clearSelection")}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="focus-ring ml-auto flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-foreground hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" />
              {t("organization.riskGraph.export")}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportGraphAsPng}>
              <ImageIcon className="h-3.5 w-3.5" />
              {t("organization.riskGraph.exportPng")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportGraphAsSvg}>
              <FileText className="h-3.5 w-3.5" />
              {t("organization.riskGraph.exportSvg")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportDataAsCsv}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {t("organization.riskGraph.exportCsv")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Graph */}
        {/* aexa-frontend#473 -- h1 (above) was followed directly by h3s
            further down with no h2 in between, breaking heading-level order
            for screen-reader users. The graph panel and the side panel are
            this page's two top-level sections, so each gets its own
            visually-hidden h2 -- the h3s already inside them stay nested as
            they render today. */}
        <div
          className="animate-slide-up relative rounded-xl border border-border bg-card p-4 xl:col-span-2"
          onKeyDown={handleGraphKeyDown}
        >
          <h2 className="sr-only">
            {t("organization.riskGraph.graphSectionHeading")}
          </h2>
          {filteredRisks.length === 0 && (
            <div
              className="absolute inset-4 flex items-center justify-center text-center text-sm text-muted-foreground"
              style={{ minHeight: 400 }}
            >
              {t("organization.riskGraph.emptyState")}
            </div>
          )}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${graphWidth} ${graphHeight}`}
            className="focus-ring-svg h-auto w-full touch-none"
            style={{ minHeight: 400 }}
            tabIndex={0}
            aria-label={t("organization.riskGraph.graphKeyboardLabel")}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            onTouchStart={handleTouchStartPinch}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {/* Pan surface -- sits behind everything so dragging the
                background pans the view without a mousedown on a node also
                starting a pan (which would fight the node's own onClick). */}
            <rect
              x={0}
              y={0}
              width={graphWidth}
              height={graphHeight}
              fill="transparent"
              onMouseDown={handlePanStart}
              onTouchStart={handleTouchStartPan}
              className="cursor-grab active:cursor-grabbing"
            />
            <g
              transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}
            >
              {/* Links */}
              {filteredLinks.map((link, i) => {
                const source = positions[link.source_ref]
                const target = positions[link.target_ref]
                if (!source || !target) return null

                const isCascade = Boolean(
                  selectedRisk &&
                  (link.source_ref === selectedRisk ||
                    cascadeRefs.has(link.source_ref)) &&
                  cascadeRefs.has(link.target_ref)
                )
                const isDimmed = Boolean(
                  selectedRisk && !isCascade && link.source_ref !== selectedRisk
                )

                // Arrow marker: shorten the line so its head lands on the
                // target node's edge instead of its center.
                const dx = target.x - source.x
                const dy = target.y - source.y
                const len = Math.sqrt(dx * dx + dy * dy)
                const nodeR = 22
                const ratio = (len - nodeR) / len
                const ex = source.x + dx * ratio
                const ey = source.y + dy * ratio

                return (
                  <RiskGraphLinkLine
                    key={i}
                    linkType={link.link_type}
                    x1={source.x}
                    y1={source.y}
                    x2={ex}
                    y2={ey}
                    isCascade={isCascade}
                    isDimmed={isDimmed}
                  />
                )
              })}

              {/* Arrow defs. markerUnits="userSpaceOnUse" on all three: the
                  SVG default (markerUnits="strokeWidth") scales a marker's
                  rendered size by the *line's* stroke width, and since the
                  cascade line bumps both its own strokeWidth (3->5, below)
                  and its marker's markerWidth/Height (5->6) at the same
                  time, those two multiply -- the cascade arrowhead rendered
                  at roughly 2x the linear scale (~4x the area) of the other
                  two, not the modest emphasis it was meant to be. userSpaceOnUse makes
                  markerWidth/Height absolute sizes, independent of
                  strokeWidth, so the explicit values below are the actual
                  visual sizes (cascade ~30% larger than the others, a
                  deliberate but modest emphasis instead of an accidental
                  2x). */}
              <defs>
                <marker
                  id="arrowCascade"
                  viewBox="0 0 10 7"
                  refX="10"
                  refY="3.5"
                  markerUnits="userSpaceOnUse"
                  markerWidth="9"
                  markerHeight="6.3"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="hsl(var(--destructive))"
                  />
                </marker>
                <marker
                  id="arrowCauses"
                  viewBox="0 0 10 7"
                  refX="10"
                  refY="3.5"
                  markerUnits="userSpaceOnUse"
                  markerWidth="7"
                  markerHeight="4.9"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="hsl(var(--risk-critical))"
                    fillOpacity={0.35}
                  />
                </marker>
                <marker
                  id="arrowAmplifies"
                  viewBox="0 0 10 7"
                  refX="10"
                  refY="3.5"
                  markerUnits="userSpaceOnUse"
                  markerWidth="7"
                  markerHeight="4.9"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="hsl(var(--risk-high))"
                    fillOpacity={0.35}
                  />
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
                const isDimmed = Boolean(
                  selectedRisk && !isSelected && !isCascaded
                )

                return (
                  <RiskGraphNode
                    key={risk.id}
                    riskRef={risk.ref}
                    x={pos.x}
                    y={pos.y}
                    nodeRadius={nodeRadius}
                    catColor={catColor}
                    isSelected={isSelected}
                    isCascaded={isCascaded}
                    isDimmed={isDimmed}
                    isTippingPoint={tippingPointRefs.has(risk.ref)}
                    tippingPointLabel={t(
                      "organization.riskGraph.legendTippingPoint"
                    )}
                    titleText={`${risk.ref} — ${risk.name}`}
                    labelText={shortRef(risk.ref)}
                    pagerankText={`${t("organization.riskGraph.pagerankAbbrLabel")}${getNormalizedPageRank(risk.ref).toFixed(0)}`}
                    ariaLabel={t("organization.riskGraph.nodeAriaLabel", {
                      riskId: risk.ref,
                    })}
                    onSelect={handleNodeSelect}
                  />
                )
              })}
            </g>
          </svg>
          {/* Zoom controls -- discoverable on touch devices and for users
              who wouldn't otherwise know scroll-to-zoom/drag-to-pan is
              available at all (aexa-frontend#577). */}
          <div className="absolute right-6 bottom-6 flex flex-col gap-1 rounded-lg border border-border bg-card p-1 shadow-md">
            <button
              type="button"
              onClick={() => zoomBy(1.2)}
              aria-label={t("organization.riskGraph.zoomIn")}
              className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.2)}
              aria-label={t("organization.riskGraph.zoomOut")}
              className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView(DEFAULT_VIEW)}
              aria-label={t("organization.riskGraph.resetZoom")}
              className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Side panel */}
        <div className="animate-slide-up stagger-2 space-y-4">
          <h2 className="sr-only">
            {t("organization.riskGraph.sidePanelSectionHeading")}
          </h2>
          {/* Selected risk detail */}
          {selectedRiskData && (
            <div className="space-y-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
              {/* aexa-frontend#550: selectedRiskData.id was already available
                  but rendered as plain text -- same gap #548/#549 fixed on
                  the RiskMatrix/CorrelationMatrix pages. aexa-frontend#575:
                  the link target still needs the uuid `id`, but the visible
                  label should be the human-readable `ref` like every
                  sibling page's equivalent header (CorrelationMatrixPage's
                  RiskDetailCard, RiskMatrixPage) -- this one alone showed
                  the raw uuid. */}
              <h3 className="text-sm font-bold text-foreground">
                <Link
                  to={`/organization/risks/${selectedRiskData.id}`}
                  className="focus-ring hover:underline"
                >
                  {selectedRiskData.ref} — {selectedRiskData.name}
                </Link>
              </h3>
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {selectedRiskData.description}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-card p-2">
                  <span className="text-muted-foreground">
                    {t("organization.riskGraph.pageRank")}
                  </span>
                  <p className="font-mono-data font-bold text-foreground">
                    {getNormalizedPageRank(selectedRiskData.ref).toFixed(0)}
                  </p>
                </div>
                <div className="rounded-md bg-card p-2">
                  <span className="text-muted-foreground">
                    {t("organization.riskGraph.maxImpact")}
                  </span>
                  <p className="font-mono-data font-bold text-foreground">
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
                        <span className="font-mono-data text-[10px] font-bold text-destructive">
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
                              className="font-mono-data font-bold text-foreground hover:text-primary"
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
                  {riskByRef.has(link.source_ref) ? (
                    <Link
                      to={`/organization/risks/${riskByRef.get(link.source_ref)!.id}`}
                      className="focus-ring font-mono-data font-bold text-primary hover:underline"
                      title={link.source_ref}
                    >
                      {shortRef(link.source_ref)}
                    </Link>
                  ) : (
                    <span
                      className="font-mono-data font-bold text-foreground"
                      title={link.source_ref}
                    >
                      {shortRef(link.source_ref)}
                    </span>
                  )}
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                  {riskByRef.has(link.target_ref) ? (
                    <Link
                      to={`/organization/risks/${riskByRef.get(link.target_ref)!.id}`}
                      className="focus-ring font-mono-data font-bold text-primary hover:underline"
                      title={link.target_ref}
                    >
                      {shortRef(link.target_ref)}
                    </Link>
                  ) : (
                    <span
                      className="font-mono-data font-bold text-foreground"
                      title={link.target_ref}
                    >
                      {shortRef(link.target_ref)}
                    </span>
                  )}
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
