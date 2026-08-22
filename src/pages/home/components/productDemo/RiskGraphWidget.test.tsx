import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MOCK_RISK_LINKS } from "@/dashboard/organization/overview/overviewMockData"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import {
  resolveNodeOverlaps,
  type OverlapNode,
} from "@/utils/riskGraphNodeOverlap"
import RiskGraphWidget from "./RiskGraphWidget"

// Review finding on PR #1044: resolveNodeOverlaps' own bounded-pass
// convergence, coincident-point handling, and post-resolution bounds
// clamp were only ever verified by a one-time manual live-browser check,
// which doesn't run in CI. Builds a minimal 2-node fixture per test
// rather than depending on the real 12-node graph's exact layout, so
// these assert the function's own contract directly. The function itself
// lives in src/utils/riskGraphNodeOverlap.ts, not this widget's own file
// -- exporting a plain function alongside a component trips
// react-refresh's only-export-components rule.
function makeNode(overrides: Partial<OverlapNode>): OverlapNode {
  return {
    x: 0,
    y: 0,
    radius: 10,
    ...overrides,
  }
}

describe("resolveNodeOverlaps", () => {
  it("pushes two overlapping nodes apart to at least radius+radius+margin", () => {
    const nodes = [
      makeNode({ x: 100, y: 100, radius: 10 }),
      makeNode({ x: 105, y: 100, radius: 10 }),
    ]
    resolveNodeOverlaps(nodes, 4, 320, 320)
    const dist = Math.hypot(nodes[0].x - nodes[1].x, nodes[0].y - nodes[1].y)
    expect(dist).toBeGreaterThanOrEqual(24 - 0.01)
  })

  it("handles two exactly-coincident nodes without producing NaN", () => {
    const nodes = [
      makeNode({ x: 50, y: 50, radius: 10 }),
      makeNode({ x: 50, y: 50, radius: 10 }),
    ]
    resolveNodeOverlaps(nodes, 4, 320, 320)
    expect(Number.isFinite(nodes[0].x)).toBe(true)
    expect(Number.isFinite(nodes[0].y)).toBe(true)
    expect(Number.isFinite(nodes[1].x)).toBe(true)
    expect(Number.isFinite(nodes[1].y)).toBe(true)
    const dist = Math.hypot(nodes[0].x - nodes[1].x, nodes[0].y - nodes[1].y)
    expect(dist).toBeGreaterThanOrEqual(24 - 0.01)
  })

  it("leaves already-separated nodes untouched", () => {
    const nodes = [
      makeNode({ x: 20, y: 20, radius: 8 }),
      makeNode({ x: 200, y: 200, radius: 8 }),
    ]
    resolveNodeOverlaps(nodes, 4, 320, 320)
    expect(nodes[0].x).toBe(20)
    expect(nodes[0].y).toBe(20)
    expect(nodes[1].x).toBe(200)
    expect(nodes[1].y).toBe(200)
  })

  it("clamps a node pushed toward the edge back inside the viewBox bounds", () => {
    // Two overlapping nodes seeded right at the boundary -- the push-apart
    // pass alone would move one of them past 0 or past `bounds` if nothing
    // reclamped afterward.
    const nodes = [
      makeNode({ x: 2, y: 160, radius: 15 }),
      makeNode({ x: 6, y: 160, radius: 15 }),
    ]
    resolveNodeOverlaps(nodes, 4, 320, 320)
    for (const n of nodes) {
      expect(n.x - n.radius).toBeGreaterThanOrEqual(-0.01)
      expect(n.x + n.radius).toBeLessThanOrEqual(320.01)
      expect(n.y - n.radius).toBeGreaterThanOrEqual(-0.01)
      expect(n.y + n.radius).toBeLessThanOrEqual(320.01)
    }
  })

  // CEO feedback: RiskGraphWidget now sizes its viewBox to the card's real
  // measured (non-square) height via ResizeObserver, so boundsX/boundsY can
  // legitimately differ -- confirms each axis clamps to its OWN bound, not
  // the other axis's (a single square `bounds` would have silently clamped
  // the taller axis too tight, undoing the whole point of the resize).
  it("clamps x and y to their own independent bound on a non-square box", () => {
    const nodes = [
      makeNode({ x: 2, y: 2, radius: 15 }),
      makeNode({ x: 6, y: 6, radius: 15 }),
    ]
    resolveNodeOverlaps(nodes, 4, 200, 500)
    for (const n of nodes) {
      expect(n.x - n.radius).toBeGreaterThanOrEqual(-0.01)
      expect(n.x + n.radius).toBeLessThanOrEqual(200.01)
      expect(n.y - n.radius).toBeGreaterThanOrEqual(-0.01)
      expect(n.y + n.radius).toBeLessThanOrEqual(500.01)
    }
  })
})

// User request: this widget now reads the same real risk set
// LandingRiskMatrixWidget does (riskMatrixMockData's MOCK_RISKS, 12 risks),
// not a separate 4-node fixture -- most of these tests were rewritten
// alongside that change, not just patched to keep passing.
describe("RiskGraphWidget", () => {
  it("renders every real risk ref from riskMatrixMockData, not fabricated labels", () => {
    render(<RiskGraphWidget animate={false} />)
    MOCK_RISKS.forEach((risk) => {
      expect(screen.getByText(risk.ref)).toBeInTheDocument()
    })
  })

  it("draws one edge per real risk link", () => {
    const { container } = render(<RiskGraphWidget animate={false} />)
    const lines = container.querySelectorAll("line")
    expect(lines.length).toBe(MOCK_RISK_LINKS.length)
  })

  // Live-verified finding (post-#1046): scaling node positions against
  // computeRiskGraphLayout's own declared CANVAS size (reserved for a
  // worst-case category-ring spread) instead of the real bounding box of
  // where this sparse 12-node tree's nodes actually landed left most of
  // the card's real box empty -- the fix was correct-box-size but
  // wrong-content-scale. Confirms the rendered spread of node x/y
  // coordinates actually approaches the box's real usable width/height
  // (box minus padding on both sides), not just a fraction of it -- the
  // box is 320x320 (DEFAULT_BOX, since the ResizeObserver stub never
  // fires in tests) and PADDING is 28 per side, so full use of the box
  // means a spread approaching 320-28*2=264 on each axis.
  it("spreads real node positions to use most of the box, not a corner of it", () => {
    const { container } = render(<RiskGraphWidget animate={false} />)
    const circles = Array.from(
      container.querySelectorAll("svg > g > circle")
    ).filter((c) => c.getAttribute("fill") !== "none")
    const xs = circles.map((c) => Number(c.getAttribute("cx")))
    const ys = circles.map((c) => Number(c.getAttribute("cy")))
    const spreadX = Math.max(...xs) - Math.min(...xs)
    const spreadY = Math.max(...ys) - Math.min(...ys)
    // At least 90% of the theoretical max spread (264) -- generous enough
    // to tolerate resolveNodeOverlaps' own small push-apart adjustments,
    // but would have failed outright against the pre-fix behavior (which
    // left the real cluster spanning well under half the box).
    expect(spreadX).toBeGreaterThan(264 * 0.9)
    expect(spreadY).toBeGreaterThan(264 * 0.9)
  })

  // The real RiskGraphPage labels every node with its own ref, highest-
  // ranked node included -- CYB-014 is still the real highest-PageRank
  // node (3 real inbound links, more than any other risk in the fixture),
  // computed dynamically rather than hardcoded as a fixed hub ref.
  it("labels the highest-ranked node with its own ref, same as every other node", () => {
    render(<RiskGraphWidget animate={false} />)
    expect(screen.getByText("CYB-014")).toBeInTheDocument()
  })

  it("shows a real computed PageRank score for every one of the 12 real risks", () => {
    const { container } = render(<RiskGraphWidget animate={false} />)
    // The label text is split across sibling text nodes ({prLabel}{score}),
    // so match on textContent (which concatenates them) rather than
    // getByText, which only matches a single text node by default. Test
    // env doesn't interpolate i18n, so the raw key "...pagerankAbbrLabel"
    // is the literal prefix each of these renders here.
    const prTexts = Array.from(container.querySelectorAll("text")).filter(
      (el) => /pagerankAbbrLabel\d+$/.test(el.textContent ?? "")
    )
    // One per real risk in the fixture, linked or not -- the 8 risks with
    // zero real links still get a real (low, but not fabricated) score
    // from computePageRank's own dangling-node handling.
    expect(prTexts.length).toBe(MOCK_RISKS.length)
    // CYB-014 has 3 real inbound links, more than any other risk in this
    // fixture -- confirms computePageRank actually ran on the full 12-risk
    // node/edge set (its score should normalize to the maximum, 100), not
    // a fabricated value.
    const topPrText = prTexts.find((el) => el.textContent?.endsWith("100"))
    expect(topPrText).toBeDefined()
  })

  it("marks the graph as an accessible image describing the real top-ranked risk and its link count", () => {
    render(<RiskGraphWidget animate={false} />)
    expect(
      screen.getByRole("img", { name: /riskGraph\.chartLabel/ })
    ).toBeInTheDocument()
  })

  // New behavior: clicking a node selects it (uncontrolled local state,
  // since this test renders the widget standalone with no selectedRefs/
  // onSelectionChange props) and dims every node it isn't directly linked
  // to. ProductDemoSection.test.tsx separately covers the CONTROLLED
  // cross-widget case (a shared selection driven by the matrix widget
  // too) -- this test is scoped to the widget's own local fallback.
  describe("click-to-highlight", () => {
    it("selects a node on click and dims its unrelated neighbors", async () => {
      const user = userEvent.setup()
      const { container } = render(<RiskGraphWidget animate={false} />)

      const sup007Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "SUP-007"
      )
      const sup007Node = sup007Text?.closest('[role="button"]')
      expect(sup007Node).not.toBeNull()
      await user.click(sup007Node!)

      expect(sup007Node).toHaveAttribute("aria-pressed", "true")
      expect(sup007Node).toHaveAttribute("opacity", "1")

      // OPS-004 sits in a totally separate branch of the graph (its only
      // real link is to OPS-009, nowhere near SUP-007/CYB-014) -- it
      // should dim once SUP-007 is selected.
      const ops004Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "OPS-004"
      )
      const ops004Node = ops004Text?.closest('[role="button"]')
      expect(ops004Node).toHaveAttribute("opacity", "0.3")

      // CYB-014 IS linked to SUP-007 (SUP-007 amplifies CYB-014) -- it
      // should stay at full opacity, not dim.
      const cyb014Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "CYB-014"
      )
      const cyb014Node = cyb014Text?.closest('[role="button"]')
      expect(cyb014Node).toHaveAttribute("opacity", "1")
    })

    // CEO feedback: dimming everyone else wasn't itself a visible "these
    // are correlated" signal -- the clicked node gets a primary ring
    // (unchanged), and its real correlated neighbor now gets its own
    // destructive-colored dashed ring too, same two-ring distinction
    // RiskGraphPage's own isSelected/isCascaded split renders, so clicking
    // a node on THIS graph reads the same as clicking a matrix cell.
    it("gives a directly-selected node a primary ring and its correlated neighbor a destructive ring", async () => {
      const user = userEvent.setup()
      const { container } = render(<RiskGraphWidget animate={false} />)

      const sup007Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "SUP-007"
      )
      const sup007Node = sup007Text?.closest('[role="button"]')
      await user.click(sup007Node!)

      const ringStroke = (node: Element | null | undefined) =>
        node
          ?.querySelector("circle animate")
          ?.closest("circle")
          ?.getAttribute("stroke")

      expect(ringStroke(sup007Node)).toBe("hsl(var(--primary))")

      const cyb014Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "CYB-014"
      )
      const cyb014Node = cyb014Text?.closest('[role="button"]')
      expect(ringStroke(cyb014Node)).toBe("hsl(var(--destructive))")

      // OPS-004 isn't correlated to SUP-007 at all -- no ring of either
      // color.
      const ops004Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "OPS-004"
      )
      const ops004Node = ops004Text?.closest('[role="button"]')
      expect(ringStroke(ops004Node)).toBeUndefined()
    })

    // CEO feedback (live-verified, screenshot): nodes near the content's
    // edge had their selection ring (rendered at radius+5, wider than the
    // node's own base circle) visibly cut off by the card's border --
    // resolveNodeOverlaps' own bounds-clamp only reserved room for each
    // node's plain radius, not the wider ring around it. Clicks the hub
    // (CYB-014, whose 4 real links mean several rings render at once) and
    // confirms every ring circle -- not just the base node circles --
    // stays fully inside the box. NOTE: this specific bug only manifested
    // at box sizes bigger than DEFAULT_BOX (320x320, what tests always run
    // at since the ResizeObserver stub never fires) -- MAX_RADIUS(20) +
    // RING_MARGIN(5) already fit inside PADDING(28) at exactly 320, so this
    // test doesn't fail against the pre-fix code at that box size (verified
    // directly). Still a real regression guard for the general invariant
    // (rings must stay in bounds) at any box size a future change might
    // introduce, even though it can't reproduce the original bug's own
    // trigger condition (a box larger than 320) without also mocking a
    // resize, which the ResizeObserver stub doesn't support.
    it("keeps every selection/cascade ring fully inside the box, not just the base node circles", async () => {
      const user = userEvent.setup()
      const { container } = render(<RiskGraphWidget animate={false} />)

      const hubText = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "CYB-014"
      )
      const hubNode = hubText?.closest('[role="button"]')
      await user.click(hubNode!)

      const ringCircles = Array.from(
        container.querySelectorAll("circle")
      ).filter((c) => c.querySelector("animate"))
      // The hub itself plus every risk it links to should each contribute
      // one ring -- confirms this test actually exercises multiple rings,
      // not accidentally just one.
      expect(ringCircles.length).toBeGreaterThan(1)

      for (const ring of ringCircles) {
        const cx = Number(ring.getAttribute("cx"))
        const cy = Number(ring.getAttribute("cy"))
        const r = Number(ring.getAttribute("r"))
        expect(cx - r).toBeGreaterThanOrEqual(-0.5)
        expect(cx + r).toBeLessThanOrEqual(320.5)
        expect(cy - r).toBeGreaterThanOrEqual(-0.5)
        expect(cy + r).toBeLessThanOrEqual(320.5)
      }
    })

    it("deselects and clears dimming when the same node is clicked again", async () => {
      const user = userEvent.setup()
      const { container } = render(<RiskGraphWidget animate={false} />)
      const sup007Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "SUP-007"
      )
      const sup007Node = sup007Text?.closest('[role="button"]')
      expect(sup007Node).not.toBeNull()

      await user.click(sup007Node!)
      expect(sup007Node).toHaveAttribute("aria-pressed", "true")

      await user.click(sup007Node!)
      expect(sup007Node).toHaveAttribute("aria-pressed", "false")

      const ops004Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "OPS-004"
      )
      const ops004Node = ops004Text?.closest('[role="button"]')
      expect(ops004Node).toHaveAttribute("opacity", "1")
    })
  })

  // CEO feedback: a previous attempt at motion on this graph left a
  // pulsing "appears and expands and disappears" ring on the hub node
  // (Tailwind's animate-ping) that nothing else on this card does --
  // removed outright, not tuned. Regression guard: no element in this
  // graph opts into that Tailwind utility class anymore.
  it("does not render the removed pulsing hub-ring animation", () => {
    const { container } = render(<RiskGraphWidget animate={false} />)
    expect(container.querySelector(".animate-ping")).not.toBeInTheDocument()
  })

  // CEO feedback: the real dashboard graph (RiskGraphPage.tsx) draws real
  // arrowhead markers on its directed CAUSES/AMPLIFIES edges -- this
  // widget's lines used to be plain, arrowless strokes regardless of
  // link_type. Confirms a real CAUSES link in the fixture (CYB-009 causes
  // CYB-014, per riskMatrixMockData) now carries one of the two
  // marker-end ids this widget defines.
  it("marks a real CAUSES edge with an arrowhead marker", () => {
    const causesLink = MOCK_RISK_LINKS.find((l) => l.link_type === "CAUSES")
    expect(causesLink).toBeDefined()
    const { container } = render(<RiskGraphWidget animate={false} />)
    const line = container.querySelector(
      `line[marker-end="url(#riskGraphWidgetArrowCauses)"]`
    )
    expect(line).not.toBeNull()
  })
})

// Isolated in its own describe/file-level mock so it doesn't affect the
// suite above -- vi.mock is hoisted, so this scenario needs its own
// dynamic import of a freshly-mocked module rather than sharing the file's
// top-level imports.
describe("RiskGraphWidget -- no risks in the mock data (review finding)", () => {
  it("renders null instead of crashing when the risk set is empty", async () => {
    vi.resetModules()
    vi.doMock("@/dashboard/organization/risk/riskMatrixMockData", async () => {
      const actual = await vi.importActual<
        typeof import("@/dashboard/organization/risk/riskMatrixMockData")
      >("@/dashboard/organization/risk/riskMatrixMockData")
      return {
        ...actual,
        // Reproduces "someone edited the fixture down to nothing without
        // knowing this widget depends on it" -- buildGraph()'s only real
        // early-out is an empty risk array, since computeRiskGraphLayout
        // and computePageRank both already handle a missing/dangling
        // individual ref gracefully (no single "hub must exist" dependency
        // left after this widget stopped hardcoding one real ref).
        MOCK_RISKS: [],
      }
    })

    const { default: RiskGraphWidgetWithNoRisks } =
      await import("./RiskGraphWidget")
    expect(() =>
      render(<RiskGraphWidgetWithNoRisks animate={false} />)
    ).not.toThrow()

    vi.doUnmock("@/dashboard/organization/risk/riskMatrixMockData")
    vi.resetModules()
  })
})
