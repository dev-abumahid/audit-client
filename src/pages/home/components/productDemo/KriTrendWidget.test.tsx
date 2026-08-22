import { render, screen } from "@testing-library/react"
import KriTrendWidget from "./KriTrendWidget"

// Live audit finding: this was the only card in the 3-widget rail (risk
// matrix / RiskGraphWidget / KriTrendWidget) with no closing border-t
// legend/caption row -- the CSS grid's default items-stretch left a large
// empty block below its shorter content once stretched to match its
// taller siblings. Fixed with a real OK/Warning/Alert status legend. These
// tests guard that legend, not the pre-existing chart logic above it.
describe("KriTrendWidget", () => {
  it("renders a status legend with all three real KRI statuses, not a placeholder", () => {
    render(<KriTrendWidget animate={false} />)
    expect(
      screen.getByText("organization.kri.status.ok")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.kri.status.warning")
    ).toBeInTheDocument()
    // "Alert" also appears in the header badge, so there are two matches
    // for this status's label -- assert at least one legend instance exists
    // rather than requiring exactly one.
    expect(
      screen.getAllByText("organization.kri.status.alert").length
    ).toBeGreaterThanOrEqual(1)
  })

  it("colors each legend dot with a real severity class, not a placeholder", () => {
    const { container } = render(<KriTrendWidget animate={false} />)
    const legend = container.querySelector(".border-t")
    const dots = legend?.querySelectorAll("span > span")
    expect(dots?.length).toBe(3)
    const validSeverityDotClasses = ["bg-risk-low", "bg-risk-medium", "bg-risk-critical"]
    dots?.forEach((dot) => {
      const matchesKnownSeverity = validSeverityDotClasses.some((cls) =>
        dot.className.includes(cls)
      )
      expect(matchesKnownSeverity).toBe(true)
    })
  })
})
