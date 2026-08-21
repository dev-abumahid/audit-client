import { render, screen } from "@testing-library/react"
import CredibilityBand from "./CredibilityBand"

// The test environment does not initialize i18n, so t() echoes the raw key
// -- same convention as HeroFeatures.test.tsx. Asserting on the full key
// strings guards against a typo'd/missing "home." prefix rendering a raw
// key on the public homepage.
describe("CredibilityBand", () => {
  it("renders all three stat value and label keys", () => {
    render(<CredibilityBand />)
    for (let i = 0; i < 3; i++) {
      expect(
        screen.getByText(`home.credibilityBand.stats.${i}.value`)
      ).toBeInTheDocument()
      expect(
        screen.getByText(`home.credibilityBand.stats.${i}.label`)
      ).toBeInTheDocument()
    }
  })

  it("renders exactly three stats, not more or fewer", () => {
    render(<CredibilityBand />)
    expect(
      screen.queryByText("home.credibilityBand.stats.3.value")
    ).not.toBeInTheDocument()
  })
})
