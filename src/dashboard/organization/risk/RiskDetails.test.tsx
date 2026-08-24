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

  it("shows an Anchored badge with the citation as a tooltip for an AI-generated, anchored risk", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: {
        data: makeRisk({
          ai_generated: true,
          source_type: "anchored",
          source_reference: "GDELT: 3+ negative-coverage articles",
        }),
      },
      isLoading: false,
    })

    renderPage()

    const badge = screen.getByText(
      "organization.riskRegister.confirmedBadge"
    )
    expect(badge).toBeInTheDocument()
    expect(badge.closest("span")).toHaveAttribute(
      "title",
      "organization.riskRegister.confirmedTooltip"
    )
    expect(
      badge.closest("span")?.querySelector(".lucide-circle-check-big")
    ).toBeInTheDocument()
  })

  it("falls back to the plain Anchored label as the tooltip when source_reference is null", () => {
    // Round-1 review found this component and RiskRegisterPage.tsx
    // handled a null source_reference on an "anchored" risk differently
    // (this one previously rendered no tooltip at all; the register
    // table's icon fell back to the badge label). The backend should
    // never actually send this combination, but the type permits it --
    // aligned to RiskRegisterPage.tsx's existing, more useful fallback.
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: {
        data: makeRisk({
          ai_generated: true,
          source_type: "anchored",
          source_reference: null,
        }),
      },
      isLoading: false,
    })

    renderPage()

    const badge = screen.getByText(
      "organization.riskRegister.confirmedBadge"
    )
    expect(badge.closest("span")).toHaveAttribute(
      "title",
      "organization.riskRegister.confirmedBadge"
    )
  })

  it("shows an Estimated indicator (not Anchored) for an AI-generated, estimated risk", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: {
        data: makeRisk({
          ai_generated: true,
          source_type: "estimated",
          source_reference: null,
        }),
      },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText("organization.riskRegister.unconfirmedBadge")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.riskRegister.confirmedBadge")
    ).not.toBeInTheDocument()
  })

  it("shows the citation confidence badge when set, distinct from source_type", () => {
    // Round-1 quality-bar-loop finding (cross-view integration): this
    // signal used to exist only in the pending-review queue and vanish
    // once a risk was approved -- now carries over to the detail page.
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: {
        data: makeRisk({
          citation_confidence: "curated_verified",
        }),
      },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText(
        "organization.riskRegister.citationConfidence.curated_verified"
      )
    ).toBeInTheDocument()
  })

  it("does not render a citation confidence badge when citation_confidence is null", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk({ citation_confidence: null }) },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByText(
        "organization.riskRegister.citationConfidence.curated_verified"
      )
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("organization.riskRegister.citationConfidence.none")
    ).not.toBeInTheDocument()
  })

  it("does not show an Anchored or Estimated indicator for a manually created risk", () => {
    // Regression: source_type defaults to "estimated" in the DB for every
    // row including manually created ones -- this indicator must only
    // ever appear for AI-generated risks, or it would misleadingly imply
    // every manual risk is a low-confidence "estimate". Uses
    // source_type: "anchored" (not the more common "estimated") so the
    // test actually exercises the ai_generated gate itself, rather than
    // passing vacuously because source_type already isn't "anchored".
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: {
        data: makeRisk({
          ai_generated: false,
          source_type: "anchored",
          source_reference: "GDELT: 3+ negative-coverage articles",
        }),
      },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByText("organization.riskRegister.confirmedBadge")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("organization.riskRegister.unconfirmedBadge")
    ).not.toBeInTheDocument()
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

  // getRiskSeverityLevel silently maps a missing/malformed score to 0
  // ("low"), which would otherwise render a confident low-severity badge
  // for a risk that was never actually scored -- same treatment
  // RiskMatrixPage got for this bug class (aexa-frontend#636).
  it("flags a malformed inherent_score as unscored instead of a confident low-severity badge", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk({ inherent_score: "" }) },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText("organization.riskMatrix.unscoredRiskBadge")
    ).toBeInTheDocument()
    // The genuinely-valid residual_score (38) still renders normally.
    expect(screen.getByText("38")).toBeInTheDocument()
  })

  it("flags a malformed residual_score as unscored instead of a confident low-severity badge", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk({ residual_score: null }) },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText("organization.riskMatrix.unscoredRiskBadge")
    ).toBeInTheDocument()
    // The genuinely-valid inherent_score (62) still renders normally.
    expect(screen.getByText("62")).toBeInTheDocument()
  })

  it("does not flag a genuinely low but valid score (0) as unscored", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk({ inherent_score: 0, residual_score: 0 }) },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByText("organization.riskMatrix.unscoredRiskBadge")
    ).not.toBeInTheDocument()
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

  // Raw <button>s with no explicit type default to type="submit" per the
  // HTML spec -- a latent bug if this page ever ends up inside a <form>.
  // Every button this page renders is a raw <button> (no shadcn <Button>
  // usage here, and RiskApprovalControls is stubbed out above so it can't
  // contribute any). The not-found and found states are mutually exclusive
  // early returns, so each gets its own sweep to cover the button(s) that
  // state actually mounts, rather than one sweep silently missing the
  // other branch's button.
  it("gives the not-found state's back button an explicit type so it doesn't default to implicit submit", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    renderPage()

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })

  it("gives every button in the found state an explicit type so none default to implicit submit", () => {
    mockUseGetSingleRiskQuery.mockReturnValue({
      data: { data: makeRisk() },
      isLoading: false,
    })

    renderPage()

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })

  // aexa-server#347: EBITDA-at-risk section.
  describe("EBITDA at Risk (#347)", () => {
    it("shows the not-yet-calculable explainer when ebitda_at_risk is null", () => {
      mockUseGetSingleRiskQuery.mockReturnValue({
        data: { data: makeRisk({ ebitda_at_risk: null }) },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByText("organization.riskRegister.ebitdaNotCalculated")
      ).toBeInTheDocument()
    })

    it("renders the computed EBITDA-at-risk amount, benchmark sector, and margin", () => {
      mockUseGetSingleRiskQuery.mockReturnValue({
        data: {
          data: makeRisk({
            impact: 70,
            ebitda_at_risk: 34_552_000,
            ebitda_benchmark_sector: "CHEMICAL_BASIC",
            ebitda_benchmark_margin: 0.1234,
            ebitda_is_override: false,
            ebitda_override_stale: false,
            ebitda_overridden_by: null,
            ebitda_overridden_at: null,
          }),
        },
        isLoading: false,
      })

      renderPage()

      expect(screen.getByText("€34.55M")).toBeInTheDocument()
      // Round-1 review fix: the raw sector key ("CHEMICAL_BASIC") is
      // formatted to Title Case ("Chemical Basic") for display -- see
      // utils/ebitdaSector.ts.
      expect(screen.getByText("Chemical Basic")).toBeInTheDocument()
      expect(screen.queryByText("CHEMICAL_BASIC")).not.toBeInTheDocument()
      expect(screen.getByText("12.3%")).toBeInTheDocument()
    })

    it("shows the override badge when ebitda_is_override is true", () => {
      mockUseGetSingleRiskQuery.mockReturnValue({
        data: {
          data: makeRisk({
            ebitda_at_risk: 10_000_000,
            ebitda_benchmark_sector: "CHEMICAL_BASIC",
            ebitda_benchmark_margin: 0.2,
            ebitda_is_override: true,
            ebitda_override_stale: false,
            ebitda_overridden_by: "user-1",
            ebitda_overridden_at: "2026-08-01T10:00:00.000Z",
          }),
        },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByText("organization.riskRegister.overrideActiveBadge")
      ).toBeInTheDocument()
    })

    // Round-1 review gap: no test anywhere verified risk.impact (the
    // "Severity" field the EBITDA formula's "Severite" input maps onto)
    // actually renders on the detail page, even though the EBITDA test
    // above sets impact: 70 on its fixture without ever asserting on it.
    it("renders the risk's impact (Severity) value in the assessment section", () => {
      mockUseGetSingleRiskQuery.mockReturnValue({
        data: { data: makeRisk({ impact: 70 }) },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByText("organization.riskRegister.impactLabel")
      ).toBeInTheDocument()
      expect(screen.getByText("70")).toBeInTheDocument()
    })
  })
})
