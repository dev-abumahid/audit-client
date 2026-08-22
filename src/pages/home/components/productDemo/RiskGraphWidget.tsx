import { Zap } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  MOCK_RISK_LINKS,
  MOCK_RISKS,
} from "@/dashboard/organization/overview/overviewMockData"
import { RISK_CATEGORIES, riskCategoryLabel } from "@/utils/riskConfig"
import { buildRiskCorrelationEdges, computePageRank } from "@/utils/pageRank"

// A simplified, statically-laid-out stand-in for the real RiskGraphPage
// (force-simulated/draggable -- unnecessary for a marketing visual). Real
// mock data (MOCK_RISK_LINKS/MOCK_RISKS) and the same computePageRank
// algorithm the real Overview/RiskGraph pages use -- a real, if tiny,
// PageRank result, not a fabricated label. CYB-014 is the real hub three
// other risks link to. Node rings, PageRank labels, and edge-type legend
// colors match RiskGraphPage's own rendering.
const HUB_REF = "CYB-014"

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

const VIEW_SIZE = 280
const CENTER = VIEW_SIZE / 2

function buildNodes(): { hub: GraphNode; satellites: GraphNode[] } | null {
  // Returns null (renders nothing) rather than asserting -- a future
  // mock-data edit removing the hub risk shouldn't crash the homepage.
  const hubRisk = MOCK_RISKS.find((r) => r.ref === HUB_REF)
  if (!hubRisk) return null

  const satelliteRisks = MOCK_RISK_LINKS.map((link) =>
    MOCK_RISKS.find((r) => r.ref === link.source_ref)
  ).filter((r): r is NonNullable<typeof r> => !!r)

  // SUP-007 and FIN-009 tie at the same normalized score on this fixture
  // (both have zero inbound edges) -- correct PageRank output, not a bug.
  const allRefs = [hubRisk.ref, ...satelliteRisks.map((r) => r.ref)]
  const edges = buildRiskCorrelationEdges(MOCK_RISK_LINKS)
  const rawScores = computePageRank(allRefs, edges)
  const maxScore = Math.max(...Object.values(rawScores), 0)
  const normalize = (ref: string) =>
    maxScore > 0 ? Math.round((rawScores[ref] / maxScore) * 100) : 0

  const orbitRadius = 100
  const hub: GraphNode = {
    ref: hubRisk.ref,
    name: hubRisk.name,
    category: hubRisk.category,
    x: CENTER,
    y: CENTER,
    radius: 24,
    pageRankDisplay: normalize(hubRisk.ref),
  }

  const satellites: GraphNode[] = satelliteRisks.map((risk, i) => {
    const angle = (i / satelliteRisks.length) * Math.PI * 2 - Math.PI / 2
    return {
      ref: risk.ref,
      name: risk.name,
      category: risk.category,
      x: CENTER + orbitRadius * Math.cos(angle),
      y: CENTER + orbitRadius * Math.sin(angle),
      radius: 15,
      pageRankDisplay: normalize(risk.ref),
    }
  })

  return { hub, satellites }
}

function categoryColor(category: string): string {
  return (
    RISK_CATEGORIES[category as keyof typeof RISK_CATEGORIES]?.color ??
    "hsl(var(--muted-foreground))"
  )
}

export default function RiskGraphWidget({ animate }: { animate: boolean }) {
  const { t } = useTranslation()
  const built = buildNodes()
  // Click-to-highlight, matching the real RiskGraphPage's own
  // select/cascade behavior at the scope this star-topology demo actually
  // has: every satellite links only to the hub (no satellite-satellite
  // edges in MOCK_RISK_LINKS), so "cascade" here is just "the hub, plus
  // whichever one satellite is selected" -- selecting the hub itself
  // highlights everything, since it's already connected to all of them.
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  // Declared before the early return below so hook order stays fixed
  // regardless of buildNodes()'s result -- an early `if (!built) return
  // null` placed BEFORE a hook call would violate the rules of hooks the
  // instant a future mock-data edit ever made buildNodes() return null.
  if (!built) return null
  const { hub, satellites } = built
  const prLabel = t("organization.riskGraph.pagerankAbbrLabel")

  function toggleSelect(ref: string) {
    setSelectedRef((prev) => (prev === ref ? null : ref))
  }

  function isNodeDimmed(ref: string): boolean {
    if (selectedRef === null || selectedRef === hub.ref) return false
    return ref !== selectedRef && ref !== hub.ref
  }

  function isEdgeDimmed(sourceRef: string): boolean {
    if (selectedRef === null || selectedRef === hub.ref) return false
    return sourceRef !== selectedRef
  }

  const selectedNode =
    selectedRef === hub.ref
      ? hub
      : (satellites.find((s) => s.ref === selectedRef) ?? null)

  // Every distinct category actually present among the hub + satellites,
  // in the same order they first appear -- not the full RISK_CATEGORIES
  // list, which would show categories no node on this graph actually
  // uses.
  const presentCategories = [
    ...new Set([hub, ...satellites].map((n) => n.category)),
  ]

  return (
    <div className="flex h-full flex-col rounded-[11px] bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground sm:text-lg">
          {t("home.productDemo.riskGraph.title")}
        </h3>
        <span className="font-mono-data text-[10px] text-muted-foreground">
          {t("home.productDemo.riskGraph.nodeCount", {
            count: satellites.length + 1,
          })}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        className="w-full"
        role="img"
        aria-label={t("home.productDemo.riskGraph.chartLabel", {
          name: hub.name,
          count: satellites.length,
        })}
      >
        {MOCK_RISK_LINKS.map((link, i) => {
          const node = satellites.find((s) => s.ref === link.source_ref)
          if (!node) return null
          const dimmed = isEdgeDimmed(link.source_ref)
          return (
            <line
              key={link.id}
              x1={node.x}
              y1={node.y}
              x2={hub.x}
              y2={hub.y}
              pathLength={1}
              stroke={LINK_TYPE_COLOR[link.link_type] ?? "hsl(var(--primary))"}
              className={`transition-[stroke-dashoffset,stroke-opacity] duration-700 ease-out motion-reduce:transition-none ${
                animate ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:1]"
              }`}
              style={animate ? { transitionDelay: `${i * 150}ms` } : undefined}
              // strokeWidth/strokeOpacity match RiskGraphPage's own
              // unselected-edge rendering; dimmed drops opacity further,
              // same 0.15 floor RiskGraphPage's own cascade-dim uses.
              strokeWidth={dimmed ? 2 : 3}
              strokeOpacity={dimmed ? 0.15 : 0.35}
              strokeDasharray={1}
            />
          )
        })}

        {satellites.map((node, i) => {
          const color = categoryColor(node.category)
          const dimmed = isNodeDimmed(node.ref)
          const isSelected = selectedRef === node.ref
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
              onClick={() => toggleSelect(node.ref)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  toggleSelect(node.ref)
                }
              }}
              className={`focus-ring-svg origin-center cursor-pointer transition-all duration-500 ease-out motion-reduce:transition-none ${
                animate ? "scale-100 opacity-100" : "scale-50 opacity-0"
              }`}
              style={
                animate
                  ? {
                      transitionDelay: `${i * 150 + 500}ms`,
                      transformBox: "fill-box",
                    }
                  : { transformBox: "fill-box" }
              }
              opacity={dimmed ? 0.3 : 1}
            >
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
                  circle), not an approximation. */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill={color}
                fillOpacity={0.15}
                stroke={color}
                strokeWidth={2}
                strokeOpacity={0.7}
              />
              <text
                x={node.x}
                y={node.y - 2}
                textAnchor="middle"
                className="fill-foreground text-[9px] font-bold select-none"
              >
                {node.ref}
              </text>
              <text
                x={node.x}
                y={node.y + 9}
                textAnchor="middle"
                className="font-mono-data fill-muted-foreground text-[7px] select-none"
              >
                {prLabel}
                {node.pageRankDisplay}
              </text>
            </g>
          )
        })}

        <g
          tabIndex={0}
          role="button"
          aria-pressed={selectedRef === hub.ref}
          aria-label={t("home.productDemo.riskGraph.nodeAriaLabel", {
            ref: hub.ref,
            name: hub.name,
          })}
          onClick={() => toggleSelect(hub.ref)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              toggleSelect(hub.ref)
            }
          }}
          className={`focus-ring-svg origin-center cursor-pointer transition-all delay-700 duration-500 ease-out motion-reduce:transition-none ${
            animate ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
          style={{ transformBox: "fill-box" }}
        >
          <circle
            cx={hub.x}
            cy={hub.y}
            r={hub.radius + 6}
            className="fill-none stroke-risk-critical/40 motion-safe:animate-ping"
            style={{ animationDuration: "2.5s" }}
          />
          {/* Selecting the hub highlights the whole graph (it's already
              connected to every satellite), so it gets the same
              selected-ring treatment satellites do rather than a
              permanently-different "always focal" state. */}
          {selectedRef === hub.ref && (
            <circle
              cx={hub.x}
              cy={hub.y}
              r={hub.radius + 10}
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
          {/* fillOpacity 0.25 sits between RiskGraphPage's unselected
              (0.15) and selected (0.35) states -- this hub is always at
              least the visual focus, brighter still while selected via
              the ring above. */}
          <circle
            cx={hub.x}
            cy={hub.y}
            r={hub.radius}
            fill={categoryColor(hub.category)}
            fillOpacity={0.25}
            stroke={categoryColor(hub.category)}
            strokeWidth={2.5}
          />
          <Zap
            x={hub.x + hub.radius * 0.4}
            y={hub.y - hub.radius - 8}
            width={13}
            height={13}
            className="fill-accent text-accent"
          />
          <text
            x={hub.x}
            y={hub.y - 3}
            textAnchor="middle"
            className="fill-foreground text-[10px] font-bold select-none"
          >
            {hub.ref}
          </text>
          <text
            x={hub.x}
            y={hub.y + 11}
            textAnchor="middle"
            className="font-mono-data fill-muted-foreground text-[8px] select-none"
          >
            {prLabel}
            {hub.pageRankDisplay}
          </text>
        </g>
      </svg>

      {/* One announcement per selection change, same pattern
          ConnectedDataModelSection's own single aria-live region uses
          rather than a per-node "pressed"/"not pressed" toggle on all 5
          nodes -- fires once when the shared highlight state actually
          changes, not on every unrelated focus move. */}
      <span role="status" aria-live="polite" className="sr-only">
        {selectedNode
          ? t("home.productDemo.riskGraph.highlightAnnouncement", {
              ref: selectedNode.ref,
            })
          : ""}
      </span>

      {/* mt-auto wraps both trailing blocks -- pushes them to the bottom of
          the card's stretched height as one unit (this is the rail's
          tallest card today, but the wrapper keeps behavior consistent if
          that ever changes). */}
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

        {/* Category legend: the node color-coding (categoryColor above)
            already existed, but nothing on this card explained what those
            colors meant -- only every distinct category actually present
            on this graph, not the full RISK_CATEGORIES list, which would
            show swatches for categories no node here uses. */}
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
            name: hub.name,
            count: satellites.length,
          })}
        </p>
      </div>
    </div>
  )
}
