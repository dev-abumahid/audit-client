import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import { mapRiskToCell } from "@/utils/riskMatrixCalc"
import ProductDemoSection from "./ProductDemoSection"

// The test environment does not initialize i18n, so t() echoes the raw key
// unless a `defaultValue`/interpolation is passed, matching this repo's
// established convention (see FeaturesSection.test.tsx). Raw JSX children
// that aren't run through t() (a risk's own ref/name) render literally
// either way -- those are what the cross-highlight test below queries by.
function renderSection() {
  return render(<ProductDemoSection />)
}

const MATRIX_GRID_SIZE = 5

// Same real function LandingRiskMatrixWidget.test.tsx itself uses to find
// a given risk's cell button index, reused here so this integration test
// doesn't hardcode a grid position that would silently go stale if
// riskMatrixCalc.ts's mapping formula ever changes.
function matrixButtonIndexFor(riskRef: string): number {
  const risk = MOCK_RISKS.find((r) => r.ref === riskRef)
  if (!risk) throw new Error(`fixture risk ${riskRef} not found`)
  const { row, col } = mapRiskToCell(risk, MATRIX_GRID_SIZE)
  const displayRow = MATRIX_GRID_SIZE - 1 - row
  return displayRow * MATRIX_GRID_SIZE + col
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

  // Live audit finding: the rail's separate, non-interactive risk-matrix
  // widget was a real duplicate of the "click into the matrix" moment
  // below it -- consolidated into one, so this rail slot now mounts the
  // same LandingRiskMatrixWidget the (now-removed) standalone moment used,
  // not a second, different matrix implementation.
  // User request: the rail dropped from 3 widgets to 2 -- KriTrendWidget
  // (a static KRI trend card) was redundant with the interactive KRI
  // threshold-slider demo moment below it, so it was deleted rather than
  // kept as a second, weaker view of the same real KRI.
  it("renders the static rail widgets, including the now-shared clickable matrix", () => {
    renderSection()
    expect(
      screen.getByText("home.productDemo.riskMatrixClick.title")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.productDemo.riskGraph.title")
    ).toBeInTheDocument()
  })

  // Post-launch pass: DemoTabs' tab-switcher card was replaced with
  // full-width numbered sections, always mounted simultaneously (no more
  // `inert` panels hidden behind a tab click) -- so both remaining demo
  // widgets and their own titles are in the DOM at once, with no
  // role="tab"/role="tablist" anywhere. Each widget's own title is a <p>,
  // not a second <h3> -- see the next test for the heading-outline
  // assertion. Only two moments remain (register, KRI) -- the matrix
  // moment was removed, see the previous test's comment.
  it("renders both remaining interactive demo moments simultaneously, no tabs", () => {
    renderSection()
    // kriSlider.title was the widget's own "Drag the reading" label,
    // removed when KriThresholdSliderWidget was reworked to the two-column
    // reading/status-card layout -- kriSlider.eyebrow ("KRI · {{category}}")
    // is the widget's own unique text now, same proof-of-mount intent.
    expect(
      screen.getByText("home.productDemo.kriSlider.eyebrow")
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
  // or reordered INTERACTIVE_DEMOS. Asserts both explicitly now. Level 3
  // (not 2): the section's own home.productDemo.title is the h2 (see the
  // "no h1" test above); each moment is a subsection of it.
  it("renders each demo moment's numbered eyebrow and section heading, in order", () => {
    renderSection()
    expect(screen.getByText("01")).toBeInTheDocument()
    expect(screen.getByText("02")).toBeInTheDocument()
    expect(screen.queryByText("03")).not.toBeInTheDocument()

    // The static 2-widget rail above (LandingRiskMatrixWidget/
    // RiskGraphWidget) has its own h3 titles too -- filter to just the
    // DemoMoment section headings by their known key suffix rather than
    // asserting on getAllByRole("heading", { level: 3 }) directly, which
    // would also catch the rail's headings.
    const momentHeadings = screen
      .getAllByRole("heading", { level: 3 })
      .filter((h) => h.textContent?.includes(".sectionHeading"))
    expect(momentHeadings.map((h) => h.textContent)).toEqual([
      "home.productDemo.roleRegister.sectionHeading",
      "home.productDemo.kriSlider.sectionHeading",
    ])
  })

  // The whole point of this redesign: every widget still computes from real
  // mock data (not fabricated numbers), just presented as a stylized
  // visual instead of a literal page embed -- confirm a real KRI name
  // from the shared mock fixtures actually renders.
  it("renders real mock data, not fabricated placeholder content", () => {
    renderSection()
    expect(
      screen.getByText("Unpatched critical CVEs on internet-facing systems")
    ).toBeInTheDocument()
  })

  // User request: the matrix and correlation graph now read the same real
  // risk set (riskMatrixMockData's MOCK_RISKS) and share one selection, so
  // a click on either cross-highlights the same risk in the other. Clicks
  // the graph's CYB-014 node and confirms the matrix's own CYB-014 cell
  // (found via the real mapRiskToCell formula, not a hardcoded position)
  // picks up aria-pressed -- the actual behavior this feature exists for,
  // not just "both widgets render some real text."
  it("cross-highlights the same risk when clicked in the correlation graph", async () => {
    const user = userEvent.setup()
    renderSection()

    // RoleScopedRegisterWidget's own register table also renders "CYB-014"
    // as plain text (it's the same real risk, shown a third place on this
    // page) -- RiskGraphWidget's <svg role="img"> is the only role="img"
    // element in this section, so scoping the ref-text lookup to inside
    // it finds the graph's own CYB-014 node specifically.
    const graphSvg = screen.getByRole("img")
    const refText = Array.from(graphSvg.querySelectorAll("text")).find(
      (el) => el.textContent === "CYB-014"
    )
    const graphNode = refText?.closest('[role="button"]')
    expect(graphNode).not.toBeNull()
    await user.click(graphNode!)

    // Test env doesn't interpolate i18n (see the file-header comment), so
    // every cell's aria-label renders as the identical literal raw key --
    // that's still enough to reliably pick out just the 25 matrix cell
    // buttons from every other button on the page.
    const matrixCells = screen
      .getAllByRole("button")
      .filter(
        (el) =>
          el.getAttribute("aria-label") ===
          "home.productDemo.riskMatrixClick.cellLabel"
      )
    const matrixCell = matrixCells[matrixButtonIndexFor("CYB-014")]
    expect(matrixCell).toHaveAttribute("aria-pressed", "true")
  })

  // User request: "make sure the kri drag thingy is also linked" -- the
  // KRI threshold-slider demo moment (further down the page, outside the
  // rail) shares the exact same selectedRiskRefs state as the matrix and
  // graph now, not just those two. Continues the click from the previous
  // test (graph -> matrix) one step further: the KRI widget's own ref
  // badge (the only <button> anywhere in this section whose text content
  // is literally "CYB-014" -- the matrix's cells don't render the ref as
  // their own text, only in the detail card's <span> once selected) must
  // also pick up aria-pressed after that same click.
  it("also cross-highlights the KRI threshold-slider widget when the same risk is selected elsewhere", async () => {
    const user = userEvent.setup()
    renderSection()

    const graphSvg = screen.getByRole("img")
    const refText = Array.from(graphSvg.querySelectorAll("text")).find(
      (el) => el.textContent === "CYB-014"
    )
    const graphNode = refText?.closest('[role="button"]')
    expect(graphNode).not.toBeNull()
    await user.click(graphNode!)

    const kriRefBadge = screen
      .getAllByRole("button")
      .find((el) => el.textContent === "CYB-014")
    expect(kriRefBadge).not.toBeUndefined()
    expect(kriRefBadge).toHaveAttribute("aria-pressed", "true")
  })
})
