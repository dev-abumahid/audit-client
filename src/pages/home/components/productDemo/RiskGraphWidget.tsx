import { useTranslation } from "react-i18next"
import {
  MOCK_RISK_LINKS,
  MOCK_RISKS,
} from "@/dashboard/organization/overview/overviewMockData"
import { getRiskSeverityLevel } from "@/utils/riskScoring"

// Phase E redesign: a simplified, statically-laid-out stand-in for the real
// RiskGraphPage (force-simulated, draggable, zoomable -- far more than a
// marketing visual needs). Nodes/edges are the SAME real mock data
// (MOCK_RISK_LINKS/MOCK_RISKS) the real Overview/Correlation-Matrix pages
// use for their own "Tipping Points" panel: CYB-014 is the deliberate hub
// three other risks link to (AMPLIFIES/CAUSES/CORRELATES), so this graph's
// "most-connected node" claim is real, not staged for this widget alone.
const HUB_REF = "CYB-014"

const NODE_FILL: Record<string, string> = {
  low: "fill-risk-low",
  medium: "fill-risk-medium",
  high: "fill-risk-high",
  critical: "fill-risk-critical",
}

interface GraphNode {
  ref: string
  name: string
  x: number
  y: number
  radius: number
  severity: string
}

const VIEW_SIZE = 280
const CENTER = VIEW_SIZE / 2

function buildNodes(): GraphNode[] | null {
  // Review finding: this used a non-null assertion on the hub lookup --
  // fine today since CYB-014 genuinely exists in overviewMockData.ts, but
  // a future edit to that file (renaming/removing the hub risk) without
  // knowing this widget depends on it would crash the entire public
  // homepage, not just this widget. Returning null and letting the
  // component render nothing is a much smaller failure mode for a
  // marketing page than a hard crash.
  const hubRisk = MOCK_RISKS.find((r) => r.ref === HUB_REF)
  if (!hubRisk) return null

  const satelliteRefs = MOCK_RISK_LINKS.map((link) => link.source_ref)
  const satellites = satelliteRefs
    .map((ref) => MOCK_RISKS.find((r) => r.ref === ref))
    .filter((r): r is NonNullable<typeof r> => !!r)

  const radius = 100
  const nodes: GraphNode[] = [
    {
      ref: hubRisk.ref,
      name: hubRisk.name,
      x: CENTER,
      y: CENTER,
      // Larger radius signals higher graph centrality -- same visual
      // language the real RiskGraphPage uses (node size scales with
      // pagerank_score), just with a fixed value here rather than a
      // computed one, since this mock hub is deliberately hand-authored.
      radius: 22,
      severity: getRiskSeverityLevel(hubRisk.inherent_score),
    },
  ]

  satellites.forEach((risk, i) => {
    const angle = (i / satellites.length) * Math.PI * 2 - Math.PI / 2
    nodes.push({
      ref: risk.ref,
      name: risk.name,
      x: CENTER + radius * Math.cos(angle),
      y: CENTER + radius * Math.sin(angle),
      radius: 13,
      severity: getRiskSeverityLevel(risk.inherent_score),
    })
  })

  return nodes
}

export default function RiskGraphWidget({ animate }: { animate: boolean }) {
  const { t } = useTranslation()
  const nodes = buildNodes()
  if (!nodes) return null
  const hub = nodes[0]
  const satellites = nodes.slice(1)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
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
          name: hub.name,
          count: satellites.length,
        })}
      >
        {/* Edges: each drawn from satellite toward the hub, using the same
            pathLength=1 draw-in technique as KriTrendWidget, staggered per
            edge so they read as arriving one at a time rather than all at
            once. */}
        {satellites.map((node, i) => (
          <line
            key={node.ref}
            x1={node.x}
            y1={node.y}
            x2={hub.x}
            y2={hub.y}
            pathLength={1}
            className={`stroke-primary/40 transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none ${
              animate ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:1]"
            }`}
            style={animate ? { transitionDelay: `${i * 150}ms` } : undefined}
            strokeWidth={1.5}
            strokeDasharray={1}
          />
        ))}

        {/* Satellite nodes fade + scale in, staggered slightly after their
            own edge finishes drawing. */}
        {satellites.map((node, i) => (
          <g
            key={node.ref}
            className={`origin-center transition-all duration-500 ease-out motion-reduce:transition-none ${
              animate ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
            style={
              animate
                ? { transitionDelay: `${i * 150 + 500}ms`, transformBox: "fill-box" }
                : { transformBox: "fill-box" }
            }
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={node.radius}
              className={NODE_FILL[node.severity]}
              opacity={0.85}
            />
            <text
              x={node.x}
              y={node.y + node.radius + 14}
              textAnchor="middle"
              className="fill-muted-foreground font-mono-data text-[8px]"
            >
              {node.ref}
            </text>
          </g>
        ))}

        {/* Hub node last: the payoff of the sequence, with a soft pulse
            ring to draw the eye once everything else has settled. */}
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
          <circle
            cx={hub.x}
            cy={hub.y}
            r={hub.radius}
            className={NODE_FILL[hub.severity]}
          />
        </g>
      </svg>

      <p className="mt-1 text-xs text-muted-foreground">
        {t("home.productDemo.riskGraph.caption", {
          name: hub.name,
          count: satellites.length,
        })}
      </p>
    </div>
  )
}
