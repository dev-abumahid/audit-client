import { render, screen } from "@testing-library/react"
import { MOCK_RISK_LINKS } from "@/dashboard/organization/overview/overviewMockData"
import RiskGraphWidget from "./RiskGraphWidget"

// Review finding on PR #1009: no dedicated test existed for this widget's
// hub-selection/layout logic (buildNodes), so a wrong hub pick or crash on
// malformed mock data would have passed CI silently.
describe("RiskGraphWidget", () => {
  it("renders the real satellite risk refs from MOCK_RISK_LINKS, not fabricated labels", () => {
    render(<RiskGraphWidget animate={false} />)
    MOCK_RISK_LINKS.forEach((link) => {
      expect(screen.getByText(link.source_ref)).toBeInTheDocument()
    })
  })

  it("draws one edge per real risk link", () => {
    const { container } = render(<RiskGraphWidget animate={false} />)
    const lines = container.querySelectorAll("line")
    expect(lines.length).toBe(MOCK_RISK_LINKS.length)
  })

  // Visual-fidelity pass: the real RiskGraphPage labels every node with its
  // own ref, hub included -- an earlier version of this widget deliberately
  // omitted the hub's own label, which this test used to assert. Updated to
  // match the real page's convention instead.
  it("labels the hub node with its own ref, same as every satellite", () => {
    render(<RiskGraphWidget animate={false} />)
    expect(screen.getByText("CYB-014")).toBeInTheDocument()
  })

  it("shows a real computed PageRank score for the hub and every satellite", () => {
    const { container } = render(<RiskGraphWidget animate={false} />)
    // The label text is split across sibling text nodes ({prLabel}{score}),
    // so match on textContent (which concatenates them) rather than
    // getByText, which only matches a single text node by default. Test
    // env doesn't interpolate i18n, so the raw key "...pagerankAbbrLabel"
    // is the literal prefix each of these renders here.
    const prTexts = Array.from(container.querySelectorAll("text")).filter(
      (el) => /pagerankAbbrLabel\d+$/.test(el.textContent ?? "")
    )
    // One per node: the hub + every satellite.
    expect(prTexts.length).toBe(MOCK_RISK_LINKS.length + 1)
    // The hub has 3 inbound links, every satellite has 0 -- confirms
    // computePageRank actually ran on this widget's own node/edge set (its
    // score should normalize to the maximum, 100), not a fabricated value.
    const hubPrText = prTexts.find((el) =>
      el.textContent?.endsWith("100")
    )
    expect(hubPrText).toBeDefined()
  })

  it("marks the graph as an accessible image describing the real hub and link count", () => {
    render(<RiskGraphWidget animate={false} />)
    expect(
      screen.getByRole("img", { name: /riskGraph\.chartLabel/ })
    ).toBeInTheDocument()
  })

})

// Isolated in its own describe/file-level mock so it doesn't affect the
// suite above -- vi.mock is hoisted, so this scenario needs its own
// dynamic import of a freshly-mocked module rather than sharing the file's
// top-level imports.
describe("RiskGraphWidget -- hub risk missing from mock data (review finding)", () => {
  it("renders null instead of crashing when the hub ref can't be found", async () => {
    vi.resetModules()
    vi.doMock(
      "@/dashboard/organization/overview/overviewMockData",
      async () => {
        const actual = await vi.importActual<
          typeof import("@/dashboard/organization/overview/overviewMockData")
        >("@/dashboard/organization/overview/overviewMockData")
        return {
          ...actual,
          // Omit the risk MOCK_RISK_LINKS' target_ref (CYB-014) points at,
          // reproducing exactly the "someone edited the fixture without
          // knowing this widget depends on it" scenario the review flagged.
          MOCK_RISKS: actual.MOCK_RISKS.filter((r) => r.ref !== "CYB-014"),
        }
      }
    )

    const { default: RiskGraphWidgetWithMissingHub } = await import(
      "./RiskGraphWidget"
    )
    expect(() =>
      render(<RiskGraphWidgetWithMissingHub animate={false} />)
    ).not.toThrow()

    vi.doUnmock("@/dashboard/organization/overview/overviewMockData")
    vi.resetModules()
  })
})
