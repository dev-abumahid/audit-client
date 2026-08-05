import { render, screen } from "@testing-library/react"
import FeaturesSection from "./FeaturesSection"

// The test environment does not initialize i18n, so t() echoes the raw key.
describe("FeaturesSection", () => {
  it("renders the section header keys", () => {
    render(<FeaturesSection />)
    expect(
      screen.getByText("home.featureSection.title1")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.featureSection.title2")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.featureSection.description")
    ).toBeInTheDocument()
  })

  // Regression test: the section header used <h1>, so the landing page had
  // 5 <h1> elements skipping <h2> entirely. Only HeroSection's main title
  // should be an <h1>; every other section header is an <h2>.
  it("uses an h2 for the section header, not an h1", () => {
    render(<FeaturesSection />)
    expect(
      screen.getByRole("heading", { level: 2, name: /home\.featureSection/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  // aexa-frontend#510 round 13: the feature cards had cursor-pointer +
  // group-hover text/background styling implying interactivity with no
  // onClick or keyboard handler behind them. Since no per-feature action
  // exists, the styling was removed rather than faked.
  it("does not style the feature cards as clickable", () => {
    const { container } = render(<FeaturesSection />)
    expect(container.querySelector(".cursor-pointer")).not.toBeInTheDocument()
    expect(container.querySelector(".group")).not.toBeInTheDocument()
  })
})
