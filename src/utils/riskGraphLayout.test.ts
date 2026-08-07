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
    const layout = computeRiskGraphLayout([{ ref: "RSK-001", category: "cyber" }])
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
      Array.from({ length: 4 }, (_, i) => ({ ref: `${cat}-${i}`, category: cat }))
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
      Array.from({ length: 4 }, (_, i) => ({ ref: `${cat}-${i}`, category: cat }))
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
      Array.from({ length: 4 }, (_, i) => ({ ref: `${cat}-${i}`, category: cat }))
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
})
