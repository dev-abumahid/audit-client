import { render, screen } from "@testing-library/react"
import HeroFeatures from "./HeroFeatures"

// The test environment does not initialize i18n, so t() echoes the raw key.
// Asserting on the full key strings guards against typo'd/missing-prefix keys
// that would render as raw keys in production (regression: the first feature
// card once used "heroFeatures.features.0.description" without the "home."
// prefix and showed the raw key on the public homepage).
describe("HeroFeatures", () => {
  it("renders the section header keys", () => {
    render(<HeroFeatures />)
    expect(screen.getByText("home.heroFeatures.title1")).toBeInTheDocument()
    expect(screen.getByText("home.heroFeatures.title2")).toBeInTheDocument()
    expect(
      screen.getByText("home.heroFeatures.description")
    ).toBeInTheDocument()
  })

  it("renders all four feature cards with fully-prefixed title and description keys", () => {
    render(<HeroFeatures />)
    for (let i = 0; i < 4; i++) {
      expect(
        screen.getByText(`home.heroFeatures.features.${i}.title`)
      ).toBeInTheDocument()
      expect(
        screen.getByText(`home.heroFeatures.features.${i}.description`)
      ).toBeInTheDocument()
    }
  })

  it("does not render the un-prefixed description key from the old typo", () => {
    render(<HeroFeatures />)
    expect(
      screen.queryByText("heroFeatures.features.0.description")
    ).not.toBeInTheDocument()
  })
})
