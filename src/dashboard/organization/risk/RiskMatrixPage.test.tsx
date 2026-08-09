import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import RiskMatrixPage from "./RiskMatrixPage"

// aexa-frontend#548: the selected-cell RiskCard's risk name and site name
// are now <Link>s, so this needs a Router context -- same convention as
// Overview.test.tsx's renderPage().
function renderPage() {
  return render(
    <MemoryRouter>
      <RiskMatrixPage />
    </MemoryRouter>
  )
}

// This file never triggers src/i18n/i18n.ts's side-effect init, so
// react-i18next's real t() falls back to returning the raw key with no
// interpolation for every other assertion here. That fallback can't
// reproduce pluralization bugs (organization.riskMatrix.cellCount_one/_other,
// des_one/_other, selectedCellHeading_one/_other), since i18next's
// plural-suffix resolution only kicks in once real resources/pluralization
// rules are loaded. Overriding these keys, with the same behavior the real
// en.json resource now has, lets the tests tell the fixed/pluralized text
// apart from the old hardcoded strings -- every other key still falls back
// to itself unchanged. Same technique as CompliancePage.test.tsx.
//
// Axis tick label keys (likelihoodRare, impactMajor, etc. -- audit round 3:
// these used to be a hardcoded English LABELS array instead of going through
// t()) are also given their real English text here, so assertions can check
// for the actual label wording rather than the raw i18n key.
const AXIS_LABEL_TEXT: Record<string, string> = {
  likelihoodRare: "Rare",
  likelihoodUnlikely: "Unlikely",
  likelihoodPossible: "Possible",
  likelihoodLikely: "Likely",
  likelihoodProbable: "Probable",
  likelihoodQuasiCertain: "Quasi-certain",
  likelihoodVeryUnlikely: "Very Unlikely",
  likelihoodModeratelyLikely: "Moderately Likely",
  likelihoodVeryLikely: "Very Likely",
  impactNegligible: "Negligible",
  impactMinor: "Minor",
  impactModerate: "Moderate",
  impactMajor: "Major",
  impactCatastrophic: "Catastrophic",
  impactAxis: "Impact →",
}

vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => {
        if (key === "organization.riskMatrix.cellCount") {
          const count = Number(opts?.count ?? 0)
          return count === 1 ? `${count} risk` : `${count} risks`
        }
        if (key === "organization.riskMatrix.des") {
          const count = Number(opts?.count ?? 0)
          return count === 1
            ? `${count} risk positioned — Click on a cell to see details`
            : `${count} risks positioned — Click on a cell to see details`
        }
        if (key === "organization.riskMatrix.selectedCellHeading") {
          const count = Number(opts?.count ?? 0)
          const score = opts?.score
          return count === 1
            ? `${count} risk — band ${score}`
            : `${count} risks — band ${score}`
        }
        if (key === "organization.riskMatrix.riskScoreLabel") {
          return `Score: ${opts?.score}`
        }
        if (key === "organization.riskMatrix.pagerankAbbrLabel") {
          return "PR:"
        }
        if (key === "organization.riskMatrix.cellAriaLabel") {
          const count = Number(opts?.count ?? 0)
          const suffix = count === 1 ? "risk" : "risks"
          return `${opts?.likelihood} × ${opts?.impact}: ${count} ${suffix}`
        }
        const shortKey = key.replace("organization.riskMatrix.", "")
        if (shortKey in AXIS_LABEL_TEXT) {
          return AXIS_LABEL_TEXT[shortKey]
        }
        return key
      },
    }),
  }
})

const mockUseGetAllRisksQuery = vi.fn()
const mockUseGetAllSitesQuery = vi.fn()

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) =>
    mockUseGetAllRisksQuery(...args),
}))

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) =>
    mockUseGetAllSitesQuery(...args),
}))

// SiteFilter itself renders a real Radix Select, which needs pointer-event
// APIs jsdom doesn't support to open its listbox. Rather than mock the
// shared @/components/ui/select module (which would double-render every
// site's name as a plain-DOM <option>, colliding with getByText queries
// several OTHER tests in this file already rely on for the exact same
// site name appearing once, in the selected RiskCard), stub SiteFilter
// itself with plain buttons -- only this file's own filter-triggering
// behavior is under test here, not SiteFilter's internal dropdown
// implementation (that's SiteFilter.test.tsx's job).
vi.mock("@/components/dashboard/organization/SiteFilter", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string | null
    onChange: (v: string | null) => void
  }) => (
    <div>
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        Site filter: all
      </button>
      <button
        type="button"
        aria-pressed={value === "site-1"}
        onClick={() => onChange("site-1")}
      >
        Site filter: site-1
      </button>
      <button
        type="button"
        aria-pressed={value === "site-2"}
        onClick={() => onChange("site-2")}
      >
        Site filter: site-2
      </button>
    </div>
  ),
}))

function makeRisk(overrides = {}) {
  return {
    id: "risk-1",
    ref: "CYB-001",
    org_account_id: "org-1",
    name: "Supply Chain Disruption",
    description: "Delays in raw material delivery",
    category: "supply_chain",
    inherent_score: 80,
    residual_score: 5,
    pagerank_score: 0.72,
    financial_impact_min: 50000,
    financial_impact_max: 200000,
    probability: 85,
    velocity: "Medium",
    trend: "Increasing",
    status: "open",
    ai_generated: false,
    is_edited: false,
    site_id: "site-1",
    control_design_eff: 0,
    control_operating_eff: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("RiskMatrixPage", () => {
  beforeEach(() => {
    mockUseGetAllRisksQuery.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site-1", name: "Casablanca HQ", country: null }] },
      isLoading: false,
    })
  })

  it("shows a loading state while risks are loading", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: undefined, isLoading: true })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  // quality-bar-loop round 7 (mobile, live-measured at 375px): the
  // matrix-size and group-mode toggle buttons were 28px tall, under the
  // 44px minimum touch-target guideline.
  it("gives the matrix-size and group-mode toggle buttons a 44px touch target", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk()] },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByRole("button", { name: "5×5" }).className).toContain(
      "h-11"
    )
    expect(
      screen.getByRole("button", { name: "organization.correlationMatrix.groupAll" }).className
    ).toContain("h-11")
  })

  // quality-bar-loop round 7 (mobile, the axis's most severe finding):
  // the likelihood row-label column used to scroll away together with
  // the grid cells inside the same horizontal-scroll wrapper, so a phone
  // user couldn't see a cell's row label and a rightmost-column cell at
  // the same time.
  it("pins the likelihood row-label column so it doesn't scroll away with the grid", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk()] },
      isLoading: false,
    })
    renderPage()

    const rowLabel = screen.getByText("Very Unlikely")
    expect(rowLabel.className).toContain("sticky")
    expect(rowLabel.className).toContain("left-0")
  })

  // quality-bar-loop round 7 (mobile, live-confirmed at 375px): the
  // legend used to sit inside the grid's horizontally-scrolling,
  // forced-min-width wrapper, so it had to be scrolled into view even
  // though it could otherwise wrap and fit within the real viewport.
  it("renders the legend outside the matrix's horizontal-scroll wrapper", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk()] },
      isLoading: false,
    })
    renderPage()

    const legendLabel = screen.getByText("riskLevel.critical")
    const scrollWrapper = document.querySelector(".overflow-auto")
    expect(scrollWrapper).not.toBeNull()
    expect(scrollWrapper?.contains(legendLabel)).toBe(false)
  })

  // quality-bar-loop round 3 (resilience, the loop's original lowest
  // score): isError was never checked on either query -- a genuine
  // fetch failure fell through to risks: [] and rendered a
  // fully-formed, normal-looking empty matrix (every cell present, all
  // reading 0), byte-for-byte indistinguishable from "this org
  // genuinely has zero risks."
  it("shows a distinct error state, not an empty matrix, when the risks query fails", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    renderPage()

    expect(
      screen.getByText("organization.riskMatrix.loadError")
    ).toBeInTheDocument()
    // The matrix (and every control that's meaningless without data)
    // must not render at all in the error state.
    expect(screen.queryByRole("button", { name: "5×5" })).not.toBeInTheDocument()
    expect(screen.queryByTitle(/risk/)).not.toBeInTheDocument()
  })

  it("shows a site-load-error indicator, not a silent missing site name, when the sites query fails", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 0, inherent_score: 0 })] },
      isLoading: false,
    })
    mockUseGetAllSitesQuery.mockReturnValue({
      data: undefined,
      isError: true,
    })
    renderPage()

    expect(
      screen.getByText("organization.riskMatrix.siteLoadError")
    ).toBeInTheDocument()
    // The matrix itself still renders -- a sites-fetch failure only
    // affects site-name lookups on individual RiskCards, not the whole
    // page.
    expect(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    ).toBeInTheDocument()
  })

  it("shows a dedicated empty state, not a matrix full of zeroes, when there are genuinely no risks", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    renderPage()

    expect(
      screen.getByText("organization.riskMatrix.emptyStateTitle")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.riskMatrix.emptyStateHint")
    ).toBeInTheDocument()
    // Additive, not a replacement: the grid itself keeps rendering (other
    // tests rely on it being present even with zero risks), the empty-state
    // notice just sits alongside it.
    expect(screen.getByRole("button", { name: "5×5" })).toBeInTheDocument()
  })

  // quality-bar-loop round 4 (resilience, round-1 finding 3): a missing or
  // malformed probability/inherent_score used to silently resolve to 0 via
  // `Number(x) || 0`, landing the risk in the lowest cell with no visual
  // indication it wasn't actually scored that low.
  it("flags a risk with a malformed probability as unscored, not a genuine negligible risk", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: undefined, inherent_score: 0 })] },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    expect(
      screen.getByText("organization.riskMatrix.unscoredRiskBadge")
    ).toBeInTheDocument()
  })

  // Review round 1 finding: Number("") and Number(null) both coerce to a
  // *finite* 0, so a naive `Number.isFinite(Number(x))` check would call
  // these "valid" -- exactly the malformed values this feature exists to
  // catch.
  it.each([
    { malformedValue: "", label: "an empty string" },
    { malformedValue: null, label: "null" },
  ] as const)(
    "flags a risk with $label inherent_score as unscored",
    async ({ malformedValue }) => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [makeRisk({ probability: 0, inherent_score: malformedValue })],
        },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
      )

      expect(
        screen.getByText("organization.riskMatrix.unscoredRiskBadge")
      ).toBeInTheDocument()
    }
  )

  it("does not flag a risk that has a genuinely low, but valid, probability and impact", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 0, inherent_score: 0 })] },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    expect(
      screen.queryByText("organization.riskMatrix.unscoredRiskBadge")
    ).not.toBeInTheDocument()
    // A genuinely valid residual_score still gets a real severity badge.
    // Scoped to the card, not the whole document: the legend (round 9)
    // also renders riskLevel.* text unconditionally.
    const card = screen
      .getByText("Supply Chain Disruption")
      .closest(".rounded-lg.border.bg-background") as HTMLElement
    expect(within(card).getByText("riskLevel.low")).toBeInTheDocument()
  })

  // quality-bar-loop round 5 (resilience, found during a full-panel
  // re-check): RiskBadge's severity color comes from
  // getRiskSeverityLevel(residual_score), which has the identical silent-
  // fallback bug hasValidRiskScore was built to catch -- but the original
  // version never checked residual_score, so a malformed value still
  // rendered a confident "Low" badge with no unscored indication.
  it("flags a risk with a malformed residual_score as unscored and suppresses the misleading severity badge", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ probability: 0, inherent_score: 0, residual_score: "" }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    const unscoredBadge = screen.getByText(
      "organization.riskMatrix.unscoredRiskBadge"
    )
    expect(unscoredBadge).toBeInTheDocument()
    // No severity badge on the card itself -- better than a misleadingly
    // confident one. Scoped to the card, not the whole document: the
    // legend (round 9) also renders riskLevel.* text unconditionally.
    const card = unscoredBadge.closest(".rounded-lg.border.bg-background")
    expect(card).not.toBeNull()
    expect(within(card as HTMLElement).queryByText(/riskLevel\./)).not.toBeInTheDocument()
  })

  // Regression (issue #359): the legend swatch for the lowest severity used
  // to have a different opacity than getMatrixColor (the function that
  // colors the actual matrix cells) returned for that same severity -- the
  // legend didn't match what was really on the grid. Now both the legend and
  // the cells share the landing page's --risk-low/55 ramp (see
  // src/pages/home/components/HeroProductVisual.tsx CELL_CLASS).
  it("colors the lowest-severity legend swatch the same as the matrix cells (bg-risk-low/55)", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    renderPage()

    const label = screen.getByText("riskLevel.low")
    const swatch = label.previousElementSibling
    expect(swatch).toHaveClass("bg-risk-low/55")
  })

  // quality-bar-loop round 10 (visual polish, round-1 finding): the
  // "Medium" swatch/cells used a flat /45 opacity in both themes, which
  // HSL->sRGB composite math confirmed renders as a washed-out pale peach
  // in light mode and a genuinely muddy brown/olive in dark mode, not the
  // clean amber --risk-medium actually is. Light mode had huge contrast
  // headroom to go more vivid (/75); dark mode could only move to /50
  // before the small count-text's contrast dropped below the WCAG AA
  // 4.5:1 floor -- ties the legend swatch to the same two-tier class the
  // matrix cells use, so they can't drift out of sync with each other.
  it("colors the medium-severity legend swatch the same two-tier opacity as the matrix cells", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    renderPage()

    const label = screen.getByText("riskLevel.medium")
    const swatch = label.previousElementSibling
    expect(swatch).toHaveClass("bg-risk-medium/75")
    expect(swatch).toHaveClass("dark:bg-risk-medium/50")
  })

  // quality-bar-loop round 11 (accessibility, surfaced during round 10's
  // review): re-checking bg-risk-critical/bg-risk-high's dark-mode tints
  // against the small 9px count-badge text (not just the large bold score
  // number this ramp's original comment verified) found both actually
  // failed the WCAG AA 4.5:1 small-text floor in dark mode.
  it("colors the critical-severity legend swatch with an accessible dark-mode tint", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    renderPage()

    const label = screen.getByText("riskLevel.critical")
    const swatch = label.previousElementSibling
    expect(swatch).toHaveClass("bg-risk-critical/90")
    expect(swatch).toHaveClass("dark:bg-risk-critical/85")
  })

  it("colors the high-severity legend swatch with an accessible dark-mode tint", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    renderPage()

    const label = screen.getByText("riskLevel.high")
    const swatch = label.previousElementSibling
    expect(swatch).toHaveClass("bg-risk-high/80")
    expect(swatch).toHaveClass("dark:bg-risk-high/63")
  })

  // quality-bar-loop round 9 (visual polish, round-1 finding): the legend
  // used to say "Critical/Major/Moderate/Weak" -- a one-off vocabulary
  // invented just for this page -- while this same page's own RiskCard
  // shows a RiskBadge reading "Critical/High/Medium/Low", the canonical
  // shared severity vocabulary used everywhere else in the app. Same
  // 4-bucket concept, two vocabularies on one screen.
  it("uses the same severity vocabulary in the legend as RiskBadge uses on the cards", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    renderPage()

    const legend = document.querySelector(".mt-6.flex.flex-wrap.gap-4") as HTMLElement
    expect(legend).not.toBeNull()
    expect(within(legend).getByText("riskLevel.critical")).toBeInTheDocument()
    expect(within(legend).getByText("riskLevel.high")).toBeInTheDocument()
    expect(within(legend).getByText("riskLevel.medium")).toBeInTheDocument()
    expect(within(legend).getByText("riskLevel.low")).toBeInTheDocument()
    // The old page-local vocabulary must be gone from the legend, not
    // just supplemented (note: "Moderate" legitimately still appears
    // elsewhere on the page, as an impact-axis tick label).
    expect(within(legend).queryByText("Major")).not.toBeInTheDocument()
    expect(within(legend).queryByText("Moderate")).not.toBeInTheDocument()
    expect(within(legend).queryByText("Weak")).not.toBeInTheDocument()
  })

  it("renders a real risk, not any hardcoded fixture", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk()] },
      isLoading: false,
    })
    renderPage()

    // probability/inherent_score are both a 0-100 scale, normalized to 0-1
    // before mapping onto the grid: 85/100=0.85 -> row round(0.85*4)=3
    // ("Probable"); 80/100=0.8 -> col round(0.8*4)=3 ("Major")
    expect(
      screen.getByTitle(/Probable × Major : 1 risk/)
    ).toBeInTheDocument()
  })

  it("places a risk in the correct matrix cell from real probability/inherent_score", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 0, inherent_score: 0 })] },
      isLoading: false,
    })
    renderPage()

    // probability 0, inherent_score 0 -> bottom-left cell (row 0, col 0)
    expect(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    ).toBeInTheDocument()
  })

  // Regression: probability/inherent_score are a 0-100 scale, not 0-1 or
  // 1-25. The old code multiplied a 0-100 probability directly by the grid's
  // max index (any probability >= ~13 clamped straight to the top row) and
  // divided inherent_score by 25 then multiplied by max again (double-scaled,
  // clamping to the max column for any inherent_score >= 32) -- between the
  // two, a genuinely low/moderate risk like this one used to render as
  // maximum likelihood AND maximum impact.
  it("does not clamp a low-probability, low-impact risk to the matrix's top row/column (aexa-frontend#194-adjacent scale bug)", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 15, inherent_score: 40 })] },
      isLoading: false,
    })
    renderPage()

    // 15/100=0.15 -> row round(0.15*4)=1 ("Unlikely");
    // 40/100=0.4 -> col round(0.4*4)=2 ("Moderate")
    expect(
      screen.getByTitle(/Unlikely × Moderate : 1 risk/)
    ).toBeInTheDocument()
    // The grid always renders all cells (even empty ones), so check the
    // top-right cell specifically shows 0 risks, not 1.
    expect(
      screen.getByTitle(/Very Likely × Catastrophic : 0 risks/)
    ).toBeInTheDocument()
  })

  it("shows the risk's real site name (not DUMMY_SITES) when its cell is selected", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 0, inherent_score: 0 })] },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    expect(screen.getByText("Casablanca HQ")).toBeInTheDocument()
  })

  // aexa-frontend#548: the selected-cell RiskCard showed risk name and site
  // name as plain text even though risk.id/site_id were already on the card's
  // data -- dead-ending the matrix instead of cross-linking into Risk/Sites.
  it("links the selected risk's name to its detail page", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [makeRisk({ probability: 0, inherent_score: 0 })],
      },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    const link = screen.getByRole("link", {
      name: "Supply Chain Disruption",
    })
    expect(link).toHaveAttribute("href", "/organization/risks/risk-1")
  })

  // quality-bar-loop round 6 (industry-standards): the bold number shown
  // on each matrix cell is a likelihood x impact BAND position, not any
  // individual risk's real score -- live-confirmed as a genuine
  // misreading risk since several risks with very different real scores
  // can land in the same band. Each risk's own real score is now shown
  // on its card so the band number is never the only score visible.
  it("shows the risk's own real score on its card, not just the cell's band number", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [makeRisk({ probability: 0, inherent_score: 0, residual_score: 42 })],
      },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    expect(screen.getByText("Score: 42")).toBeInTheDocument()
  })

  // quality-bar-loop round 8 (UX/accessibility, round-1 findings): no
  // focus management into the details panel after selecting a cell, and
  // no keyboard way to close/deselect it -- clicking a cell was
  // previously a one-way action with no easy undo path.
  it("moves focus to the details panel heading when a cell is selected", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 0, inherent_score: 0 })] },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus()
  })

  it("clears the selection when Escape is pressed", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 0, inherent_score: 0 })] },
      isLoading: false,
    })
    renderPage()

    const cell = screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    await userEvent.click(cell)
    expect(cell).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByText("organization.riskMatrix.escToDeselectHint")
    ).toBeInTheDocument()

    await userEvent.keyboard("{Escape}")

    expect(cell).toHaveAttribute("aria-pressed", "false")
    expect(
      screen.getByText("organization.riskMatrix.noRiskSelected")
    ).toBeInTheDocument()
  })

  // Review round 1 finding: SiteFilter renders a Radix Select, whose own
  // Escape-to-close handling runs in the capture phase and calls
  // preventDefault() (but not stopPropagation()) when it dismisses --
  // without checking defaultPrevented, this page's own Escape handler
  // would ALSO fire and silently wipe the matrix selection whenever a
  // user pressed Escape to close an unrelated dropdown.
  it("does not clear the selection when Escape was already claimed by another layer (e.g. a dropdown closing)", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 0, inherent_score: 0 })] },
      isLoading: false,
    })
    renderPage()

    const cell = screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    await userEvent.click(cell)
    expect(cell).toHaveAttribute("aria-pressed", "true")

    // Simulates a capture-phase handler (like Radix's DismissableLayer)
    // claiming the Escape keypress before this page's own bubble-phase
    // listener runs.
    const claimEscape = (e: KeyboardEvent) => e.preventDefault()
    document.addEventListener("keydown", claimEscape, { capture: true })
    await userEvent.keyboard("{Escape}")
    document.removeEventListener("keydown", claimEscape, { capture: true })

    expect(cell).toHaveAttribute("aria-pressed", "true")
  })

  it("links the selected risk's site name into Sites, scoped to that site", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [makeRisk({ probability: 0, inherent_score: 0 })],
      },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    const link = screen.getByRole("link", { name: /Casablanca HQ/ })
    expect(link).toHaveAttribute(
      "href",
      "/organization/sites?siteId=site-1&search=Casablanca%20HQ"
    )
  })

  // Regression: the Group Mode toggle hardcoded English/French label pairs
  // ("All"/"Tous", "By type"/"Par type") instead of using the existing
  // organization.correlationMatrix.groupAll/groupByType i18n keys (the same
  // "All"/"By type" pair already used on the Correlation Matrix page). The
  // react-i18next mock above only special-cases cellCount, so every other
  // key (including these) still falls back to itself unchanged -- asserting
  // the buttons show those keys (not the old hardcoded French) proves the
  // toggle now goes through t().
  it("renders the Group Mode toggle via the existing correlationMatrix i18n keys, not hardcoded French labels", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    renderPage()

    expect(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.groupAll",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.groupByType",
      })
    ).toBeInTheDocument()
    expect(screen.queryByText("Tous")).not.toBeInTheDocument()
    expect(screen.queryByText("Par type")).not.toBeInTheDocument()
  })

  it("shows the pluralized cell count in the visible cell label, not the old hardcoded French 'risque(s)'", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk()] },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("1 risk")).toBeInTheDocument()
    expect(screen.queryByText(/risque/)).not.toBeInTheDocument()
  })

  it("renders nothing selected when there are no risks at all", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    renderPage()

    // The "N risks positioned" subtitle is suppressed when empty (it would
    // contradict the dedicated empty-state notice just below it), so the
    // signal that nothing is selected/positioned is the empty-state title.
    expect(
      screen.getByText("organization.riskMatrix.emptyStateTitle")
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/risks positioned/)
    ).not.toBeInTheDocument()
  })

  // Regression (audit round 3): "{count} {t('...des')}" concatenated a raw
  // count with the fixed-plural string "Risks positioned", showing "1 Risks
  // positioned" for a single risk. Split into des_one/des_other i18next
  // plural keys (same pattern as the category subtitle fix above).
  it("pluralizes the risk count subtitle for a single risk (regression: used to show '1 Risks positioned')", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk()] },
      isLoading: false,
    })
    renderPage()

    expect(
      screen.getByText("1 risk positioned — Click on a cell to see details")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("1 risks positioned — Click on a cell to see details")
    ).not.toBeInTheDocument()
  })

  // Regression (audit round 3): "Impact →" axis header and the LABELS
  // matrix (likelihood/impact axis tick text) were hardcoded English,
  // bypassing t() entirely -- broken under the French UI.
  it("renders the Impact axis header and likelihood/impact tick labels through t(), not hardcoded English", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("Impact →")).toBeInTheDocument()
    // Default matrix size is 5x5.
    expect(screen.getByText("Very Unlikely")).toBeInTheDocument()
    expect(screen.getByText("Very Likely")).toBeInTheDocument()
    expect(screen.getByText("Negligible")).toBeInTheDocument()
    expect(screen.getByText("Catastrophic")).toBeInTheDocument()
  })

  // Regression (audit round 3): the selected-cell heading was a hardcoded
  // English template string ("{count} Risk(s) — Score {score}"), not run
  // through t() and not pluralized (always "Risk(s)" regardless of count).
  it("shows a pluralized, translated heading for the selected cell instead of a hardcoded 'Risk(s)' template", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 0, inherent_score: 0 })] },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    // row 0, col 0 -> score (0+1)*(0+1) = 1
    expect(screen.getByText("1 risk — band 1")).toBeInTheDocument()
    expect(screen.queryByText(/Risk\(s\)/)).not.toBeInTheDocument()
  })

  // quality-bar-loop round 2 -- three independent judges (industry-standards,
  // UX, resilience) live-reproduced this: row/col indices are only
  // meaningful relative to the grid size they were selected under.
  // Switching matrix size while a cell was selected used to leave the old
  // indices in place, which could coincide with a real, populated cell in
  // the new grid -- showing a DIFFERENT risk's data under a heading
  // computed from the stale indices, or a "0 risks -- score N" heading
  // paired with the generic "click a cell" body underneath it.
  it("clears a stale selection instead of showing a DIFFERENT risk's data when the matrix size changes", async () => {
    // Risk A lands at (row 2, col 2) in 5x5 -- select it there. Risk B is
    // deliberately chosen to land at that SAME (row 2, col 2) once the
    // grid is recomputed at 3x3 (each risk's cell is recomputed per-size,
    // not cached) -- the exact "old indices coincide with a real, but
    // different, populated cell" scenario three judges independently
    // live-reproduced. A weaker version of this test (indices that simply
    // fall out of bounds in the smaller grid) wouldn't actually exercise
    // this path, since an empty result already falls back correctly for
    // an unrelated reason (the heading's selectedRisks.length guard).
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "risk-a", probability: 44, inherent_score: 44 }),
          makeRisk({ id: "risk-b", probability: 90, inherent_score: 90 }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    // 44/100=0.44 -> row round(0.44*4)=2 ("Moderately Likely" in 5x5);
    // col round(0.44*4)=2 ("Moderate" in 5x5)
    await userEvent.click(
      screen.getByTitle(/Moderately Likely × Moderate : 1 risk/)
    )
    // (2+1)*(2+1) = 9
    expect(screen.getByText("1 risk — band 9")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "3×3" }))

    // Must fall back to the clean "nothing selected" state -- NOT keep
    // showing risk-a's stale heading, and NOT silently swap in risk-b
    // (which now occupies (row 2, col 2) under the 3x3 grid) as if the
    // user had selected it.
    expect(
      screen.getByText("organization.riskMatrix.noRiskSelected")
    ).toBeInTheDocument()
    expect(screen.queryByText(/score 9/)).not.toBeInTheDocument()
  })

  // Same class of bug, different trigger: a site filter narrowing the
  // selected cell to zero risks used to leave selectedCell set, so the
  // heading kept showing "0 risks -- score N" while the body fell through
  // to the generic "click a cell" hint -- a self-contradictory panel.
  it("clears a stale selection instead of a self-contradictory panel when a filter empties the selected cell", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            id: "risk-1",
            site_id: "site-1",
            probability: 0,
            inherent_score: 0,
          }),
        ],
      },
      isLoading: false,
    })
    mockUseGetAllSitesQuery.mockReturnValue({
      data: {
        data: [
          { id: "site-1", name: "Casablanca HQ" },
          { id: "site-2", name: "Rabat Branch" },
        ],
      },
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )
    expect(screen.getByText("1 risk — band 1")).toBeInTheDocument()

    // Select the OTHER site (via the stubbed SiteFilter above), which
    // owns none of the currently-selected cell's risks.
    await userEvent.click(
      screen.getByRole("button", { name: "Site filter: site-2" })
    )

    expect(
      screen.getByText("organization.riskMatrix.noRiskSelected")
    ).toBeInTheDocument()
    expect(screen.queryByText(/score 1\b/)).not.toBeInTheDocument()
  })

  // Round-1 review finding on PR #634: effectiveSelectedCell only masked
  // a size-mismatched selection for DISPLAY -- the underlying
  // selectedCell state was never actually cleared, so switching away and
  // then back to the original matrix size silently resurrected the old
  // selection, even though the panel had shown "nothing selected" for
  // the size in between.
  it("does not resurrect a selection after switching matrix size away and back", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 0, inherent_score: 0 })] },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )
    expect(screen.getByText("1 risk — band 1")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "3×3" }))
    expect(
      screen.getByText("organization.riskMatrix.noRiskSelected")
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "5×5" }))
    expect(
      screen.getByText("organization.riskMatrix.noRiskSelected")
    ).toBeInTheDocument()
    expect(screen.queryByText(/score 1\b/)).not.toBeInTheDocument()
  })

  // Round-1 review finding on PR #634: the cell's own ring/highlight
  // stayed showing after a site filter narrowed it to zero risks, even
  // though the details panel had already fallen back to "nothing
  // selected" -- the same stale-selection-display bug this PR exists to
  // fix, just for the cell's own aria-pressed/visual state.
  it("un-highlights the selected cell once a filter narrows it to zero risks", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            id: "risk-1",
            site_id: "site-1",
            probability: 0,
            inherent_score: 0,
          }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    const cell = screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    await userEvent.click(cell)
    expect(cell).toHaveAttribute("aria-pressed", "true")

    await userEvent.click(
      screen.getByRole("button", { name: "Site filter: site-2" })
    )
    expect(cell).toHaveAttribute("aria-pressed", "false")
  })

  // Regression (aexa-frontend#412): the PageRank badge on a risk card was a
  // hardcoded "PR: {score}" string that never ran through t(), so it stayed
  // English under the French UI while every other label in the card
  // translated correctly.
  it("routes the PageRank badge through t() instead of a hardcoded 'PR:' string", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            pagerank_score: 42,
            probability: 0,
            inherent_score: 0,
          }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    // The risk card (and its PageRank badge) only renders once its matrix
    // cell is selected.
    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    expect(screen.getByText("PR: 42")).toBeInTheDocument()
  })

  // Regression (aexa-frontend#519): the risk-detail card in the matrix's
  // side panel showed the raw risk.id (UUID) instead of risk.ref (the
  // human-readable code, e.g. "CYB-001") -- unlike the identical
  // RiskDetailCard in CorrelationMatrixPage.tsx, which already used ref.
  it("shows the human-readable risk ref, not the raw risk id, on the selected risk card", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            id: "b3f1c9a0-1234-4c5d-8e6f-abcdef123456",
            ref: "CYB-001",
            probability: 0,
            inherent_score: 0,
          }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    expect(screen.getByText("CYB-001")).toBeInTheDocument()
    expect(
      screen.queryByText("b3f1c9a0-1234-4c5d-8e6f-abcdef123456")
    ).not.toBeInTheDocument()
  })

  // Regression (audit round 4 / #346): the AI-generated badge on a risk card
  // hardcoded the literal "IA" instead of routing through the same
  // organization.riskRegister.aiGenerated i18n key RiskRegisterPage.tsx
  // already uses for the identical badge.
  it("shows the AI-generated badge via the shared riskRegister.aiGenerated i18n key, not a hardcoded 'IA'", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            probability: 0,
            inherent_score: 0,
            ai_generated: true,
          }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    expect(
      screen.getByText("organization.riskRegister.aiGenerated")
    ).toBeInTheDocument()
    expect(screen.queryByText("IA")).not.toBeInTheDocument()
  })

  it("does not show an AI-generated badge for a manual risk", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ probability: 0, inherent_score: 0, ai_generated: false }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    expect(
      screen.queryByText("organization.riskRegister.aiGenerated")
    ).not.toBeInTheDocument()
  })

  // Regression (audit round 4 / #348): the group-header category label fell
  // back to the raw category string when unmapped, but RiskCard's per-card
  // label fell back to blank (undefined) instead -- inconsistent. Both now
  // fall back to the raw category string.
  it("falls back to the raw category string (not blank) on both the group header and the risk card for an unmapped category", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            probability: 0,
            inherent_score: 0,
            category: "some_future_category",
          }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    // Switch to "By type" grouping (only then does the details panel render
    // a group header above the risk cards) and select the cell.
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.groupByType",
      })
    )
    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    // Both the group header and the card's own per-risk category label show
    // the raw category string -- neither renders blank. The group header
    // combines the label with a "(count)" suffix in the same element (so
    // getAllByText's exact-text-node matching only catches the card's own
    // isolated span) -- match on textContent instead to catch both.
    const matches = Array.from(document.querySelectorAll("span")).filter(
      (el) => el.textContent?.includes("some_future_category")
    )
    expect(matches.length).toBe(2)
  })

  // aexa-frontend#472 -- the matrix-size, group-mode, and cell-selection
  // toggle groups never exposed aria-pressed, so a screen reader user
  // couldn't tell which option was currently active (unlike
  // RiskRegisterPage.tsx's equivalent pending-approval toggle, which
  // already had it).
  describe("toggle-group aria-pressed", () => {
    it("marks only the active matrix-size button as pressed", async () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      renderPage()

      const btn5 = screen.getByRole("button", { name: "5×5" })
      const btn3 = screen.getByRole("button", { name: "3×3" })
      expect(btn5).toHaveAttribute("aria-pressed", "true")
      expect(btn3).toHaveAttribute("aria-pressed", "false")

      await userEvent.click(btn3)
      expect(btn3).toHaveAttribute("aria-pressed", "true")
      expect(btn5).toHaveAttribute("aria-pressed", "false")
    })

    it("marks only the active group-mode button as pressed", async () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      renderPage()

      const groupAll = screen.getByRole("button", {
        name: "organization.correlationMatrix.groupAll",
      })
      const groupByType = screen.getByRole("button", {
        name: "organization.correlationMatrix.groupByType",
      })
      expect(groupAll).toHaveAttribute("aria-pressed", "true")
      expect(groupByType).toHaveAttribute("aria-pressed", "false")

      await userEvent.click(groupByType)
      expect(groupByType).toHaveAttribute("aria-pressed", "true")
      expect(groupAll).toHaveAttribute("aria-pressed", "false")
    })

    it("marks a selected matrix cell as pressed", async () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({ id: "r1", probability: 10, inherent_score: 10 }),
          ],
        },
        isLoading: false,
      })
      renderPage()

      const cell = screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
      expect(cell).toHaveAttribute("aria-pressed", "false")

      await userEvent.click(cell)
      expect(cell).toHaveAttribute("aria-pressed", "true")
    })

    // aexa-frontend#497 -- matrix cells relied on the `title` tooltip alone,
    // which isn't reliably exposed to screen readers. CorrelationMatrixPage's
    // functionally-identical cells got aria-label in round 9's #480; this
    // brings RiskMatrixPage's cells in line.
    it("gives each matrix cell an aria-label describing likelihood, impact, and risk count", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({ id: "r1", probability: 10, inherent_score: 10 }),
          ],
        },
        isLoading: false,
      })
      renderPage()

      const cell = screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
      expect(cell).toHaveAttribute(
        "aria-label",
        "Very Unlikely × Negligible: 1 risk"
      )
    })
  })

  // aexa-frontend#472 -- h1 used to be followed directly by an h3 with no
  // h2 anywhere on the page, breaking heading-level order for screen-reader
  // users. It's the page's only sub-heading, so it was promoted to h2.
  it("has no orphaned h3 -- the details-panel heading is an h2 directly under h1", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument()
  })
})
