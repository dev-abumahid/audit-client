import { Zap } from "lucide-react"
import { useMemo, useState } from "react"
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

const VIEW_SIZE = 320
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

function buildGraph(): {
  nodes: GraphNode[]
  nodeByRef: Map<string, GraphNode>
} | null {
  if (MOCK_RISKS.length === 0) return null

  const refs = MOCK_RISKS.map((r) => r.ref)
  const edges = buildRiskCorrelationEdges(MOCK_RISK_LINKS)
  const rawScores = computePageRank(refs, edges)
  const maxScore = Math.max(...Object.values(rawScores), 0)
  const normalize = (ref: string) =>
    maxScore > 0 ? Math.round((rawScores[ref] / maxScore) * 100) : 0

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

  // Rescales the layout's own raw coordinate space (sized for a full
  // dashboard canvas, e.g. up to ~900x600+) down into this compact card's
  // fixed VIEW_SIZE, preserving relative spacing/topology exactly --
  // uniform scale on both axes, centered.
  const scale = Math.min(
    (VIEW_SIZE - PADDING * 2) / layout.width,
    (VIEW_SIZE - PADDING * 2) / layout.height
  )
  const offsetX = (VIEW_SIZE - layout.width * scale) / 2
  const offsetY = (VIEW_SIZE - layout.height * scale) / 2

  const nodes: GraphNode[] = MOCK_RISKS.map((risk) => {
    const pos = layout.positions[risk.ref]
    const pageRankDisplay = normalize(risk.ref)
    return {
      ref: risk.ref,
      name: risk.name,
      category: risk.category,
      x: pos.x * scale + offsetX,
      y: pos.y * scale + offsetY,
      radius: MIN_RADIUS + (pageRankDisplay / 100) * (MAX_RADIUS - MIN_RADIUS),
      pageRankDisplay,
    }
  })

  // See resolveNodeOverlaps' own comment: guarantees no two circles touch
  // using THIS widget's real radii, independent of whatever separation
  // assumption computeRiskGraphLayout's own raw-unit constants made.
  resolveNodeOverlaps(nodes, 4, VIEW_SIZE)

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
  const built = useMemo(() => buildGraph(), [])
  const [localSelectedRefs, setLocalSelectedRefs] = useState<Set<string>>(
    new Set()
  )
  const selectedRefs = controlledSelectedRefs ?? localSelectedRefs

  if (!built) return null
  const { nodes, nodeByRef } = built
  const prLabel = t("organization.riskGraph.pagerankAbbrLabel")

  // The highest-PageRank node gets the hub's visual treatment (ping ring,
  // Zap icon) -- computed from the real score rather than a hardcoded ref,
  // so this stays correct if the mock data or link set ever changes.
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

  // An edge only stays bright when it touches an actually-selected ref
  // directly -- not just "somewhere in the highlighted set" -- so
  // selecting a node doesn't light up an edge between two of its OTHER
  // neighbors that has nothing to do with the click itself.
  function isEdgeDimmed(link: RiskLink): boolean {
    if (!hasSelection) return false
    return (
      !selectedRefs.has(link.source_ref) && !selectedRefs.has(link.target_ref)
    )
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

      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        className="w-full"
        role="img"
        aria-label={t("home.productDemo.riskGraph.chartLabel", {
          name: nodeByRef.get(hubRef)?.name ?? hubRef,
          count: linksToHub.length,
        })}
      >
        {MOCK_RISK_LINKS.map((link, i) => {
          const source = nodeByRef.get(link.source_ref)
          const target = nodeByRef.get(link.target_ref)
          if (!source || !target) return null
          const dimmed = isEdgeDimmed(link)
          return (
            <line
              key={link.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              pathLength={1}
              stroke={LINK_TYPE_COLOR[link.link_type] ?? "hsl(var(--primary))"}
              className={`transition-[stroke-dashoffset,stroke-opacity] duration-700 ease-out motion-reduce:transition-none ${
                animate ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:1]"
              }`}
              style={animate ? { transitionDelay: `${i * 150}ms` } : undefined}
              // strokeWidth/strokeOpacity match RiskGraphPage's own
              // unselected-edge rendering; dimmed drops opacity further,
              // same floor RiskGraphPage's own cascade-dim uses.
              strokeWidth={dimmed ? 2 : 3}
              strokeOpacity={dimmed ? 0.15 : 0.35}
              strokeDasharray={1}
            />
          )
        })}

        {nodes.map((node, i) => {
          const color = categoryColor(node.category)
          const dimmed = isNodeDimmed(node.ref)
          const isSelected = selectedRefs.has(node.ref)
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
                  ? { transitionDelay: `${i * 60}ms`, transformBox: "fill-box" }
                  : { transformBox: "fill-box" }
              }
              opacity={dimmed ? 0.3 : 1}
            >
              {isHub && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius + 6}
                  className="fill-none stroke-risk-critical/40 motion-safe:animate-ping"
                  style={{ animationDuration: "2.5s" }}
                />
              )}
              {/* Selected-node highlight ring, same dashed/animated
                  treatment RiskGraphPage's own cascade circle uses. */}
              {isSelected && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius + 5}
                  fill="none"
                  stroke="hsl(var(--primary))"
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

      {/* mt-auto wraps both trailing blocks -- pushes them to the bottom of
          the card's stretched height as one unit. */}
      <div className="mt-auto">
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
