// Standard PageRank (power-iteration method), used by the Overview
// dashboard's "Systemic Tipping Points" section to identify the risks most
// central to the org's risk-correlation graph (aexa-frontend#25).
//
// This is the same methodology the published "too central to fail" systemic
// risk literature uses (PageRank over a network of causal/exposure links,
// e.g. Markose et al.'s bank-network model): a node's score rises with the
// number and importance of nodes linking INTO it, not just its raw link
// count, so a risk connected to other highly-connected risks ranks higher
// than one with the same number of links to isolated risks.
//
// Edge direction: a RiskLink's source_ref/target_ref already encodes real
// causal direction for CAUSES/AMPLIFIES ("source causes/amplifies target"),
// kept as a directed edge here. CORRELATES has no inherent direction, so the
// caller is expected to have already added the reverse edge for those (see
// buildRiskCorrelationEdges below) -- this function itself is direction-
// agnostic and just walks whatever edges it's given.

export interface PageRankEdge {
  source: string
  target: string
}

export interface PageRankOptions {
  dampingFactor?: number
  maxIterations?: number
  tolerance?: number
}

const DEFAULT_DAMPING_FACTOR = 0.85
const DEFAULT_MAX_ITERATIONS = 100
const DEFAULT_TOLERANCE = 1e-6

/**
 * Computes a PageRank score for every node in `nodes`, using `edges` as the
 * directed link graph. Returns a map of node -> raw PageRank score (all
 * scores sum to 1 across `nodes`). Nodes with no outgoing edges ("dangling
 * nodes") redistribute their rank uniformly across all nodes each
 * iteration, the standard fix for avoiding a rank sink.
 */
export function computePageRank(
  nodes: string[],
  edges: PageRankEdge[],
  options: PageRankOptions = {}
): Record<string, number> {
  const n = nodes.length
  if (n === 0) return {}

  const {
    dampingFactor = DEFAULT_DAMPING_FACTOR,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    tolerance = DEFAULT_TOLERANCE,
  } = options

  const nodeSet = new Set(nodes)
  // Outgoing edges per node, deduped (a repeated edge shouldn't double-count).
  const outEdges = new Map<string, Set<string>>()
  for (const node of nodes) outEdges.set(node, new Set())
  for (const { source, target } of edges) {
    if (!nodeSet.has(source) || !nodeSet.has(target) || source === target) {
      continue
    }
    outEdges.get(source)!.add(target)
  }

  // Incoming edges per node, derived from outEdges, so each iteration only
  // has to look at a node's own inbound list rather than scanning all edges.
  const inEdges = new Map<string, string[]>()
  for (const node of nodes) inEdges.set(node, [])
  for (const [source, targets] of outEdges) {
    for (const target of targets) inEdges.get(target)!.push(source)
  }

  let ranks = new Map<string, number>(nodes.map((node) => [node, 1 / n]))

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let danglingRankSum = 0
    for (const node of nodes) {
      if (outEdges.get(node)!.size === 0) {
        danglingRankSum += ranks.get(node)!
      }
    }

    const nextRanks = new Map<string, number>()
    let delta = 0
    for (const node of nodes) {
      let incomingRank = 0
      for (const source of inEdges.get(node)!) {
        incomingRank += ranks.get(source)! / outEdges.get(source)!.size
      }
      const nextRank =
        (1 - dampingFactor) / n +
        dampingFactor * (incomingRank + danglingRankSum / n)
      nextRanks.set(node, nextRank)
      delta += Math.abs(nextRank - ranks.get(node)!)
    }

    ranks = nextRanks
    if (delta < tolerance) break
  }

  return Object.fromEntries(ranks)
}

/**
 * Builds the edge list for the org's risk-correlation graph from its
 * RiskLink rows. CAUSES/AMPLIFIES keep their real direction; CORRELATES has
 * no inherent direction, so both directions are added.
 */
export function buildRiskCorrelationEdges(
  riskLinks: Array<{ source_ref: string; target_ref: string; link_type: string }>
): PageRankEdge[] {
  const edges: PageRankEdge[] = []
  for (const link of riskLinks) {
    edges.push({ source: link.source_ref, target: link.target_ref })
    if (link.link_type === "CORRELATES") {
      edges.push({ source: link.target_ref, target: link.source_ref })
    }
  }
  return edges
}

/**
 * Returns the refs of the top `percentile` fraction (e.g. 0.15 for top 15%)
 * of `nodes` by PageRank score, highest first. Always returns at least one
 * node (if `nodes` is non-empty) so a small risk register still surfaces a
 * result instead of rounding down to zero.
 */
export function topPercentileByPageRank(
  nodes: string[],
  edges: PageRankEdge[],
  percentile: number
): string[] {
  if (nodes.length === 0) return []
  const scores = computePageRank(nodes, edges)
  const count = Math.max(1, Math.ceil(nodes.length * percentile))
  return [...nodes]
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, count)
}
