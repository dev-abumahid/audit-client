// Extracted out of RiskGraphWidget.tsx (not co-located, matching this
// codebase's own convention -- computeRiskGraphLayout lives in
// riskGraphLayout.ts, not inline in RiskGraphPage.tsx) so this pure
// function can be exported for direct unit testing without tripping
// react-refresh's only-export-components rule on the widget's own file.

export interface OverlapNode {
  x: number
  y: number
  radius: number
}

// computeRiskGraphLayout's own overlap guarantee (MIN_NODE_SEPARATION, a
// raw-unit constant private to that module) is sized for ITS OWN node-
// radius assumptions -- not a caller's, which may use much smaller,
// independently-chosen radii after rescaling the layout down into a
// compact SVG viewBox. Verified live in RiskGraphWidget.tsx: with more
// real edges pulling linked pairs together (forceLink's own target
// distance can be tighter than the rescaled floor), two directly-linked
// nodes' circles visibly overlapped. This is the same bounded-pass
// push-apart approach riskGraphLayout.ts's own (unexported)
// resolveOverlaps uses, just run a second time here against the caller's
// actual per-node radii, which are the real ground truth for what counts
// as "touching."
export function resolveNodeOverlaps<T extends OverlapNode>(
  nodes: T[],
  margin: number,
  bounds: number
) {
  const maxPasses = 10
  for (let pass = 0; pass < maxPasses; pass++) {
    let violated = false
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy)
        const minSeparation = a.radius + b.radius + margin
        if (dist >= minSeparation) continue
        violated = true
        const angle = dist === 0 ? (i + j) * 2.4 : Math.atan2(dy, dx)
        const ux = dist === 0 ? Math.cos(angle) : dx / dist
        const uy = dist === 0 ? Math.sin(angle) : dy / dist
        const push = (minSeparation - dist) / 2 + 0.5
        a.x -= ux * push
        a.y -= uy * push
        b.x += ux * push
        b.y += uy * push
      }
    }
    if (!violated) break
  }
  // Review finding on PR #1044: the push-apart passes above can move a
  // node by more than the seed layout's own edge padding provided (a
  // single push can exceed 20 units for two max-radius circles), and
  // nothing previously re-clamped positions back into the viewBox
  // afterward -- a real, not just theoretical, risk for a node that
  // starts near an edge in a denser graph. Clamps each node's own circle
  // (center +/- radius) to stay fully inside [0, bounds] as a final pass,
  // after topology-driven separation has already settled.
  for (const n of nodes) {
    n.x = Math.min(Math.max(n.x, n.radius), bounds - n.radius)
    n.y = Math.min(Math.max(n.y, n.radius), bounds - n.radius)
  }
}
