import { render, screen } from "@testing-library/react"
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
})
