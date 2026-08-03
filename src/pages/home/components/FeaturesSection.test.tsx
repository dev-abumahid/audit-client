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
})
