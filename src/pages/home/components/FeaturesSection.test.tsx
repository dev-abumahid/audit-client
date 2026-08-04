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

  // Round 12 audit (aexa-frontend#502): the hotlinked Unsplash image's alt
  // text was hardcoded English, bypassing t().
  it("routes the feature image's alt text through t(), not hardcoded English", () => {
    render(<FeaturesSection />)
    expect(
      screen.getByAltText("home.featureSection.imageAlt")
    ).toBeInTheDocument()
    expect(
      screen.queryByAltText(
        "Construction workers with safety equipment reviewing documents"
      )
    ).not.toBeInTheDocument()
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
})
