import { Zap } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  MOCK_RISK_LINKS,
  MOCK_RISKS,
} from "@/dashboard/organization/overview/overviewMockData"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import {
  buildRiskCorrelationEdges,
  computePageRank,
} from "@/utils/pageRank"

// Phase E redesign: a simplified, statically-laid-out stand-in for the real
// RiskGraphPage (force-simulated, draggable, zoomable -- far more than a
// marketing visual needs). Nodes/edges are the SAME real mock data
// (MOCK_RISK_LINKS/MOCK_RISKS) the real Overview/Correlation-Matrix pages
// use for their own "Tipping Points" panel: CYB-014 is the deliberate hub
// three other risks link to (AMPLIFIES/CAUSES/CORRELATES), so this graph's
// "most-connected node" claim is real, not staged for this widget alone.
//
// Visual-fidelity pass: the first version used solid-fill circles colored
// by SEVERITY with no PageRank score and one flat edge color -- the real
// RiskGraphPage rings its nodes (fill+stroke both the node's CATEGORY
// color), labels each with its actual computed PageRank score, and colors
// edges by link_type (CAUSES/AMPLIFIES/CORRELATES, three different
// colors + a legend). This version borrows all of that, including running
// the SAME computePageRank algorithm (src/utils/pageRank.ts) the real
// Overview/RiskGraph pages use, on this widget's own small node/edge set --
// a real (if tiny) PageRank result, not a fabricated "PR:100" label.
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
  // Review finding (round 1): a non-null assertion on this lookup would
  // crash the entire public homepage if a future mock-data edit ever
  // removed the hub risk. Returns null and the component renders nothing
  // instead.
  const hubRisk = MOCK_RISKS.find((r) => r.ref === HUB_REF)
  if (!hubRisk) return null

  const satelliteRisks = MOCK_RISK_LINKS.map((link) =>
    MOCK_RISKS.find((r) => r.ref === link.source_ref)
  ).filter((r): r is NonNullable<typeof r> => !!r)

  // Review finding on PR #1011: on this specific 4-node/3-edge fixture,
  // two of the three satellites (SUP-007, FIN-009) genuinely tie at the
  // same normalized score -- both have zero inbound edges, so PageRank
  // correctly gives them equal rank. Confirmed correct by hand-solving the
  // fixed point, not a bug or a placeholder value repeating by accident.
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
  if (!built) return null
  const { hub, satellites } = built
  const prLabel = t("organization.riskGraph.pagerankAbbrLabel")

  return (
    <div className="rounded-[11px] bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
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
          return (
            <line
              key={link.id}
              x1={node.x}
              y1={node.y}
              x2={hub.x}
              y2={hub.y}
              pathLength={1}
              stroke={LINK_TYPE_COLOR[link.link_type] ?? "hsl(var(--primary))"}
              className={`transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none ${
                animate ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:1]"
              }`}
              style={
                animate ? { transitionDelay: `${i * 150}ms` } : undefined
              }
              // Review finding on PR #1011: strokeWidth/strokeOpacity are
              // now the same values RiskGraphPage.tsx's own unselected-edge
              // rendering uses (RiskGraphLinkLine's `color`/isCascade=false
              // branch), not an approximation.
              strokeWidth={3}
              strokeOpacity={0.35}
              strokeDasharray={1}
            />
          )
        })}

        {satellites.map((node, i) => {
          const color = categoryColor(node.category)
          return (
            <g
              key={node.ref}
              className={`origin-center transition-all duration-500 ease-out motion-reduce:transition-none ${
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
            >
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
          className={`origin-center transition-all delay-700 duration-500 ease-out motion-reduce:transition-none ${
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
          {/* fillOpacity 0.25 is a deliberate in-between value, not a real-
              page match: RiskGraphPage's own node has an unselected state
              (0.15) and a selected/cascaded state (0.35), but this hub has
              no click-driven selection state to map to -- it's always the
              visual focus by design. Sits between the two intentionally. */}
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

      <p className="mt-2 text-xs text-muted-foreground">
        {t("home.productDemo.riskGraph.caption", {
          name: hub.name,
          count: satellites.length,
        })}
      </p>
    </div>
  )
}
