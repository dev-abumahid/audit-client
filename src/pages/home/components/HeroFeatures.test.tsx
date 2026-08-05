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

  // Regression test: the section header used <h1>, so the landing page had
  // 5 <h1> elements skipping <h2> entirely. Only HeroSection's main title
  // should be an <h1>; every other section header is an <h2>.
  it("uses an h2 for the section header, not an h1", () => {
    render(<HeroFeatures />)
    expect(
      screen.getByRole("heading", { level: 2, name: /home\.heroFeatures/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  // aexa-frontend#510 round 13: the feature cards had cursor-pointer +
  // hover:shadow-md + group-hover styling implying interactivity with no
  // onClick or keyboard handler behind them. Since no per-feature action
  // exists, the styling was removed rather than faked.
  it("does not style the feature cards as clickable", () => {
    const { container } = render(<HeroFeatures />)
    expect(container.querySelector(".cursor-pointer")).not.toBeInTheDocument()
    expect(container.querySelector(".group")).not.toBeInTheDocument()
  })
})
