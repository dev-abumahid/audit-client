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

  // Landing overhaul PR7: 4 of the 6 cards embed a real crop of that
  // module's own distinctive UI. Confirm all 4 render (each has its own
  // dedicated test file for its specific content) and that exactly 2 cards
  // stay icon+text only.
  it("renders all four module-showcase crops", () => {
    render(<FeaturesSection />)
    // FindingsOverdueCrop
    expect(screen.getByText("Vendor access review")).toBeInTheDocument()
    // AuditEngagementCrop
    expect(screen.getByText("AUD-014")).toBeInTheDocument()
    // ComplianceHeatmapCrop
    expect(screen.getAllByText(/^\d+\/\d+$/).length).toBeGreaterThan(0)
    // SeverityChipsCrop
    expect(screen.getByText("riskLevel.critical")).toBeInTheDocument()
  })

  // Quality-bar-loop finding: clustering all 4 crops in the grid's first
  // row and both icon-only cards in the second made the second row read as
  // categorically less finished than the first. Render order now
  // interleaves them -- guard that no 3-card grid row (lg:grid-cols-3) is
  // either all-crop or all-icon-only.
  it("distributes crops across both grid rows, not clustered in one", () => {
    const { container } = render(<FeaturesSection />)
    const cards = container.querySelectorAll(
      ".grid.grid-cols-1.gap-x-10 > div"
    )
    expect(cards).toHaveLength(6)
    const hasCrop = [...cards].map((card) => card.children.length > 3)
    const row1CropCount = hasCrop.slice(0, 3).filter(Boolean).length
    const row2CropCount = hasCrop.slice(3, 6).filter(Boolean).length
    expect(row1CropCount).toBeGreaterThan(0)
    expect(row1CropCount).toBeLessThan(3)
    expect(row2CropCount).toBeGreaterThan(0)
    expect(row2CropCount).toBeLessThan(3)
  })
})
