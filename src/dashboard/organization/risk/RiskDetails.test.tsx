import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import RiskDetails from "./RiskDetails"

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return {
    ...mod,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "risk-1" }),
  }
})

const mockUseGetSingleRiskQuery = vi.fn()
vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetSingleRiskQuery: (...args: unknown[]) =>
    mockUseGetSingleRiskQuery(...args),
}))

const mockUseGetRiskApprovalStateQuery = vi.fn()
vi.mock("@/redux/apis/organization/riskApproval.api", () => ({
  useGetRiskApprovalStateQuery: (...args: unknown[]) =>
    mockUseGetRiskApprovalStateQuery(...args),
}))

// RiskApprovalControls has its own dedicated test file
// (RiskApprovalControls.test.tsx) -- stubbed here as a black box, same
// convention RiskRegisterPage.test.tsx already uses for it, so this suite
// stays focused on RiskDetails' own rendering/not-found/loading logic.
vi.mock("./RiskApprovalControls", () => ({
  default: ({
    risk,
  }: {
    risk: { id: string; approvalStatus?: string; approval?: { id: string } | null }
  }) => (
    <span data-testid={`approval-controls-${risk.id}`}>
      {risk.approvalStatus ?? "none"} /{" "}
      {risk.approval?.id ?? "no-approval-record"}
    </span>
  ),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <RiskDetails />
    </MemoryRouter>
  )
}

function makeRisk(overrides = {}) {
  return {
    id: "risk-1",
    ref: "CYB-001",
    name: "Supply chain disruption",
    description: "Critical supplier dependency",
    category: "supply_chain",
    inherent_score: 62,
    inherent_is_override: false,
    inherent_override_reason: null,
    inherent_overridden_by: null,
    inherent_overridden_at: null,
    inherent_override_stale: false,
    residual_score: 38,
    residual_is_override: false,
    residual_override_reason: null,
    residual_overridden_by: null,
    residual_overridden_at: null,
    residual_override_stale: false,
    pagerank_score: 3,
    financial_impact_min: 100000,
    financial_impact_max: 500000,
    probability: 40,
    velocity: "high",
    trend: "worsening",
    status: "open",
    ai_generated: false,
    is_edited: false,
    site_id: "site-1",
    site: { id: "site-1", name: "HQ Casablanca" },
    control_design_eff: 60,
    control_operating_eff: 55,
    line_of_defense: "FIRST",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-05T10:00:00.000Z",
    ...overrides,
  }
}

describe("RiskDetails", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockUseGetSingleRiskQuery.mockReset()
    mockUseGetRiskApprovalStateQuery.mockReturnValue({ data: undefined })
  })

  it("shows a loading state while the risk is being fetched", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    renderPage()

    expect(
      screen.getByText("organization.riskRegister.detailsLoading")
    ).toBeInTheDocument()
  })

  it("shows a not-found state and a working back button when the risk doesn't exist", async () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText("organization.riskRegister.detailsNotFound")
    ).toBeInTheDocument()
    const backButton = screen.getByRole("button", {
      name: /organization.riskRegister.detailsGoBack/,
    })
    backButton.click()
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it("renders the risk's ref, name, description, and category", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk() },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText("CYB-001")).toBeInTheDocument()
    expect(screen.getByText("Supply chain disruption")).toBeInTheDocument()
    expect(
      screen.getByText("Critical supplier dependency")
    ).toBeInTheDocument()
  })

  it("renders both inherent and residual scores", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk() },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText("62")).toBeInTheDocument()
    expect(screen.getByText("38")).toBeInTheDocument()
  })

  // aexa-frontend#541: the site name is now a real link into SitesEntities
  // (same ?siteId=&search= pattern #533 used for a Finding's site), not
  // just inert text.
  it("links its site's name to SitesEntities with siteId and search pre-filled", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk() },
      isLoading: false,
    })

    renderPage()

    const link = screen.getByRole("link", { name: "HQ Casablanca" })
    expect(link).toHaveAttribute(
      "href",
      "/organization/sites?siteId=site-1&search=HQ%20Casablanca"
    )
  })

  it("falls back to a group label when the risk has no site", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk({ site: null }) },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText("organization.riskRegister.groupFallback")
    ).toBeInTheDocument()
  })

  // aexa-frontend#529: the single-risk fetch doesn't carry approval state,
  // so this page fetches it separately and must merge it into what
  // RiskApprovalControls receives -- not leave it undefined (which would
  // read as "not submitted" even for an already-approved risk).
  it("merges the separately-fetched approval state into RiskApprovalControls", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk() },
      isLoading: false,
    })
    mockUseGetRiskApprovalStateQuery.mockReturnValue({
      data: {
        data: {
          riskId: "risk-1",
          status: "APPROVED",
          approval: { id: "appr-1" },
        },
      },
    })

    renderPage()

    // Asserts on both approvalStatus AND approval.id -- a merge that dropped
    // `approval` while keeping `approvalStatus` (or vice versa) would still
    // pass a status-only assertion.
    const controls = screen.getByTestId("approval-controls-risk-1")
    expect(controls).toHaveTextContent("APPROVED")
    expect(controls).toHaveTextContent("appr-1")
  })

  it("navigates to the register when Manage in Register is clicked", async () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk() },
      isLoading: false,
    })

    renderPage()

    screen
      .getByRole("button", {
        name: "organization.riskRegister.detailsManageInRegister",
      })
      .click()

    expect(mockNavigate).toHaveBeenCalledWith("/organization/risks")
  })
})
