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

// CEO feedback: once a risk is selected, the abstract Causes/Amplifies/
// Correlates definitions should give way to a real, readable sentence
// about the SPECIFIC relationships now highlighted -- "CYB-009 causes
// CYB-014" means nothing to a first-time visitor. Each real edge gets its
// own plain-English mechanism (why, not just that), grounded in these
// risks' own real descriptions in riskMatrixMockData.ts -- not a
// templated "{ref} causes {ref}" plugged into an i18n string, which is
// why this stays English-only content (same convention MOCK_RISKS' own
// name/description fields already use -- those render as literal text,
// never through t(), same as every other landing-page mock risk name).
const RELATIONSHIP_VERB: Record<string, string> = {
  CAUSES: "causes",
  AMPLIFIES: "amplifies",
  CORRELATES: "correlates with",
}

// Keyed by MOCK_RISK_LINKS' own `id` field -- one short, real "why" per
// edge (kept to a few words: a visitor scanning several of these at once
// won't read a paragraph per edge), not a generic placeholder. A link
// with no entry falls back to a plain relationship statement (see
// buildRelationshipSentence below) rather than rendering "undefined."
const LINK_RATIONALE: Record<string, string> = {
  "link-1":
    "weak segmentation and an unpatched perimeter are the same underlying gap — once one gives ground, little contains the other",
  "link-2": "both would drain the same limited incident-response capacity",
  "link-3":
    "this site's overdue access review and unpatched gateway are the same identity-oversight gap",
  "link-4": "less slack to absorb a forced production stop",
  "link-5": "same budget cycle, competing capital asks",
  "link-6": "same gap: weak contractor and permit oversight at this hub",
  "link-7": "a second open finding reads as a pattern, not a one-off",
  "link-8":
    "same pattern: a supply chain concentrated on one lane or one vendor, no built-in alternative",
  "link-9": "no spare capacity if either supplier fails",
  "link-10":
    "thin redundancy either way — one person, one handwritten process, no backup for either",
  "link-11": "both trade long-term reliability for keeping the line running today",
}

// One short sentence per edge: "{source name} ({ref}) {verb} {target
// name} ({ref}) — {reason}." Names carry the meaning, refs stay in
// parens for cross-referencing the graph/matrix, and the reason is this
// specific edge's own real, terse rationale (LINK_RATIONALE above), not a
// generic template or a paragraph.
function buildRelationshipSentence(
  link: RiskLink,
  nodeByRef: Map<string, GraphNode>
): string | null {
  const source = nodeByRef.get(link.source_ref)
  const target = nodeByRef.get(link.target_ref)
  if (!source || !target) return null
  const verb = RELATIONSHIP_VERB[link.link_type] ?? "is linked to"
  const rationale = LINK_RATIONALE[link.id]
  const base = `${source.name} (${source.ref}) ${verb} ${target.name} (${target.ref})`
  return rationale ? `${base} — ${rationale}.` : `${base}.`
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
// Matches the r={node.radius + 5} selection/cascade ring below -- hoisted
// so both the padding/overlap math in layoutNodesInBox and the edge
// line-clipping in the render loop agree on the same margin.
const RING_MARGIN = 5
// How far clear of an unrelated node's circle a straight edge must pass
// to read as "not touching it" -- same margin convention
// resolveNodeOverlaps' own push-apart pass uses (margin=4).
const LINE_CLEARANCE = 4

// CEO feedback (live-verified, screenshot): a straight edge between two
// nodes can pass directly through a THIRD, unrelated node that happens to
// sit near/on that line -- e.g. OPS-011 to OPS-031's edge ran right
// through OPS-009's circle even though OPS-009 isn't part of that link.
// Rather than bending the edge's own line around the obstruction (edges
// stay straight, full stop -- direct product feedback), this moves the
// BLOCKING NODE itself instead, the same way resolveNodeOverlaps already
// moves nodes to clear each other. Runs as its own bounded-pass loop
// (nudging one node to clear one edge can put it too close to a
// different edge or node, so this re-checks every pass) and mutates
// `nodes` in place; the caller re-runs resolveNodeOverlaps afterward to
// restore node/node separation and the box bounds clamp, since a push
// here can reintroduce either.
function resolveNodeEdgeOverlaps(nodes: GraphNode[], links: RiskLink[]) {
  const nodeByRef = new Map(nodes.map((n) => [n.ref, n]))
  const maxPasses = 6
  for (let pass = 0; pass < maxPasses; pass++) {
    let violated = false
    for (const node of nodes) {
      for (const link of links) {
        if (link.source_ref === node.ref || link.target_ref === node.ref) {
          continue
        }
        const a = nodeByRef.get(link.source_ref)
        const b = nodeByRef.get(link.target_ref)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const relX = node.x - a.x
        const relY = node.y - a.y
        const proj = relX * ux + relY * uy
        // Only a node whose closest point on the edge actually falls
        // within the segment (not off one end) can visually read as
        // sitting "on" that edge's path.
        if (proj <= 0 || proj >= len) continue
        const px = -uy
        const py = ux
        const perp = relX * px + relY * py
        const clearanceNeeded = node.radius + LINE_CLEARANCE
        const dist = Math.abs(perp)
        if (dist < clearanceNeeded) {
          violated = true
          const push = clearanceNeeded - dist + 0.5
          const sign = perp >= 0 ? 1 : -1
          node.x += px * push * sign
          node.y += py * push * sign
        }
      }
    }
    if (!violated) break
  }
}

// Standard cross-product-based segment intersection test -- true only for
// a genuine crossing (each segment's endpoints fall on opposite sides of
// the other), not merely touching or collinear-overlapping.
function segmentsCross(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): boolean {
  const cross = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number }
  ) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
}

function pointToSegmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)
  )
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

// Minimum distance between two SEGMENTS (not the infinite lines) -- 0 for
// a genuine crossing, otherwise the smallest of each segment's endpoints
// measured against the other segment. CEO feedback: eliminating outright
// crossings wasn't enough on its own -- two edges that pass close beside
// each other without technically crossing still read as "too close," so
// resolveEdgeCrossings below treats ANY distance under a minimum
// clearance as a violation, not just a literal intersection.
function segmentDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): number {
  if (segmentsCross(a, b, c, d)) return 0
  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b)
  )
}

// CEO feedback (live-verified, screenshot): two DIFFERENT edges (sharing
// no node) can cross each other -- e.g. OPS-011 to OPS-031's edge and
// OPS-009 to OPS-018's edge crossed right next to OPS-009, reading as a
// confusing tangle. Same non-bending approach as resolveNodeEdgeOverlaps:
// nudges one of the crossing edges' own endpoints (not the edges
// themselves), just enough to uncross them. Doesn't guarantee zero
// crossings for an arbitrary graph -- true crossing-minimization is a
// much harder layout problem -- but resolves the common case of one or
// two isolated crossings in a small graph like this one.
//
// Also generalized past literal crossings: CEO feedback found two edges
// that never technically crossed but ran close enough beside each other
// to read as overlapping. `minClearance` treats ANY pair closer than that
// (via segmentDistance) as a violation, not just segmentsCross's binary
// intersection test.
//
// `baseUnit` scales the push with the box's own node radii (the caller
// passes maxRadius) -- live debugging found a small, fixed push (e.g. 8
// units) essentially never actually flips a crossing's side-of-line
// outcome for typical edge lengths in this graph; it just nudges the
// mover a little and gets re-detected as "still crossing" every
// subsequent pass, forever. A push proportional to the graph's own scale
// (tried at increasing multiples below) reliably clears it in 1-2 tries
// instead.
function resolveEdgeCrossings(
  nodes: GraphNode[],
  links: RiskLink[],
  baseUnit: number,
  minClearance: number
) {
  const nodeByRef = new Map(nodes.map((n) => [n.ref, n]))
  const maxPasses = 8
  for (let pass = 0; pass < maxPasses; pass++) {
    let violated = false
    for (let i = 0; i < links.length; i++) {
      for (let j = i + 1; j < links.length; j++) {
        const l1 = links[i]
        const l2 = links[j]
        if (
          l1.source_ref === l2.source_ref ||
          l1.source_ref === l2.target_ref ||
          l1.target_ref === l2.source_ref ||
          l1.target_ref === l2.target_ref
        ) {
          continue
        }
        const a = nodeByRef.get(l1.source_ref)
        const b = nodeByRef.get(l1.target_ref)
        const c = nodeByRef.get(l2.source_ref)
        const d = nodeByRef.get(l2.target_ref)
        if (!a || !b || !c || !d) continue
        if (segmentDistance(a, b, c, d) >= minClearance) continue
        violated = true

        // Moving a FAR endpoint barely changes the clearance between the
        // two segments -- the node that actually determines it is
        // whichever of the four sits closest to the OTHER segment. Push
        // that one instead, perpendicular to the other edge, which
        // directly moves it off that edge's line.
        const candidates = [
          {
            node: a,
            other: [c, d] as const,
            self: [a, b] as const,
            dist: pointToSegmentDistance(a, c, d),
          },
          {
            node: b,
            other: [c, d] as const,
            self: [a, b] as const,
            dist: pointToSegmentDistance(b, c, d),
          },
          {
            node: c,
            other: [a, b] as const,
            self: [c, d] as const,
            dist: pointToSegmentDistance(c, a, b),
          },
          {
            node: d,
            other: [a, b] as const,
            self: [c, d] as const,
            dist: pointToSegmentDistance(d, a, b),
          },
        ]
        candidates.sort((x, y) => x.dist - y.dist)

        // Tries both perpendicular directions, at increasing push
        // magnitudes, on each of the (up to 4) candidate movers in
        // distance-to-violation order -- actually re-testing segmentDistance
        // after each simulated move, taking the first combination that
        // genuinely clears it, rather than committing to a single
        // heuristic guess that can dead-end (e.g. against the box's own
        // bounds-clamp, re-applied every pass by resolveNodeOverlaps)
        // without ever being large enough to flip the outcome.
        let resolved = false
        for (const { node: mover, other, self } of candidates) {
          const [oa, ob] = other
          const dx = ob.x - oa.x
          const dy = ob.y - oa.y
          const len = Math.hypot(dx, dy) || 1
          const px = -dy / len
          const py = dx / len
          for (const multiplier of [1, 2, 3.5]) {
            const push = baseUnit * multiplier
            for (const sign of [1, -1]) {
              const nx = mover.x + px * push * sign
              const ny = mover.y + py * push * sign
              const [s1, s2] = self
              const movedA = mover === s1 ? { x: nx, y: ny } : s1
              const movedB = mover === s2 ? { x: nx, y: ny } : s2
              if (segmentDistance(movedA, movedB, oa, ob) >= minClearance) {
                mover.x = nx
                mover.y = ny
                resolved = true
                break
              }
            }
            if (resolved) break
          }
          if (resolved) break
        }
        // Nothing tried cleared it outright (a rare, tightly-constrained
        // layout) -- still apply a modest best-effort move on the closest
        // candidate, so this doesn't silently leave the crossing
        // completely untouched.
        if (!resolved) {
          const { node: mover, other } = candidates[0]
          const [oa, ob] = other
          const dx = ob.x - oa.x
          const dy = ob.y - oa.y
          const len = Math.hypot(dx, dy) || 1
          const px = -dy / len
          const py = dx / len
          const rel = (mover.x - oa.x) * px + (mover.y - oa.y) * py
          const sign = rel >= 0 ? 1 : -1
          mover.x += px * baseUnit * sign
          mover.y += py * baseUnit * sign
        }
      }
    }
    if (!violated) break
  }
}

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

  // CEO feedback: MIN_RADIUS/MAX_RADIUS were absolute SVG units tuned for
  // the old fixed 320x320 viewBox, which usually rendered at a larger CSS
  // size than its own 320-unit coordinate space (so 1 unit > 1 physical
  // pixel -- an implicit zoom-in). Now that the viewBox matches the card's
  // real measured box directly (no implicit zoom), those same absolute
  // radii render literally 8-20 physical pixels, visibly smaller than
  // before. Scaling both by the box's own size relative to that original
  // 320 reference restores the same relative node size the design always
  // intended, without hardcoding a new guess at "how much CSS zoom used
  // to happen" for every possible card height.
  const radiusScale = Math.min(box.width, box.height) / DEFAULT_BOX.width
  // Floors keep proportional scale-down from shrinking touch targets below
  // a real minimum on small cards, without changing desktop's sizing.
  const minRadius = Math.max(MIN_RADIUS * radiusScale, 12)
  const maxRadius = Math.max(MAX_RADIUS * radiusScale, 18)

  // CEO feedback (live-verified, screenshot): a node near the content's
  // edge could still spill its selection ring (rendered at radius+
  // RING_MARGIN, see the r={node.radius + 5} below) past the card's own
  // border -- the fixed PADDING (28) was tuned for the old, much smaller
  // MAX_RADIUS (20) and never accounted for the ring at all. Reserving at
  // least maxRadius+RING_MARGIN of padding guarantees even the biggest
  // node's ring fits inside the box before any node is placed.
  const effectivePadding = Math.max(PADDING, maxRadius + RING_MARGIN)
  const scaleX = (box.width - effectivePadding * 2) / contentWidth
  const scaleY = (box.height - effectivePadding * 2) / contentHeight
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
      radius: minRadius + (pageRankDisplay / 100) * (maxRadius - minRadius),
      pageRankDisplay,
    }
  })

  // See resolveNodeOverlaps' own comment: guarantees no two circles touch
  // using THIS widget's real radii, independent of whatever separation
  // assumption computeRiskGraphLayout's own raw-unit constants made.
  //
  // Runs against radius+RING_MARGIN (not each node's plain radius) so its
  // own final bounds-clamp reserves room for the selection ring too --
  // any node can end up selected/cascaded, so every node needs that
  // clearance, not just whichever one happens to be selected right now.
  // Restored to the real radius afterward so the rendered circles below
  // aren't drawn inflated. Extracted as a closure (not a top-level
  // function) since it needs to run twice: once for the normal node/node
  // pass, and again after resolveNodeEdgeOverlaps below, which can itself
  // reintroduce a node/node overlap or push a node out of bounds while
  // clearing it from an edge's path.
  function applyNodeSeparation() {
    const nodesForOverlap = nodes.map((n) => ({
      ...n,
      radius: n.radius + RING_MARGIN,
    }))
    resolveNodeOverlaps(nodesForOverlap, 4, box.width, box.height)
    nodesForOverlap.forEach((n, i) => {
      nodes[i].x = n.x
      nodes[i].y = n.y
    })
  }
  applyNodeSeparation()

  // CEO feedback: two further, distinct layout problems neither node/node
  // separation nor the render-time endpoint clip catch -- (1) an edge
  // passing straight through an unrelated node's circle, and (2) two
  // unrelated edges crossing each other. Both are fixed by repositioning
  // a node (edges always stay straight, per direct product feedback), and
  // both can reintroduce a node/node overlap or push a node out of bounds
  // once they move something -- so this settles all three constraints
  // together across a few rounds rather than a single fixed pass order,
  // since fixing one can reopen another.
  // CEO feedback: zero literal crossings wasn't sufficient on its own --
  // two edges that pass close beside each other without technically
  // crossing still read as overlapping. minClearance (scaled off the
  // box's own node radius, same convention as every other constant here)
  // makes resolveEdgeCrossings treat that near-miss as a violation too.
  const minEdgeClearance = maxRadius * 0.3
  for (let round = 0; round < 4; round++) {
    resolveNodeEdgeOverlaps(nodes, MOCK_RISK_LINKS)
    applyNodeSeparation()
    resolveEdgeCrossings(nodes, MOCK_RISK_LINKS, maxRadius, minEdgeClearance)
    applyNodeSeparation()
  }

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

  // CEO feedback: while a selection is active, the legend below swaps the
  // generic Causes/Amplifies/Correlates definitions for a factual list of
  // THESE specific highlighted edges -- reuses isEdgeHighlighted (the
  // exact same set the graph itself brightens/arrows), so the copy always
  // matches what's actually lit up on screen, never a stale or invented
  // example.
  const highlightedLinks = hasSelection
    ? MOCK_RISK_LINKS.filter((l) => isEdgeHighlighted(l))
    : []

  const selectedNode = nodes.find((n) => selectedRefs.has(n.ref)) ?? null

  // Every distinct category actually present among all 12 nodes, in the
  // order they first appear -- not the full RISK_CATEGORIES list, which
  // would include categories no risk on this graph actually has.
  const presentCategories = [...new Set(nodes.map((n) => n.category))]

  return (
    <div className="flex h-full flex-col rounded-[11px] bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground sm:text-lg">
          {t("home.productDemo.riskGraph.title")}
        </h3>
        <span className="font-mono-data text-[10px] text-muted-foreground">
          {t("home.productDemo.riskGraph.nodeCount", { count: nodes.length })}
        </span>
      </div>

      {/* CEO feedback: a visitor unfamiliar with risk correlation had no
          way to know what this graph is even for before clicking around
          in it -- the type/category legends below only labeled the marks,
          they never explained the underlying idea. One plain-language
          sentence up front, before any interaction. */}
      <p className="mb-3 text-xs text-muted-foreground">
        {t("home.productDemo.riskGraph.intro")}
      </p>

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

            // Shortens BOTH ends so the line starts and ends at each
            // node's own edge instead of its center. Originally only the
            // target end was clipped (so the arrowhead wouldn't render
            // hidden under the node circle, same as RiskGraphPage's own
            // line-clip) -- but the source end still ran straight from
            // the node's center, which visibly cut across that node's own
            // selection/cascade ring (the ring is unfilled, so a line
            // passing through its hollow interior stays visible instead
            // of being covered). Clipping both ends to radius+RING_MARGIN
            // -- not just radius -- keeps the line clear of that ring
            // whether or not this specific node currently has one
            // rendered, so nothing shifts when a selection changes.
            const dx = target.x - source.x
            const dy = target.y - source.y
            const len = Math.hypot(dx, dy) || 1
            const sourceGap = source.radius + RING_MARGIN
            const targetGap = target.radius + RING_MARGIN
            const startRatio = len > sourceGap ? sourceGap / len : 0
            const endRatio =
              len > targetGap ? (len - targetGap) / len : startRatio
            const sx = source.x + dx * startRatio
            const sy = source.y + dy * startRatio
            const ex = source.x + dx * endRatio
            const ey = source.y + dy * endRatio

            return (
              <line
                key={link.id}
                x1={sx}
                y1={sy}
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
                {/* CEO feedback (live-verified, screenshot): a straight
                    edge that happens to pass behind an unrelated third
                    node stayed visible right through it -- the node's own
                    colored circle below is only 15-25% opaque, nowhere
                    near enough to hide a bright highlighted line (up to
                    80% stroke-opacity) passing underneath. An opaque
                    backing disc, matching the card's own background,
                    fully covers anything drawn behind a node regardless
                    of the colored circle's own transparency, without
                    touching the edges' geometry at all. */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill="hsl(var(--card))"
                />
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
        {/* CEO feedback: "Causes"/"Amplifies"/"Correlates" as single-word
            chips assumed the reader already knew what those distinctions
            mean for a risk register -- this line defines each one in
            plain terms while nothing is selected. Once a risk IS selected,
            this swaps to real sentences about THESE specific highlighted
            edges instead ("{{ref}} causes {{ref}}" reads as nothing to a
            first-time visitor -- buildRelationshipSentence names both
            risks and explains the actual mechanism from LINK_RATIONALE,
            one full sentence per real edge, not a templated fragment).
            Falls back to the generic definitions if a selection somehow
            highlights zero edges, so this never renders a bare "." */}
        <div className="border-t border-border pt-3 text-[11px] text-muted-foreground">
          {hasSelection && highlightedLinks.length > 0 ? (
            <div className="space-y-1.5">
              {highlightedLinks.map((l) => {
                const sentence = buildRelationshipSentence(l, nodeByRef)
                return sentence ? <p key={l.id}>{sentence}</p> : null
              })}
            </div>
          ) : (
            <p>{t("home.productDemo.riskGraph.linkTypeExplanation")}</p>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
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
          {/* CEO feedback: the hub node's Zap icon (rendered below, per
              isHub) had no explanation anywhere on this card -- added to
              the same row as the link-type legend since it's the same
              kind of "what does this mark mean" glossary entry. */}
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Zap className="h-3 w-3 fill-accent text-accent" />
            {t("home.productDemo.riskGraph.legendHub")}
          </span>
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
