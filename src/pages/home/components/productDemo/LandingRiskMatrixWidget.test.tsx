import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import { getMatrixColor, mapRiskToCell } from "@/utils/riskMatrixCalc"
import LandingRiskMatrixWidget from "./LandingRiskMatrixWidget"

const GRID_SIZE = 5

// Same real function the widget itself uses, not a hardcoded grid position
// -- if riskMatrixCalc.ts's mapping formula ever changes, this test's
// expectation moves with it instead of silently asserting a stale cell.
function displayIndexFor(riskRef: string): number {
  const risk = MOCK_RISKS.find((r) => r.ref === riskRef)
  if (!risk) throw new Error(`fixture risk ${riskRef} not found`)
  const { row, col } = mapRiskToCell(risk, GRID_SIZE)
  const displayRow = GRID_SIZE - 1 - row
  return displayRow * GRID_SIZE + col
}

describe("LandingRiskMatrixWidget", () => {
  // Quality-bar-loop round 1 (accessibility judge): this widget's own title
  // was a <p>, on the (false, for this rail) claim that a parent <h3>
  // already covered it -- RiskGraphWidget, right next to it in the same
  // rail, already uses a real <h3> for its own title. A screen-reader user
  // navigating by heading could reach one card but not the other.
  it("gives its own title a real heading role, matching RiskGraphWidget's pattern", () => {
    render(<LandingRiskMatrixWidget />)
    expect(
      screen.getByRole("heading", {
        name: "home.productDemo.riskMatrixClick.title",
      })
    ).toBeInTheDocument()
  })

  it("shows a hint before any cell is selected", () => {
    render(<LandingRiskMatrixWidget />)
    expect(
      screen.getByText("home.productDemo.riskMatrixClick.emptyHint")
    ).toBeInTheDocument()
  })

  it("shows the real risk(s) in a cell after clicking it", async () => {
    const user = userEvent.setup()
    render(<LandingRiskMatrixWidget />)
    const buttons = screen.getAllByRole("button")
    await user.click(buttons[displayIndexFor("CYB-014")])

    expect(screen.getByText("CYB-014")).toBeInTheDocument()
    expect(
      screen.getByText("Ransomware exposure via unpatched VPN gateway")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("home.productDemo.riskMatrixClick.emptyHint")
    ).not.toBeInTheDocument()
  })

  it("deselects and shows the hint again when clicking the same cell twice", async () => {
    const user = userEvent.setup()
    render(<LandingRiskMatrixWidget />)
    const buttons = screen.getAllByRole("button")
    const index = displayIndexFor("CYB-014")

    await user.click(buttons[index])
    expect(screen.getByText("CYB-014")).toBeInTheDocument()

    await user.click(buttons[index])
    expect(
      screen.getByText("home.productDemo.riskMatrixClick.emptyHint")
    ).toBeInTheDocument()
    expect(screen.queryByText("CYB-014")).not.toBeInTheDocument()
  })

  // Regression test (review finding on PR #1016): the widget's display grid
  // flips rows so row 0 renders at the top (highest likelihood), but
  // getMatrixColor's contract expects row 0 = lowest likelihood, the same
  // convention mapRiskToCell returns. Passing the flipped display row
  // straight through inverted the color ramp on the likelihood axis.
  it("colors a cell using getMatrixColor's real, un-flipped row -- not the flipped display row", () => {
    render(<LandingRiskMatrixWidget />)
    const buttons = screen.getAllByRole("button")
    const cyb014 = MOCK_RISKS.find((r) => r.ref === "CYB-014")!
    const { row, col } = mapRiskToCell(cyb014, GRID_SIZE)
    const expectedColorClass = getMatrixColor(row, col, GRID_SIZE)
    // Real fixture values (probability 82, inherent_score 88) score into
    // the critical tier -- assert the concrete class too, not just
    // "matches whatever getMatrixColor happens to return," so a future
    // change to getMatrixColor's own output can't silently mask this from
    // regressing again via a tautological comparison.
    expect(expectedColorClass).toContain("bg-risk-critical")
    expect(buttons[displayIndexFor("CYB-014")].className).toContain(
      expectedColorClass
    )
  })

  it("renders all real axis labels from the shared LABEL_KEYS config", () => {
    render(<LandingRiskMatrixWidget />)
    expect(
      screen.getByText("organization.riskMatrix.likelihoodVeryLikely")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.riskMatrix.impactCatastrophic")
    ).toBeInTheDocument()
  })

  // Quality-bar-loop round 1 (cross-view integration finding): this widget
  // replaced the deleted static RiskMatrixWidget in the rail, which had an
  // always-visible severity legend -- without it, a visitor who never
  // clicks a cell has no way to read the color ramp. Legend must render
  // regardless of selection state, not just after a click.
  it("always shows a Critical/High/Medium/Low legend, even before any cell is clicked", () => {
    render(<LandingRiskMatrixWidget />)
    expect(screen.getByText("riskLevel.critical")).toBeInTheDocument()
    expect(screen.getByText("riskLevel.high")).toBeInTheDocument()
    expect(screen.getByText("riskLevel.medium")).toBeInTheDocument()
    expect(screen.getByText("riskLevel.low")).toBeInTheDocument()
  })

  // Regression test (review finding on PR #1028): this widget also mounts
  // in ProductDemoSection's static rail now, which drives an `animate`
  // prop for a staggered cell entrance. The first version of that fix left
  // an inline transitionDelay style on every cell permanently once
  // `animate` became true, which -- because the cells' own className
  // covers hover feedback with `transition-all` -- delayed every later
  // hover, not just the one-time entrance. Cells must never carry an
  // inline transitionDelay in the widget's default (non-rail) usage, and
  // must drop it again once the rail's own entrance has finished.
  describe("animate prop / entrance-delay cleanup", () => {
    it("never applies an inline transitionDelay in the default (no animate prop) usage", () => {
      const { container } = render(<LandingRiskMatrixWidget />)
      const buttons = container.querySelectorAll("button")
      buttons.forEach((button) => {
        expect(button.style.transitionDelay).toBe("")
      })
    })

    it("drops the inline transitionDelay after the rail's staggered entrance finishes", () => {
      vi.useFakeTimers()
      const { container, rerender } = render(
        <LandingRiskMatrixWidget animate={false} />
      )
      // Still hidden: no cell has entered yet.
      let buttons = container.querySelectorAll("button")
      expect(buttons[buttons.length - 1].style.transitionDelay).not.toBe("")

      // Entrance begins (matches ProductDemoSection's rail passing
      // animate={revealVisible} once the section scrolls into view).
      rerender(<LandingRiskMatrixWidget animate={true} />)
      buttons = container.querySelectorAll("button")
      expect(buttons[buttons.length - 1].style.transitionDelay).not.toBe("")

      // Once every cell's own entrance transition has had time to finish,
      // the delay must be gone -- otherwise it silently lingers on every
      // subsequent hover. The setTimeout's setEntered() call happens
      // outside any user-driven event, so it must be flushed inside act()
      // for the DOM to reflect it before the assertion below.
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      buttons = container.querySelectorAll("button")
      buttons.forEach((button) => {
        expect(button.style.transitionDelay).toBe("")
      })
      vi.useRealTimers()
    })
  })

  // Review finding on PR #1043: every test above renders the widget with
  // no selectedRefs/onSelectionChange props, so they only ever exercise
  // the uncontrolled local-state fallback -- none of them actually cover
  // the controlled API ProductDemoSection uses to cross-highlight this
  // widget from RiskGraphWidget. These do.
  describe("controlled selectedRefs prop (cross-highlight from the graph)", () => {
    it("shows a cell as selected and expands its detail card when selectedRefs is supplied externally", () => {
      render(<LandingRiskMatrixWidget selectedRefs={new Set(["CYB-014"])} />)
      const buttons = screen.getAllByRole("button")
      expect(buttons[displayIndexFor("CYB-014")]).toHaveAttribute(
        "aria-pressed",
        "true"
      )
      expect(
        screen.getByText("Ransomware exposure via unpatched VPN gateway")
      ).toBeInTheDocument()
    })

    it("calls onSelectionChange with the clicked cell's refs, not just updating local state", async () => {
      const user = userEvent.setup()
      const onSelectionChange = vi.fn()
      render(
        <LandingRiskMatrixWidget
          selectedRefs={new Set()}
          onSelectionChange={onSelectionChange}
        />
      )
      const buttons = screen.getAllByRole("button")
      await user.click(buttons[displayIndexFor("CYB-014")])

      expect(onSelectionChange).toHaveBeenCalledTimes(1)
      const calledWith = onSelectionChange.mock.calls[0][0] as Set<string>
      expect(calledWith).toBeInstanceOf(Set)
      expect(Array.from(calledWith)).toEqual(["CYB-014"])
    })

    it("stays controlled by the parent's selectedRefs even after a click -- doesn't fall back to its own local state", async () => {
      const user = userEvent.setup()
      // onSelectionChange intentionally omitted: a real controlled
      // component whose parent ignores the change callback should NOT
      // start reflecting its own local state instead -- the displayed
      // selection must keep matching whatever selectedRefs the parent
      // actually re-renders it with.
      const { rerender } = render(
        <LandingRiskMatrixWidget selectedRefs={new Set()} />
      )
      const buttons = screen.getAllByRole("button")
      await user.click(buttons[displayIndexFor("CYB-014")])
      // No onSelectionChange, so the "parent" never re-renders with a new
      // selectedRefs -- the prop passed back down is still the original
      // empty Set, and the cell must still reflect that, not its own
      // internal click.
      rerender(<LandingRiskMatrixWidget selectedRefs={new Set()} />)
      expect(buttons[displayIndexFor("CYB-014")]).toHaveAttribute(
        "aria-pressed",
        "false"
      )
    })
  })
})
