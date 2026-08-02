import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import RiskMatrixPage from "./RiskMatrixPage"

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
            ? `${count} Risk positioned — Click on a cell to see details`
            : `${count} Risks positioned — Click on a cell to see details`
        }
        if (key === "organization.riskMatrix.selectedCellHeading") {
          const count = Number(opts?.count ?? 0)
          const score = opts?.score
          return count === 1
            ? `${count} Risk — Score ${score}`
            : `${count} Risks — Score ${score}`
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

function makeRisk(overrides = {}) {
  return {
    id: "risk-1",
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
    render(<RiskMatrixPage />)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("renders a real risk, not any hardcoded fixture", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk()] },
      isLoading: false,
    })
    render(<RiskMatrixPage />)

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
    render(<RiskMatrixPage />)

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
    render(<RiskMatrixPage />)

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
    render(<RiskMatrixPage />)

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    expect(screen.getByText("Casablanca HQ")).toBeInTheDocument()
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
    render(<RiskMatrixPage />)

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
    render(<RiskMatrixPage />)

    expect(screen.getByText("1 risk")).toBeInTheDocument()
    expect(screen.queryByText(/risque/)).not.toBeInTheDocument()
  })

  it("renders nothing selected when there are no risks at all", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    render(<RiskMatrixPage />)

    expect(
      screen.getByText(
        "0 Risks positioned — Click on a cell to see details"
      )
    ).toBeInTheDocument()
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
    render(<RiskMatrixPage />)

    expect(
      screen.getByText("1 Risk positioned — Click on a cell to see details")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("1 Risks positioned — Click on a cell to see details")
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
    render(<RiskMatrixPage />)

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
    render(<RiskMatrixPage />)

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risk/)
    )

    // row 0, col 0 -> score (0+1)*(0+1) = 1
    expect(screen.getByText("1 Risk — Score 1")).toBeInTheDocument()
    expect(screen.queryByText(/Risk\(s\)/)).not.toBeInTheDocument()
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
    render(<RiskMatrixPage />)

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
    render(<RiskMatrixPage />)

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
    render(<RiskMatrixPage />)

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
})
