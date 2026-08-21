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

  it("does not label the hub node with its own ref text (only satellites get ref labels)", () => {
    render(<RiskGraphWidget animate={false} />)
    // CYB-014 is the real hub in overviewMockData.ts -- it should never
    // appear as a small node-ref label the way satellite refs do.
    expect(screen.queryByText("CYB-014")).not.toBeInTheDocument()
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
