import { render, screen } from "@testing-library/react"
import HeroProductVisual from "./HeroProductVisual"

// The test environment does not initialize i18n, so t() echoes the raw key.
describe("HeroProductVisual", () => {
  it("renders the risk matrix, compliance, executive overview, and audit template panel labels", () => {
    render(<HeroProductVisual />)
    expect(screen.getByText("home.hero.visual.riskMatrix")).toBeInTheDocument()
    expect(screen.getByText("home.hero.visual.compliance")).toBeInTheDocument()
    expect(
      screen.getByText("home.hero.visual.executiveOverview")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.hero.visual.generateTemplate")
    ).toBeInTheDocument()
  })

  // Regression test: each compliance obligation's status was only carried
  // by dot/chip color (COMPLIANT green, NON-COMPLIANT red, DUE SOON amber).
  // Every item must also render its translated status text alongside the
  // color, so the state isn't conveyed by color alone.
  it("renders translated status text for every compliance obligation, not color alone", () => {
    render(<HeroProductVisual />)
    expect(
      screen.getByText("home.hero.visual.obligations.dataRetention.status")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.hero.visual.obligations.vendorAccess.status")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.hero.visual.obligations.incidentDrill.status")
    ).toBeInTheDocument()
  })

  // aexa-frontend#510: a hover-triggered shadow on this static, non-
  // interactive product screenshot implied clickability with no
  // onClick/keyboard handler behind it.
  it("does not style the panel as clickable", () => {
    const { container } = render(<HeroProductVisual />)
    expect(container.querySelector(".cursor-pointer")).not.toBeInTheDocument()
    expect(
      container.querySelector('[class*="hover:shadow"]')
    ).not.toBeInTheDocument()
  })
})
