// Category-clustered layout for RiskGraphPage's SVG graph: risks are grouped
// by category, categories are arranged around a ring, and each category's
// own risks are arranged around a smaller cluster circle centered on the
// category's ring position.
//
// aexa-frontend#575: the previous version capped every category's cluster
// spread at a fixed 60px and the ring radius at a fixed 180px, regardless of
// how many risks/categories existed. That was never noticed because the
// page had only ever been exercised with 1-2 risks -- load-testing with 80+
// risks across 20 categories produced total node overlap (every node in a
// category stacked on the same ~60px circle, category clusters overlapping
// each other). This version sizes both radii from the actual counts so
// same-category nodes and different-category clusters stay non-overlapping
// regardless of scale, and grows the SVG's logical height to match (the
// page renders it with `w-full h-auto`, so a taller viewBox becomes real
// screen height, not just more cramped content at the same size).

export interface RiskGraphLayoutInput {
  ref: string
  category: string
}

export interface RiskGraphLayout {
  positions: Record<string, { x: number; y: number }>
  width: number
  height: number
}

// Rough on-screen footprint of one node (circle + its two label lines),
// in SVG user units -- used only to space nodes/clusters apart, not for
// actual node rendering (RiskGraphPage.tsx computes the real node radius
// from each risk's PageRank score, up to ~35px for the highest-ranked
// node -- i.e. up to ~70px across). Evenly spacing n nodes around a circle
// whose circumference is n*NODE_FOOTPRINT only approaches NODE_FOOTPRINT
// as their actual center-to-center distance in the limit of large n; for
// small n (worst case around n=3) the real spacing comes out to roughly
// 85% of NODE_FOOTPRINT. Set above the real ~70px worst-case node diameter
// so even that worst-case n keeps two max-radius nodes from visually
// touching.
const NODE_FOOTPRINT = 90
const MIN_CLUSTER_RADIUS = 35
const MIN_RING_RADIUS = 180
// The ring-radius formula below only guarantees adjacent cluster *centers*
// are 2*maxClusterRadius + CLUSTER_MARGIN apart, which bounds the disks'
// overlap -- but each cluster's actual nodes sit on its boundary circle at
// angles independent of the ring direction, so the worst case (a node on
// each cluster's boundary happening to face the other cluster) can come as
// close as CLUSTER_MARGIN itself, not the full node footprint. Set this to
// NODE_FOOTPRINT's own value so that worst case still keeps two max-radius
// nodes from touching, same reasoning as NODE_FOOTPRINT's comment above.
const CLUSTER_MARGIN = NODE_FOOTPRINT
const BASE_WIDTH = 900
const MIN_HEIGHT = 600
const OUTER_PADDING = 80

export function computeRiskGraphLayout(
  risks: RiskGraphLayoutInput[]
): RiskGraphLayout {
  const categories = Array.from(new Set(risks.map((r) => r.category)))
  if (categories.length === 0) {
    return { positions: {}, width: BASE_WIDTH, height: MIN_HEIGHT }
  }

  const risksByCategory = new Map(
    categories.map((cat) => [cat, risks.filter((r) => r.category === cat)])
  )

  // Each category's own cluster radius: large enough to fit its risks
  // around a circle without their (estimated) footprints overlapping.
  const clusterRadii = new Map(
    categories.map((cat) => {
      const n = risksByCategory.get(cat)!.length
      const radius =
        n <= 1
          ? 0
          : Math.max(MIN_CLUSTER_RADIUS, (n * NODE_FOOTPRINT) / (2 * Math.PI))
      return [cat, radius]
    })
  )
  const maxClusterRadius = Math.max(
    MIN_CLUSTER_RADIUS,
    ...clusterRadii.values()
  )

  // Ring radius: large enough that adjacent category clusters (each up to
  // 2*maxClusterRadius wide, plus a margin) don't overlap around the ring.
  const ringRadius = Math.max(
    MIN_RING_RADIUS,
    (categories.length * (maxClusterRadius * 2 + CLUSTER_MARGIN)) /
      (2 * Math.PI)
  )

  // Category clusters sit on a *circle* (ringRadius extends equally in x
  // and y), so width and height must grow together -- a version of this
  // that only grew height (while width stayed fixed at BASE_WIDTH) clipped
  // clusters near the ring's left/right extremes once ringRadius +
  // maxClusterRadius exceeded roughly half of BASE_WIDTH, even though the
  // same clusters near the top/bottom stayed on-canvas.
  const extent = 2 * (ringRadius + maxClusterRadius) + OUTER_PADDING
  const width = Math.max(BASE_WIDTH, extent)
  const height = Math.max(MIN_HEIGHT, extent)
  const cx = width / 2
  const cy = height / 2

  const categoryCenters = new Map(
    categories.map((cat, i) => {
      const angle = (2 * Math.PI * i) / categories.length - Math.PI / 2
      return [
        cat,
        {
          x: cx + ringRadius * Math.cos(angle),
          y: cy + ringRadius * Math.sin(angle),
        },
      ]
    })
  )

  const positions: Record<string, { x: number; y: number }> = {}
  categories.forEach((cat) => {
    const catRisks = risksByCategory.get(cat)!
    const center = categoryCenters.get(cat)!
    const radius = clusterRadii.get(cat)!
    catRisks.forEach((risk, i) => {
      if (catRisks.length === 1) {
        positions[risk.ref] = { x: center.x, y: center.y }
        return
      }
      const angle = (2 * Math.PI * i) / catRisks.length
      positions[risk.ref] = {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      }
    })
  })

  return { positions, width, height }
}
