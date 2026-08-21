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
    expect(screen.getByText("home.productDemo.description")).toBeInTheDocument()
  })

  // Regression test, same class of bug FeaturesSection.test.tsx already
  // guards: only HeroSection's main title should be an <h1>.
  it("uses an h2 for its own section header, no h1", () => {
    renderSection()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /home\.productDemo\.title/,
      })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  it("renders all four static widgets", () => {
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

  // Post-launch pass: DemoTabs' tab-switcher card was replaced with three
  // full-width numbered sections, always mounted simultaneously (no more
  // `inert` panels hidden behind a tab click) -- so all three widgets and
  // their own titles are in the DOM at once, with no role="tab"/
  // role="tablist" anywhere. Each widget's own title is a <p>, not a
  // second <h3> -- see the next test for the heading-outline assertion.
  it("renders all three interactive demo moments simultaneously, no tabs", () => {
    renderSection()
    expect(
      screen.getByText("home.productDemo.kriSlider.title")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.productDemo.riskMatrixClick.title")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.productDemo.roleRegister.title")
    ).toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
  })

  // Review finding on PR #1025: the original version of this test only
  // checked text presence, not heading role/level or DOM order -- it would
  // still pass if a future edit demoted DemoMoment's own heading to a div,
  // or reordered INTERACTIVE_DEMOS away from the intended matrix -> register
  // -> KRI sequence. Asserts both explicitly now. Level 3 (not 2): the
  // section's own home.productDemo.title is the h2 (see the "no h1" test
  // above); each moment is a subsection of it.
  it("renders each demo moment's numbered eyebrow and section heading, in order", () => {
    renderSection()
    expect(screen.getByText("01")).toBeInTheDocument()
    expect(screen.getByText("02")).toBeInTheDocument()
    expect(screen.getByText("03")).toBeInTheDocument()

    // The static 3-widget rail above (RiskMatrixWidget/RiskGraphWidget/
    // KriTrendWidget) has its own h3 titles too -- filter to just the
    // three DemoMoment section headings by their known key suffix rather
    // than asserting on getAllByRole("heading", { level: 3 }) directly,
    // which would also catch the rail's headings.
    const momentHeadings = screen
      .getAllByRole("heading", { level: 3 })
      .filter((h) => h.textContent?.includes(".sectionHeading"))
    expect(momentHeadings.map((h) => h.textContent)).toEqual([
      "home.productDemo.riskMatrixClick.sectionHeading",
      "home.productDemo.roleRegister.sectionHeading",
      "home.productDemo.kriSlider.sectionHeading",
    ])
  })

  // The whole point of this redesign: every widget still computes from real
  // mock data (not fabricated numbers), just presented as a stylized
  // visual instead of a literal page embed -- confirm real risk/KRI names
  // from the shared mock fixtures actually render.
  it("renders real mock data, not fabricated placeholder content", () => {
    renderSection()
    // Both KriTrendWidget and the new KriThresholdSliderWidget show
    // MOCK_KRIS[0]'s real name -- two independent widgets legitimately
    // agreeing on the same real KRI, not a duplicate render.
    expect(
      screen.getAllByText("Unpatched critical CVEs on internet-facing systems")
    ).toHaveLength(2)
  })
})
