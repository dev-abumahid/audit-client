import { Zap } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { MOCK_RISK_LINKS } from "@/dashboard/organization/overview/overviewMockData"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import { RISK_CATEGORIES, riskCategoryLabel } from "@/utils/riskConfig"
import { buildRiskCorrelationEdges, computePageRank } from "@/utils/pageRank"
import { computeRiskGraphLayout } from "@/utils/riskGraphLayout"
import { resolveNodeOverlaps } from "@/utils/riskGraphNodeOverlap"
import type { RiskLink } from "@/types/organization"

// User request: this graph now shows the SAME risk set
// LandingRiskMatrixWidget does (riskMatrixMockData's MOCK_RISKS, 12 real
// mock risks), not a separate smaller fixture -- a click on either widget
// cross-highlights the other. Real correlation links (MOCK_RISK_LINKS,
// still sourced from overviewMockData.ts, the only place they're defined)
// form one connected tree spanning all 12 risks, several hops deep in
// places -- not a flat star.
const LINK_TYPE_COLOR: Record<string, string> = {
  CAUSES: "hsl(var(--risk-critical))",
  AMPLIFIES: "hsl(var(--risk-high))",
  CORRELATES: "hsl(var(--risk-info))",
}

interface GraphNode {
  ref: string
  name: string
  category: string
  x: number
  y: number
  radius: number
  pageRankDisplay: number
}

// CEO feedback (round after #1045): the graph used a fixed square viewBox
// (320x320), so on the two-column rail -- where `items-stretch` (default)
// makes this card match LandingRiskMatrixWidget's own, often-taller,
// height -- the svg stayed a small square pinned to the top, leaving a
// large dead gap above the bottom-pinned legend/caption. DEFAULT_BOX is
// only the size used until the ResizeObserver below reports the card's
// real rendered dimensions (including in tests, where the stub observer
// never fires -- see src/test/setup.ts).
const DEFAULT_BOX = { width: 320, height: 320 }
const PADDING = 28
const MIN_RADIUS = 8
const MAX_RADIUS = 20

function categoryColor(category: string): string {
  return (
    RISK_CATEGORIES[category as keyof typeof RISK_CATEGORIES]?.color ??
    "hsl(var(--muted-foreground))"
  )
}

// A node's own ref plus every ref directly linked to it (either
// direction) -- the "what should stay highlighted" set for a selection,
// generalized from the previous version's star-topology-only logic (which
// assumed every satellite linked straight to one fixed hub) to real
// arbitrary topology now that most of the 12 nodes aren't linked to
// anything at all.
function connectedRefs(ref: string, links: RiskLink[]): Set<string> {
  const set = new Set([ref])
  for (const link of links) {
    if (link.source_ref === ref) set.add(link.target_ref)
    if (link.target_ref === ref) set.add(link.source_ref)
  }
  return set
}

interface GraphTopology {
  positions: Record<string, { x: number; y: number }>
  pageRankByRef: Record<string, number>
}

// The topology/PageRank/force-layout math never depends on the card's
// rendered size -- only the final rescale into a viewBox does (see
// layoutNodesInBox below). Split out so a resize doesn't re-run d3-force.
function buildTopology(): GraphTopology | null {
  if (MOCK_RISKS.length === 0) return null

  const refs = MOCK_RISKS.map((r) => r.ref)
  const edges = buildRiskCorrelationEdges(MOCK_RISK_LINKS)
  const rawScores = computePageRank(refs, edges)
  const maxScore = Math.max(...Object.values(rawScores), 0)
  const normalize = (ref: string) =>
    maxScore > 0 ? Math.round((rawScores[ref] / maxScore) * 100) : 0
  const pageRankByRef: Record<string, number> = {}
  refs.forEach((ref) => {
    pageRankByRef[ref] = normalize(ref)
  })

  // Same real force-directed layout RiskGraphPage.tsx (the authenticated
  // dashboard) uses -- d3-force seeded from a deterministic category-ring
  // layout, so an isolated risk still lands somewhere sensible near its
  // category's peers instead of drifting arbitrarily. This widget used to
  // hand-roll a simple hub+orbit layout, which only worked because it only
  // ever rendered the 4 linked risks; with the full 12-risk set (8 of them
  // unlinked), a real topology-aware layout is what keeps this legible.
  const layout = computeRiskGraphLayout(
    MOCK_RISKS.map((r) => ({ ref: r.ref, category: r.category })),
    MOCK_RISK_LINKS.map((l) => ({
      source: l.source_ref,
      target: l.target_ref,
      kind: l.link_type,
    }))
  )

  return {
    positions: layout.positions,
    pageRankByRef,
  }
}

// Rescales the topology's own raw coordinate space into `box` -- the
// card's real measured width/height, not a fixed square -- so the graph
// actually uses whatever room the two-column rail's `items-stretch`
// gives it. scaleX/scaleY are independent (not a single uniform min()
// scale) so the graph fills a non-square box completely rather than
// letterboxing to whichever axis is tighter; node radii stay circular
// (only positions stretch), so this doesn't visibly distort individual
// nodes, just their spacing.
//
// Live-verified finding (post-#1046): scaling against topology.width/
// height (computeRiskGraphLayout's own declared CANVAS size, reserved for
// a worst-case category-ring spread) left the box itself correctly sized
// but most of it empty -- this sparse 12-node tree's real node positions
// only occupy a fraction of that reserved canvas, so scaling by the full
// canvas just moved the same small cluster into a corner of a bigger box
// instead of spreading it to fill that box. Scaling against the actual
// bounding box of where the nodes ended up (minX/maxX/minY/maxY across
// topology.positions) fixes this regardless of how much canvas margin the
// layout algorithm reserved.
function layoutNodesInBox(
  topology: GraphTopology,
  box: { width: number; height: number }
): { nodes: GraphNode[]; nodeByRef: Map<string, GraphNode> } {
  const xs = MOCK_RISKS.map((r) => topology.positions[r.ref].x)
  const ys = MOCK_RISKS.map((r) => topology.positions[r.ref].y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  // A single node (or several coincident ones) has zero content width/
  // height -- falls back to 1 so scale/offset stay finite instead of
  // dividing by zero.
  const contentWidth = maxX - minX || 1
  const contentHeight = maxY - minY || 1

  const scaleX = (box.width - PADDING * 2) / contentWidth
  const scaleY = (box.height - PADDING * 2) / contentHeight
  const offsetX = (box.width - contentWidth * scaleX) / 2 - minX * scaleX
  const offsetY = (box.height - contentHeight * scaleY) / 2 - minY * scaleY

  const nodes: GraphNode[] = MOCK_RISKS.map((risk) => {
    const pos = topology.positions[risk.ref]
    const pageRankDisplay = topology.pageRankByRef[risk.ref] ?? 0
    return {
      ref: risk.ref,
      name: risk.name,
      category: risk.category,
      x: pos.x * scaleX + offsetX,
      y: pos.y * scaleY + offsetY,
      radius: MIN_RADIUS + (pageRankDisplay / 100) * (MAX_RADIUS - MIN_RADIUS),
      pageRankDisplay,
    }
  })

  // See resolveNodeOverlaps' own comment: guarantees no two circles touch
  // using THIS widget's real radii, independent of whatever separation
  // assumption computeRiskGraphLayout's own raw-unit constants made.
  resolveNodeOverlaps(nodes, 4, box.width, box.height)

  return { nodes, nodeByRef: new Map(nodes.map((n) => [n.ref, n])) }
}

// selectedRefs/onSelectionChange: optionally controlled, same pattern
// LandingRiskMatrixWidget uses -- ProductDemoSection wires both widgets to
// one shared Set so a click on either cross-highlights the other;
// standalone usage (this widget's own tests) falls back to local state.
export default function RiskGraphWidget({
  animate,
  selectedRefs: controlledSelectedRefs,
  onSelectionChange,
}: {
  animate: boolean
  selectedRefs?: Set<string>
  onSelectionChange?: (refs: Set<string>) => void
}) {
  const { t } = useTranslation()
  const topology = useMemo(() => buildTopology(), [])

  // Measures the svg's own wrapper div -- see DEFAULT_BOX's comment on why
  // this starts square and only becomes the card's real rectangle once the
  // observer fires (immediately after mount in a real browser; never, in a
  // test environment that stubs ResizeObserver as a no-op).
  const containerRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState(DEFAULT_BOX)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setBox({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const built = useMemo(
    () => (topology ? layoutNodesInBox(topology, box) : null),
    [topology, box]
  )

  const [localSelectedRefs, setLocalSelectedRefs] = useState<Set<string>>(
    new Set()
  )
  const selectedRefs = controlledSelectedRefs ?? localSelectedRefs

  if (!built) return null
  const { nodes, nodeByRef } = built
  const prLabel = t("organization.riskGraph.pagerankAbbrLabel")

  // The highest-PageRank node gets the hub's visual treatment (Zap icon)
  // -- computed from the real score rather than a hardcoded ref, so this
  // stays correct if the mock data or link set ever changes.
  const hubRef = nodes.reduce((best, n) =>
    n.pageRankDisplay > best.pageRankDisplay ? n : best
  ).ref
  const linksToHub = MOCK_RISK_LINKS.filter((l) => l.target_ref === hubRef)

  function selectRef(ref: string) {
    const isSameSelection = selectedRefs.size === 1 && selectedRefs.has(ref)
    const next = isSameSelection ? new Set<string>() : new Set([ref])
    setLocalSelectedRefs(next)
    onSelectionChange?.(next)
  }

  const hasSelection = selectedRefs.size > 0
  // Union of connectedRefs() for every currently-selected ref -- usually
  // one (a click on this graph), but a matrix cell with more than one risk
  // can select several at once.
  const highlighted = new Set<string>()
  selectedRefs.forEach((ref) => {
    connectedRefs(ref, MOCK_RISK_LINKS).forEach((r) => highlighted.add(r))
  })

  function isNodeDimmed(ref: string): boolean {
    return hasSelection && !highlighted.has(ref)
  }

  // CEO feedback: clicking a node on this graph directly already selected
  // it and dimmed unrelated nodes (isNodeDimmed above) -- but nothing
  // marked the CORRELATED nodes as visibly highlighted the way
  // RiskGraphPage's own cascade ring does, so the effect read as "everyone
  // else got dimmer" rather than "these are correlated." isNodeCascaded is
  // every highlighted node except the one actually clicked/selected --
  // same distinction RiskGraphPage's own isSelected/isCascaded split
  // makes, just against this widget's broader bidirectional
  // connectedRefs() (any link direction/type) rather than that page's
  // downstream-only cascade, since this demo is showing "what's related,"
  // not simulating a specific impact cascade.
  function isNodeCascaded(ref: string): boolean {
    return hasSelection && highlighted.has(ref) && !selectedRefs.has(ref)
  }

  // An edge only brightens/stays undimmed when it touches an actually-
  // selected ref directly -- not just "somewhere in the highlighted set"
  // -- so selecting a node doesn't light up an edge between two of its
  // OTHER neighbors that has nothing to do with the click itself.
  function isEdgeHighlighted(link: RiskLink): boolean {
    return (
      hasSelection &&
      (selectedRefs.has(link.source_ref) || selectedRefs.has(link.target_ref))
    )
  }
  function isEdgeDimmed(link: RiskLink): boolean {
    return hasSelection && !isEdgeHighlighted(link)
  }

  const selectedNode = nodes.find((n) => selectedRefs.has(n.ref)) ?? null

  // Every distinct category actually present among all 12 nodes, in the
  // order they first appear -- not the full RISK_CATEGORIES list, which
  // would include categories no risk on this graph actually has.
  const presentCategories = [...new Set(nodes.map((n) => n.category))]

  return (
    <div className="flex h-full flex-col rounded-[11px] bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground sm:text-lg">
          {t("home.productDemo.riskGraph.title")}
        </h3>
        <span className="font-mono-data text-[10px] text-muted-foreground">
          {t("home.productDemo.riskGraph.nodeCount", { count: nodes.length })}
        </span>
      </div>

      {/* CEO feedback: this used to be a fixed-square svg directly in flow,
          so on the two-column rail (items-stretch makes this card match
          LandingRiskMatrixWidget's often-taller height) it stayed a small
          square pinned to the top, leaving a dead gap before the
          mt-auto-pinned legend below. flex-1 grows this wrapper to fill
          that gap; the ResizeObserver above reports its real box, which
          layoutNodesInBox uses so the graph actually fills it. */}
      <div ref={containerRef} className="min-h-[200px] w-full flex-1">
        <svg
          viewBox={`0 0 ${box.width} ${box.height}`}
          className="h-full w-full"
          role="img"
          aria-label={t("home.productDemo.riskGraph.chartLabel", {
            name: nodeByRef.get(hubRef)?.name ?? hubRef,
            count: linksToHub.length,
          })}
        >
          {/* Arrowhead markers for the two directed link types (CAUSES/
              AMPLIFIES) -- CORRELATES has no inherent direction, same as
              RiskGraphPage.tsx, so it stays arrowless. A dimmed variant per
              type (not just the line's own strokeOpacity) because a shared
              <marker> can't itself react to one particular line's dimmed
              state -- same reasoning and markerUnits="userSpaceOnUse" (so
              the arrowhead's size doesn't also multiply with the line's own
              strokeWidth change) as RiskGraphPage's own defs. */}
          <defs>
            <marker
              id="riskGraphWidgetArrowCauses"
              viewBox="0 0 10 7"
              refX="9"
              refY="3.5"
              markerUnits="userSpaceOnUse"
              markerWidth="6"
              markerHeight="4.2"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={LINK_TYPE_COLOR.CAUSES} />
            </marker>
            <marker
              id="riskGraphWidgetArrowCausesDimmed"
              viewBox="0 0 10 7"
              refX="9"
              refY="3.5"
              markerUnits="userSpaceOnUse"
              markerWidth="6"
              markerHeight="4.2"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={LINK_TYPE_COLOR.CAUSES}
                fillOpacity={0.08}
              />
            </marker>
            <marker
              id="riskGraphWidgetArrowAmplifies"
              viewBox="0 0 10 7"
              refX="9"
              refY="3.5"
              markerUnits="userSpaceOnUse"
              markerWidth="6"
              markerHeight="4.2"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={LINK_TYPE_COLOR.AMPLIFIES}
              />
            </marker>
            <marker
              id="riskGraphWidgetArrowAmplifiesDimmed"
              viewBox="0 0 10 7"
              refX="9"
              refY="3.5"
              markerUnits="userSpaceOnUse"
              markerWidth="6"
              markerHeight="4.2"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={LINK_TYPE_COLOR.AMPLIFIES}
                fillOpacity={0.08}
              />
            </marker>
          </defs>

          {MOCK_RISK_LINKS.map((link, i) => {
            const source = nodeByRef.get(link.source_ref)
            const target = nodeByRef.get(link.target_ref)
            if (!source || !target) return null
            const dimmed = isEdgeDimmed(link)
            const edgeHighlighted = isEdgeHighlighted(link)

            // Shortens the line so its head lands on the target node's own
            // edge instead of its center -- otherwise the arrowhead below
            // renders hidden under the node circle, same fix and reasoning
            // as RiskGraphPage's own line-clip.
            const dx = target.x - source.x
            const dy = target.y - source.y
            const len = Math.hypot(dx, dy) || 1
            const ratio = len > target.radius ? (len - target.radius) / len : 1
            const ex = source.x + dx * ratio
            const ey = source.y + dy * ratio

            return (
              <line
                key={link.id}
                x1={source.x}
                y1={source.y}
                x2={ex}
                y2={ey}
                pathLength={1}
                stroke={LINK_TYPE_COLOR[link.link_type] ?? "hsl(var(--primary))"}
                className={`transition-[stroke-dashoffset,stroke-opacity] duration-700 ease-out motion-reduce:transition-none ${
                  animate ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:1]"
                }`}
                style={animate ? { transitionDelay: `${i * 150}ms` } : undefined}
                // CEO feedback: strokeWidth/strokeOpacity now match
                // RiskGraphPage's own real 3-state contrast (normal/
                // highlighted/dimmed), not a flat 0.35/0.15 regardless of
                // whether this specific edge touches the selection --
                // that flat range read as "everything faded slightly,"
                // not "these specific links are the correlation."
                strokeWidth={edgeHighlighted ? 5 : dimmed ? 2 : 3}
                strokeOpacity={edgeHighlighted ? 0.8 : dimmed ? 0.08 : 0.35}
                strokeDasharray={1}
                markerEnd={
                  link.link_type === "CAUSES"
                    ? dimmed
                      ? "url(#riskGraphWidgetArrowCausesDimmed)"
                      : "url(#riskGraphWidgetArrowCauses)"
                    : link.link_type === "AMPLIFIES"
                      ? dimmed
                        ? "url(#riskGraphWidgetArrowAmplifiesDimmed)"
                        : "url(#riskGraphWidgetArrowAmplifies)"
                      : undefined
                }
              />
            )
          })}

          {nodes.map((node, i) => {
            const color = categoryColor(node.category)
            const dimmed = isNodeDimmed(node.ref)
            const isSelected = selectedRefs.has(node.ref)
            const isCascaded = isNodeCascaded(node.ref)
            const isHub = node.ref === hubRef
            return (
              <g
                key={node.ref}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={t("home.productDemo.riskGraph.nodeAriaLabel", {
                  ref: node.ref,
                  name: node.name,
                })}
                onClick={() => selectRef(node.ref)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    selectRef(node.ref)
                  }
                }}
                className={`focus-ring-svg origin-center cursor-pointer transition-all duration-500 ease-out motion-reduce:transition-none ${
                  animate ? "scale-100 opacity-100" : "scale-50 opacity-0"
                }`}
                style={
                  animate
                    ? {
                        transitionDelay: `${i * 60}ms`,
                        transformBox: "fill-box",
                      }
                    : { transformBox: "fill-box" }
                }
                opacity={dimmed ? 0.3 : 1}
              >
                {/* Selected-node ring (primary) vs. correlated-but-not-
                    selected ring (destructive) -- same dashed/animated
                    treatment and same two-color distinction RiskGraphPage's
                    own isSelected/isCascaded rings use, so a click on this
                    graph visibly marks its correlated risks the same way
                    clicking a matrix cell already does, not just dim
                    everyone else. */}
                {(isSelected || isCascaded) && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius + 5}
                    fill="none"
                    stroke={
                      isSelected
                        ? "hsl(var(--primary))"
                        : "hsl(var(--destructive))"
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
                {/* fillOpacity/strokeOpacity match RiskGraphPage.tsx's own
                    unselected-node ring exactly (RiskGraphNode's base
                    circle) for a linked node; the hub gets a brighter fill
                    (0.25, between RiskGraphPage's unselected/selected
                    states) since it's always at least the visual focus. */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill={color}
                  fillOpacity={isHub ? 0.25 : 0.15}
                  stroke={color}
                  strokeWidth={isHub ? 2.5 : 2}
                  strokeOpacity={isHub ? 1 : 0.7}
                />
                {isHub && (
                  <Zap
                    x={node.x + node.radius * 0.4}
                    y={node.y - node.radius - 8}
                    width={13}
                    height={13}
                    className="fill-accent text-accent"
                  />
                )}
                <text
                  x={node.x}
                  y={node.y - 2}
                  textAnchor="middle"
                  className="fill-foreground text-[7px] font-bold select-none"
                >
                  {node.ref}
                </text>
                <text
                  x={node.x}
                  y={node.y + 8}
                  textAnchor="middle"
                  className="font-mono-data fill-muted-foreground text-[6px] select-none"
                >
                  {prLabel}
                  {node.pageRankDisplay}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* One announcement per selection change, same pattern
          ConnectedDataModelSection's own single aria-live region uses
          rather than a per-node "pressed"/"not pressed" toggle on every
          node -- fires once when the shared highlight state actually
          changes, not on every unrelated focus move. */}
      <span role="status" aria-live="polite" className="sr-only">
        {selectedNode
          ? t("home.productDemo.riskGraph.highlightAnnouncement", {
              ref: selectedNode.ref,
            })
          : ""}
      </span>

      {/* No longer mt-auto: the svg's own flex-1 wrapper above now consumes
          the card's stretched extra height directly, so this trailing
          block just follows in normal flow instead of needing to be
          pushed to the bottom itself. */}
      <div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3">
          {(["CAUSES", "AMPLIFIES", "CORRELATES"] as const).map((type) => (
            <span
              key={type}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
            >
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: LINK_TYPE_COLOR[type] }}
              />
              {t(
                `organization.riskGraph.legend${type.charAt(0)}${type.slice(1).toLowerCase()}`
              )}
            </span>
          ))}
        </div>

        {/* Category legend: node color-coding (categoryColor above)
            already existed, but nothing on this card explained what those
            colors meant -- only every distinct category actually present
            on this graph, not the full RISK_CATEGORIES list. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2">
          {presentCategories.map((category) => (
            <span
              key={category}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: categoryColor(category) }}
              />
              {riskCategoryLabel(t, category)}
            </span>
          ))}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {t("home.productDemo.riskGraph.caption", {
            name: nodeByRef.get(hubRef)?.name ?? hubRef,
            count: linksToHub.length,
          })}
        </p>
      </div>
    </div>
  )
}
