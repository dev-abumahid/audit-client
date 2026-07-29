import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import RiskMatrixPage from "./RiskMatrixPage"

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
      screen.getByTitle(/Probable × Major : 1 risque/)
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
      screen.getByTitle(/Very Unlikely × Negligible : 1 risque/)
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
      screen.getByTitle(/Unlikely × Moderate : 1 risque/)
    ).toBeInTheDocument()
    // The grid always renders all cells (even empty ones), so check the
    // top-right cell specifically shows 0 risks, not 1.
    expect(
      screen.getByTitle(/Very Likely × Catastrophic : 0 risque/)
    ).toBeInTheDocument()
  })

  it("shows the risk's real site name (not DUMMY_SITES) when its cell is selected", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ probability: 0, inherent_score: 0 })] },
      isLoading: false,
    })
    render(<RiskMatrixPage />)

    await userEvent.click(
      screen.getByTitle(/Very Unlikely × Negligible : 1 risque/)
    )

    expect(screen.getByText("Casablanca HQ")).toBeInTheDocument()
  })

  // Regression: the Group Mode toggle hardcoded English/French label pairs
  // ("All"/"Tous", "By type"/"Par type") instead of using the existing
  // organization.correlationMatrix.groupAll/groupByType i18n keys (the same
  // "All"/"By type" pair already used on the Correlation Matrix page). This
  // suite doesn't mock react-i18next, so uninitialized i18next returns the
  // raw key -- asserting the buttons show those keys (not the old hardcoded
  // French) proves the toggle now goes through t().
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

  it("renders nothing selected when there are no risks at all", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    render(<RiskMatrixPage />)

    expect(screen.getByText("0 organization.riskMatrix.des")).toBeInTheDocument()
  })
})
