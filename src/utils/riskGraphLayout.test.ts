import { describe, expect, it } from "vitest"
import { computeRiskGraphLayout } from "./riskGraphLayout"

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

describe("computeRiskGraphLayout", () => {
  it("returns an empty layout for no risks", () => {
    const layout = computeRiskGraphLayout([])
    expect(layout.positions).toEqual({})
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })

  it("places a lone risk at a finite, defined position", () => {
    const layout = computeRiskGraphLayout([
      { ref: "RSK-001", category: "cyber" },
    ])
    const pos = layout.positions["RSK-001"]
    expect(pos).toBeDefined()
    expect(Number.isFinite(pos.x)).toBe(true)
    expect(Number.isFinite(pos.y)).toBe(true)
  })

  it("gives every risk a distinct position, even with many risks packed into a few categories", () => {
    // aexa-frontend#575: the previous algorithm capped each category's
    // cluster spread at a fixed 60px regardless of how many risks shared
    // that category, so any category with more than a handful of risks
    // produced total node overlap -- this is the regression case (20
    // categories x 4 risks, the exact shape load-testing surfaced).
    const categories = Array.from({ length: 20 }, (_, i) => `cat-${i}`)
    const risks = categories.flatMap((cat) =>
      Array.from({ length: 4 }, (_, i) => ({
        ref: `${cat}-${i}`,
        category: cat,
      }))
    )
    const { positions } = computeRiskGraphLayout(risks)

    expect(Object.keys(positions)).toHaveLength(risks.length)

    // No two risks should land close enough to visually overlap. The real
    // component's max node radius is ~35px (RiskGraphPage.tsx sizes it from
    // PageRank score), so two max-radius nodes need >=70px of separation to
    // not touch -- 60 leaves a small margin below that worst case while
    // still being far tighter than the ~20px gap the pre-fix "every node
    // in a category on the same 60px circle" regression produced (in that
    // regression most pairs landed within single-digit px of each other).
    const refs = Object.keys(positions)
    const MIN_SEPARATION = 60
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        const d = distance(positions[refs[i]], positions[refs[j]])
        expect(d).toBeGreaterThanOrEqual(MIN_SEPARATION)
      }
    }
  })

  it("grows the layout's width and height together as more risks are packed in, instead of only height", () => {
    // aexa-frontend#576 review round: category clusters sit on a circle
    // (equal extent in x and y), so a version that grew only height while
    // width stayed fixed clipped clusters near the ring's left/right
    // extremes even though the same clusters near the top/bottom fit fine.
    const small = computeRiskGraphLayout([
      { ref: "RSK-001", category: "cyber" },
      { ref: "RSK-002", category: "financial" },
    ])
    const categories = Array.from({ length: 20 }, (_, i) => `cat-${i}`)
    const manyRisks = categories.flatMap((cat) =>
      Array.from({ length: 4 }, (_, i) => ({
        ref: `${cat}-${i}`,
        category: cat,
      }))
    )
    const large = computeRiskGraphLayout(manyRisks)

    expect(large.height).toBeGreaterThan(small.height)
    expect(large.width).toBeGreaterThan(small.width)
  })

  it("keeps every risk within the layout's own width/height bounds, even at scale", () => {
    // A concrete regression check for the same clipping bug: every
    // computed position must actually fall inside [0, width] x [0, height]
    // -- not just that width/height grew, but that growth was enough.
    const categories = Array.from({ length: 20 }, (_, i) => `cat-${i}`)
    const risks = categories.flatMap((cat) =>
      Array.from({ length: 4 }, (_, i) => ({
        ref: `${cat}-${i}`,
        category: cat,
      }))
    )
    const { positions, width, height } = computeRiskGraphLayout(risks)

    for (const pos of Object.values(positions)) {
      expect(pos.x).toBeGreaterThanOrEqual(0)
      expect(pos.x).toBeLessThanOrEqual(width)
      expect(pos.y).toBeGreaterThanOrEqual(0)
      expect(pos.y).toBeLessThanOrEqual(height)
    }
  })

  it("keeps a lone risk in a category from landing at the exact same point as risks in other single-risk categories", () => {
    const risks = [
      { ref: "RSK-A", category: "cyber" },
      { ref: "RSK-B", category: "financial" },
      { ref: "RSK-C", category: "operational" },
    ]
    const { positions } = computeRiskGraphLayout(risks)
    const [a, b, c] = risks.map((r) => positions[r.ref])
    expect(distance(a, b)).toBeGreaterThan(0)
    expect(distance(b, c)).toBeGreaterThan(0)
    expect(distance(a, c)).toBeGreaterThan(0)
  })

  // aexa-frontend#577 round 13: replaced the pure category-ring layout with
  // a d3-force simulation seeded from that same ring math, so topology
  // (the actual CAUSES/AMPLIFIES/CORRELATES links) -- not just category --
  // drives final node placement.
  describe("topology-driven layout (#577 round 13)", () => {
    it("calling with identical risks and links twice produces identical positions", () => {
      // The direct regression guard against any hidden Math.random()
      // leaking in from d3-force's own defaults (forceManyBody/forceCollide
      // use it to break ties between coincident points) -- this file's
      // computeRiskGraphLayout always explicitly seeds x/y/vx/vy itself
      // specifically to avoid ever relying on that.
      const risks = [
        { ref: "RSK-A", category: "cyber" },
        { ref: "RSK-B", category: "cyber" },
        { ref: "RSK-C", category: "financial" },
      ]
      const links = [
        { source: "RSK-A", target: "RSK-B", kind: "CAUSES" as const },
        { source: "RSK-B", target: "RSK-C", kind: "AMPLIFIES" as const },
      ]
      const first = computeRiskGraphLayout(risks, links)
      const second = computeRiskGraphLayout(risks, links)
      expect(second.positions).toEqual(first.positions)
      expect(second.width).toBe(first.width)
      expect(second.height).toBe(first.height)
    })

    it("pulls two linked risks meaningfully closer together than the same two risks with no link at all", () => {
      // The core property this round exists to deliver: two risks in
      // different categories, connected by a real edge, should end up
      // visibly closer than if that edge didn't exist -- topology
      // overriding the category-ring's default (distant) placement.
      const risks = [
        { ref: "RSK-A", category: "cyber" },
        { ref: "RSK-B", category: "cyber" },
        { ref: "RSK-C", category: "financial" },
        { ref: "RSK-D", category: "operational" },
      ]
      const linked = computeRiskGraphLayout(risks, [
        { source: "RSK-C", target: "RSK-D", kind: "CAUSES" },
      ])
      const unlinked = computeRiskGraphLayout(risks, [])
      const linkedDistance = distance(
        linked.positions["RSK-C"],
        linked.positions["RSK-D"]
      )
      const unlinkedDistance = distance(
        unlinked.positions["RSK-C"],
        unlinked.positions["RSK-D"]
      )
      // Empirically ~99 (linked) vs ~358 (unlinked) for this exact fixture
      // -- asserting a generous fraction rather than a brittle exact number,
      // since LINK_DISTANCE_BY_KIND/CLUSTER_STRENGTH are tuned constants
      // that may shift slightly over time.
      expect(linkedDistance).toBeLessThan(unlinkedDistance / 2)
    })

    it("orders link-kind pull strength CAUSES > AMPLIFIES > CORRELATES, matching this page's existing severity color-coding", () => {
      function pairDistance(kind: "CAUSES" | "AMPLIFIES" | "CORRELATES") {
        const { positions } = computeRiskGraphLayout(
          [
            { ref: "RSK-X", category: "cat-a" },
            { ref: "RSK-Y", category: "cat-b" },
          ],
          [{ source: "RSK-X", target: "RSK-Y", kind }]
        )
        return distance(positions["RSK-X"], positions["RSK-Y"])
      }
      const causesDistance = pairDistance("CAUSES")
      const amplifiesDistance = pairDistance("AMPLIFIES")
      const correlatesDistance = pairDistance("CORRELATES")
      expect(causesDistance).toBeLessThan(amplifiesDistance)
      expect(amplifiesDistance).toBeLessThan(correlatesDistance)
    })

    it("keeps an isolated risk (no links) well outside a separate, densely-linked cluster instead of drifting into it", () => {
      const risks = [
        { ref: "ISO", category: "isolated-cat" },
        { ref: "RSK-A", category: "cyber" },
        { ref: "RSK-B", category: "cyber" },
        { ref: "RSK-C", category: "cyber" },
        { ref: "RSK-D", category: "cyber" },
      ]
      const links = [
        { source: "RSK-A", target: "RSK-B", kind: "CAUSES" as const },
        { source: "RSK-B", target: "RSK-C", kind: "CAUSES" as const },
        { source: "RSK-C", target: "RSK-D", kind: "CAUSES" as const },
        { source: "RSK-D", target: "RSK-A", kind: "CAUSES" as const },
      ]
      const { positions } = computeRiskGraphLayout(risks, links)
      const cluster = ["RSK-A", "RSK-B", "RSK-C", "RSK-D"].map(
        (ref) => positions[ref]
      )
      const centroid = {
        x: cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length,
        y: cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length,
      }
      const maxInternalSpread = Math.max(
        ...cluster.flatMap((p, i) =>
          cluster.slice(i + 1).map((q) => distance(p, q))
        )
      )
      const isoToClusterCentroid = distance(positions.ISO, centroid)
      expect(isoToClusterCentroid).toBeGreaterThan(maxInternalSpread)
    })

    it("never produces NaN/Infinity positions even for a fully-connected (worst-case density) graph", () => {
      const n = 10
      const risks = Array.from({ length: n }, (_, i) => ({
        ref: `RSK-${i}`,
        category: `cat-${i % 3}`,
      }))
      const links = []
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          links.push({
            source: `RSK-${i}`,
            target: `RSK-${j}`,
            kind: "CORRELATES" as const,
          })
        }
      }
      const { positions } = computeRiskGraphLayout(risks, links)
      for (const pos of Object.values(positions)) {
        expect(Number.isFinite(pos.x)).toBe(true)
        expect(Number.isFinite(pos.y)).toBe(true)
      }
    })

    // This runs synchronously on the main thread inside a React useMemo --
    // TICK_COUNT/COLLIDE_ITERATIONS were specifically tuned down (see their
    // own comments) after an initial guess measured ~550ms at this exact
    // fixture size locally (no coverage instrumentation), which would be a
    // visible hitch on every render that changes filteredRisks/filteredLinks.
    // Guards against a future tuning change silently reintroducing that.
    //
    // The threshold is generous (1500ms, not ~150ms) because CI runs this
    // suite under `vitest run --coverage` (v8 instrumentation), which measured
    // ~577ms here versus ~115ms uninstrumented locally -- roughly a 5x
    // overhead. A regression back to the old TICK_COUNT=300 would scale the
    // same way to ~2750ms under coverage, still well clear of this bound.
    it("stays fast at a deliberately pessimistic stress size (300 risks, 900 links)", () => {
      const n = 300
      const categories = [
        "cyber",
        "financial",
        "regulatory",
        "operational",
        "hr",
      ]
      const risks = Array.from({ length: n }, (_, i) => ({
        ref: `RSK-${i}`,
        category: categories[i % categories.length],
      }))
      const links = []
      for (let i = 0; i < n; i++) {
        for (let k = 1; k <= 3; k++) {
          const j = (i + k * 37) % n
          if (j !== i) {
            links.push({
              source: `RSK-${i}`,
              target: `RSK-${j}`,
              kind: (k === 1
                ? "CAUSES"
                : k === 2
                  ? "AMPLIFIES"
                  : "CORRELATES") as "CAUSES" | "AMPLIFIES" | "CORRELATES",
            })
          }
        }
      }
      const start = performance.now()
      computeRiskGraphLayout(risks, links)
      expect(performance.now() - start).toBeLessThan(1500)
    })
  })
})
