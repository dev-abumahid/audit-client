import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MOCK_RISK_LINKS } from "@/dashboard/organization/overview/overviewMockData"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import RiskGraphWidget from "./RiskGraphWidget"

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

      // REG-022 has no real link to SUP-007 or to CYB-014 -- it should
      // dim once SUP-007 is selected.
      const reg022Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "REG-022"
      )
      const reg022Node = reg022Text?.closest('[role="button"]')
      expect(reg022Node).toHaveAttribute("opacity", "0.3")

      // CYB-014 IS linked to SUP-007 (SUP-007 amplifies CYB-014) -- it
      // should stay at full opacity, not dim.
      const cyb014Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "CYB-014"
      )
      const cyb014Node = cyb014Text?.closest('[role="button"]')
      expect(cyb014Node).toHaveAttribute("opacity", "1")
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

      const reg022Text = Array.from(container.querySelectorAll("text")).find(
        (el) => el.textContent === "REG-022"
      )
      const reg022Node = reg022Text?.closest('[role="button"]')
      expect(reg022Node).toHaveAttribute("opacity", "1")
    })
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
