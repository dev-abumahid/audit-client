import { render, screen } from "@testing-library/react"
import ProductDemoSection from "./ProductDemoSection"

// The test environment does not initialize i18n, so t() echoes the raw key
// unless a `defaultValue`/interpolation is passed, matching this repo's
// established convention (see FeaturesSection.test.tsx).
function renderSection() {
  return render(<ProductDemoSection />)
}

describe("ProductDemoSection", () => {
  it("renders the section header keys", () => {
    renderSection()
    expect(screen.getByText("home.productDemo.title")).toBeInTheDocument()
    expect(
      screen.getByText("home.productDemo.description")
    ).toBeInTheDocument()
  })

  // Regression test, same class of bug FeaturesSection.test.tsx already
  // guards: only HeroSection's main title should be an <h1>.
  it("uses an h2 for its own section header, no h1", () => {
    renderSection()
    expect(
      screen.getByRole("heading", { level: 2, name: /home\.productDemo\.title/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  it("renders all three widgets", () => {
    renderSection()
    expect(
      screen.getByText("home.productDemo.riskMatrix.title")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.productDemo.kriTrend.title")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.productDemo.riskGraph.title")
    ).toBeInTheDocument()
  })

  // The whole point of this redesign: every widget still computes from real
  // mock data (not fabricated numbers), just presented as a stylized
  // visual instead of a literal page embed -- confirm real risk/KRI names
  // from the shared mock fixtures actually render.
  it("renders real mock data, not fabricated placeholder content", () => {
    renderSection()
    // KriTrendWidget shows MOCK_KRIS[0]'s real name.
    expect(
      screen.getByText("Unpatched critical CVEs on internet-facing systems")
    ).toBeInTheDocument()
  })
})
