import { describe, expect, it } from "vitest"
import {
  buildRiskCorrelationEdges,
  computePageRank,
  topPercentileByPageRank,
  topPercentileFromScores,
} from "./pageRank"

describe("computePageRank", () => {
  it("returns an empty map for an empty node list", () => {
    expect(computePageRank([], [])).toEqual({})
  })

  it("splits rank evenly across disconnected nodes", () => {
    const scores = computePageRank(["a", "b", "c"], [])
    expect(scores.a).toBeCloseTo(1 / 3, 5)
    expect(scores.b).toBeCloseTo(1 / 3, 5)
    expect(scores.c).toBeCloseTo(1 / 3, 5)
  })

  it("ranks a hub node (linked to by many others) above the nodes linking to it", () => {
    // a, b, c, d all point at "hub" -- hub should rank highest.
    const nodes = ["hub", "a", "b", "c", "d"]
    const edges = ["a", "b", "c", "d"].map((source) => ({
      source,
      target: "hub",
    }))
    const scores = computePageRank(nodes, edges)

    expect(scores.hub).toBeGreaterThan(scores.a)
    expect(scores.hub).toBeGreaterThan(scores.b)
    expect(scores.hub).toBeGreaterThan(scores.c)
    expect(scores.hub).toBeGreaterThan(scores.d)
  })

  it("ranks a node higher when it's linked to by an already-important node than by a peripheral one", () => {
    // important -> hubA, and important is itself linked to by 3 other nodes.
    // hubB is linked to by only one peripheral node. hubA should outrank hubB.
    const nodes = ["important", "p1", "p2", "p3", "hubA", "peripheral", "hubB"]
    const edges = [
      { source: "p1", target: "important" },
      { source: "p2", target: "important" },
      { source: "p3", target: "important" },
      { source: "important", target: "hubA" },
      { source: "peripheral", target: "hubB" },
    ]
    const scores = computePageRank(nodes, edges)

    expect(scores.hubA).toBeGreaterThan(scores.hubB)
  })

  it("ignores a self-referencing edge instead of inflating that node's own rank", () => {
    const scores = computePageRank(
      ["a", "b"],
      [{ source: "a", target: "a" }]
    )
    // With the self-loop discarded, a and b are both dangling nodes with no
    // real edges between them, so rank should split evenly, same as the
    // fully-disconnected case above.
    expect(scores.a).toBeCloseTo(0.5, 5)
    expect(scores.b).toBeCloseTo(0.5, 5)
  })

  it("ignores edges referencing a node outside the given node list", () => {
    const scores = computePageRank(
      ["a", "b"],
      [{ source: "ghost", target: "a" }]
    )
    expect(scores.a).toBeCloseTo(0.5, 5)
    expect(scores.b).toBeCloseTo(0.5, 5)
    expect(scores.ghost).toBeUndefined()
  })

  it("converges to scores that sum to (approximately) 1 across all nodes", () => {
    const nodes = ["a", "b", "c", "d"]
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "d" },
      { source: "d", target: "a" },
    ]
    const scores = computePageRank(nodes, edges)
    const total = Object.values(scores).reduce((sum, s) => sum + s, 0)
    expect(total).toBeCloseTo(1, 5)
  })
})

describe("buildRiskCorrelationEdges", () => {
  it("keeps CAUSES and AMPLIFIES as one-directional edges", () => {
    const edges = buildRiskCorrelationEdges([
      { source_ref: "A", target_ref: "B", link_type: "CAUSES" },
      { source_ref: "C", target_ref: "D", link_type: "AMPLIFIES" },
    ])
    expect(edges).toEqual([
      { source: "A", target: "B" },
      { source: "C", target: "D" },
    ])
  })

  it("adds both directions for a CORRELATES link", () => {
    const edges = buildRiskCorrelationEdges([
      { source_ref: "A", target_ref: "B", link_type: "CORRELATES" },
    ])
    expect(edges).toEqual([
      { source: "A", target: "B" },
      { source: "B", target: "A" },
    ])
  })
})

describe("topPercentileByPageRank", () => {
  it("returns an empty array for no nodes", () => {
    expect(topPercentileByPageRank([], [], 0.15)).toEqual([])
  })

  it("always returns at least one node, even when the percentile rounds down to zero", () => {
    const nodes = ["a", "b", "c"]
    const result = topPercentileByPageRank(nodes, [], 0.15)
    expect(result).toHaveLength(1)
  })

  it("returns the highest-ranked hub node first", () => {
    const nodes = ["hub", "a", "b", "c", "d", "e", "f", "g"]
    const edges = ["a", "b", "c", "d", "e", "f", "g"].map((source) => ({
      source,
      target: "hub",
    }))
    const result = topPercentileByPageRank(nodes, edges, 0.15)
    expect(result[0]).toBe("hub")
  })
})

// aexa-frontend#575 review: RiskGraphPage was calling computePageRank twice
// per render (once directly, once again inside topPercentileByPageRank on
// the same nodes/edges) -- topPercentileFromScores lets a caller that
// already has a computePageRank result reuse it instead.
describe("topPercentileFromScores", () => {
  it("returns an empty array for no nodes", () => {
    expect(topPercentileFromScores([], {}, 0.15)).toEqual([])
  })

  it("always returns at least one node, even when the percentile rounds down to zero", () => {
    const nodes = ["a", "b", "c"]
    const scores = { a: 0.3, b: 0.4, c: 0.3 }
    expect(topPercentileFromScores(nodes, scores, 0.15)).toHaveLength(1)
  })

  it("ranks nodes by the given scores, highest first, without recomputing PageRank", () => {
    const nodes = ["hub", "a", "b", "c", "d", "e", "f", "g"]
    const scores = {
      hub: 0.5,
      a: 0.1,
      b: 0.1,
      c: 0.1,
      d: 0.05,
      e: 0.05,
      f: 0.05,
      g: 0.05,
    }
    const result = topPercentileFromScores(nodes, scores, 0.25)
    expect(result[0]).toBe("hub")
    expect(result).toHaveLength(2)
  })

  it("matches topPercentileByPageRank's result when given that same computation's scores", () => {
    const nodes = ["hub", "a", "b", "c", "d", "e", "f", "g"]
    const edges = ["a", "b", "c", "d", "e", "f", "g"].map((source) => ({
      source,
      target: "hub",
    }))
    const scores = computePageRank(nodes, edges)
    expect(topPercentileFromScores(nodes, scores, 0.15)).toEqual(
      topPercentileByPageRank(nodes, edges, 0.15)
    )
  })
})
