import { render, screen } from "@testing-library/react"
import RiskGraphPage from "./RiskGraphPage"

const mockUseGetAllRisksQuery = vi.fn()

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) =>
    mockUseGetAllRisksQuery(...args),
}))

// SiteFilter independently calls useGetAllSitesQuery -- stubbed out so this
// test file stays scoped to RiskGraphPage's own data wiring, same pattern
// Overview.test.tsx uses for CriticalAlertBanner.
vi.mock("@/components/dashboard/organization/SiteFilter", () => ({
  default: () => null,
}))

function makeRisk(overrides = {}) {
  return {
    id: "risk-real-1",
    org_account_id: "org-1",
    name: "Supply Chain Disruption",
    description: "Delays in raw material delivery",
    category: "supply_chain",
    inherent_score: 20,
    residual_score: 5,
    pagerank_score: 42,
    financial_impact_min: 50000,
    financial_impact_max: 200000,
    probability: 0.6,
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

describe("RiskGraphPage", () => {
  beforeEach(() => {
    mockUseGetAllRisksQuery.mockReset()
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
  })

  it("shows a loading state while risks are loading", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: undefined, isLoading: true })
    render(<RiskGraphPage />)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("renders real risk ids as graph nodes, not the old mock fixture ids", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "risk-real-1" })] },
      isLoading: false,
    })
    render(<RiskGraphPage />)

    // Short ids fit inside the node, so both the SVG <text> label and the
    // <title> tooltip render the id in full (two matching elements).
    const matches = screen.getAllByText("risk-real-1")
    expect(
      matches.some((el) => el.tagName.toLowerCase() === "text")
    ).toBe(true)
    expect(screen.queryByText("risk_fire")).not.toBeInTheDocument()
  })

  it("truncates a full-length UUID node label but keeps the full id in a tooltip", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: uuid })] },
      isLoading: false,
    })
    render(<RiskGraphPage />)

    // The visible node label is truncated to the first 8 chars of the UUID...
    const label = screen.getByText("123e4567")
    expect(label.tagName.toLowerCase()).toBe("text")
    // ...while the full UUID is preserved only in the <title> tooltip.
    const fullId = screen.getByText(uuid)
    expect(fullId.tagName.toLowerCase()).toBe("title")
  })

  it("aexa-frontend#376: shows selected risk's max impact as M€ from its stored k€ units", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "risk-real-1", financial_impact_max: 500000 })] },
      isLoading: false,
    })
    render(<RiskGraphPage />)

    const nodeLabel = screen
      .getAllByText("risk-real-1")
      .find((el) => el.tagName.toLowerCase() === "text")!
    await userEvent.click(nodeLabel)

    // The Min/Max Impact form fields are labeled "k€" and submitted
    // unmodified, so the stored value is already in k€: 500,000 k€ / 1,000
    // = 500.0M€. Dividing by 1,000,000 instead (as aexa-frontend#236's fix
    // previously did) understated every figure 1000x, rendering "0.5M€" for
    // what should have read "500.0M€". The value and "M€" suffix render as
    // separate text nodes within the same <p>, so match on the element's
    // combined textContent rather than getByText's per-node text.
    expect(
      screen.getByText((_, el) => el?.textContent === "500.0M€")
    ).toBeInTheDocument()
  })

  it("shows zero correlations rather than fabricated links against real risk data", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "risk-real-1" }), makeRisk({ id: "risk-real-2" })] },
      isLoading: false,
    })
    render(<RiskGraphPage />)

    // t() echoes the key in the test env (i18n is not initialized in setup).
    expect(
      screen.getByText("organization.riskGraph.correlations (0)")
    ).toBeInTheDocument()
  })
})
