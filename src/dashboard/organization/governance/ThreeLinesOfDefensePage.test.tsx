import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ThreeLinesOfDefensePage from "./ThreeLinesOfDefensePage"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)
const mockToastSuccess = vi.mocked(toast.success)

// Role hook is mocked per-test via this mutable holder, same convention as
// RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
}))

const mockUseGetThreeLinesOfDefenseQuery = vi.fn()
vi.mock("@/redux/apis/organization/governance.api", () => ({
  useGetThreeLinesOfDefenseQuery: (...args: unknown[]) =>
    mockUseGetThreeLinesOfDefenseQuery(...args),
}))

const mockUpdateRisk = vi.fn()
vi.mock("@/redux/apis/organization/risk.api", () => ({
  useUpdateRiskMutation: () => [mockUpdateRisk, { isLoading: false }],
}))

const mockUpdateFindingById = vi.fn()
vi.mock("@/redux/apis/organization/findings.api", () => ({
  useUpdateFindingByIdMutation: () => [mockUpdateFindingById, { isLoading: false }],
}))

const mockUpdateKri = vi.fn()
vi.mock("@/redux/apis/organization/kri.api", () => ({
  useUpdateKriMutation: () => [mockUpdateKri, { isLoading: false }],
}))

const mockUpdateCompliance = vi.fn()
vi.mock("@/redux/apis/organization/compliance.api", () => ({
  useUpdateComplianceMutation: () => [mockUpdateCompliance, { isLoading: false }],
}))

const mockUpdateAuditEngagement = vi.fn()
vi.mock("@/redux/apis/organization/audit.api", () => ({
  useUpdateAuditEngagementMutation: () => [
    mockUpdateAuditEngagement,
    { isLoading: false },
  ],
}))

function makeData(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      risks: [
        {
          id: "risk-1",
          title: "Supply chain disruption",
          category: "supply_chain",
          status: "open",
          line_of_defense: "FIRST",
        },
      ],
      actions: [
        {
          id: "action-1",
          title: "Patch critical vulnerability",
          priority: "High",
          status: "TO_DO",
          line_of_defense: "SECOND",
        },
        {
          id: "action-unclassified",
          title: "Legacy remediation item",
          priority: "Low",
          status: "IN_PROGRESS",
          line_of_defense: null,
        },
      ],
      kris: [
        {
          id: "kri-1",
          title: "Supplier Lead Time",
          unit: "days",
          status: "OK",
          line_of_defense: "SECOND",
        },
      ],
      complianceObligations: [
        {
          id: "compliance-1",
          title: "GDPR data mapping",
          domain: "data_protection",
          status: "compliant",
          line_of_defense: "SECOND",
        },
      ],
      auditEngagements: [
        {
          id: "audit-1",
          title: "Q3 internal audit",
          status: "planned",
          lead_auditor: "Jane Doe",
          line_of_defense: "THIRD",
        },
      ],
      ...overrides,
    },
  }
}

describe("ThreeLinesOfDefensePage", () => {
  beforeEach(() => {
    mockRole = "ADMIN"
    mockUseGetThreeLinesOfDefenseQuery.mockReset()
    mockUpdateRisk.mockReset()
    mockUpdateFindingById.mockReset()
    mockUpdateKri.mockReset()
    mockUpdateCompliance.mockReset()
    mockUpdateAuditEngagement.mockReset()
    mockToastError.mockReset()
    mockToastSuccess.mockReset()
  })

  it("renders all 3 lines with items from multiple entity types", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    render(<ThreeLinesOfDefensePage />)

    expect(
      screen.getByText("organization.threeLinesOfDefense.lines.first")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.threeLinesOfDefense.lines.second")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.threeLinesOfDefense.lines.third")
    ).toBeInTheDocument()

    // Items land in their respective line: risk in 1st, kri+compliance+action
    // in 2nd, audit in 3rd.
    expect(screen.getByText("Supply chain disruption")).toBeInTheDocument()
    expect(screen.getByText("Patch critical vulnerability")).toBeInTheDocument()
    expect(screen.getByText("Supplier Lead Time")).toBeInTheDocument()
    expect(screen.getByText("GDPR data mapping")).toBeInTheDocument()
    expect(screen.getByText("Q3 internal audit")).toBeInTheDocument()
  })

  it("shows the Unclassified Actions bucket for an Action with a null line_of_defense", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    render(<ThreeLinesOfDefensePage />)

    expect(
      screen.getByText("organization.threeLinesOfDefense.unclassified.title")
    ).toBeInTheDocument()
    expect(screen.getByText("Legacy remediation item")).toBeInTheDocument()

    // The unclassified action must not also appear under a classified line.
    expect(screen.getAllByText("Legacy remediation item")).toHaveLength(1)
  })

  it("shows reassignment controls for an ADMIN", () => {
    mockRole = "ADMIN"
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    render(<ThreeLinesOfDefensePage />)

    expect(
      screen.getAllByRole("button", {
        name: "organization.threeLinesOfDefense.moveToSecond",
      }).length
    ).toBeGreaterThan(0)
  })

  it("shows reassignment controls for a LEAD_AUDITOR", () => {
    mockRole = "LEAD_AUDITOR"
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    render(<ThreeLinesOfDefensePage />)

    expect(
      screen.getAllByRole("button", {
        name: "organization.threeLinesOfDefense.moveToThird",
      }).length
    ).toBeGreaterThan(0)
  })

  it("hides reassignment controls for a VIEWER", () => {
    mockRole = "VIEWER"
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    render(<ThreeLinesOfDefensePage />)

    expect(
      screen.queryByRole("button", {
        name: "organization.threeLinesOfDefense.moveToSecond",
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: "organization.threeLinesOfDefense.moveToFirst",
      })
    ).not.toBeInTheDocument()
  })

  it("hides reassignment controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    render(<ThreeLinesOfDefensePage />)

    expect(
      screen.queryByRole("button", {
        name: "organization.threeLinesOfDefense.moveToThird",
      })
    ).not.toBeInTheDocument()
  })

  it("calls updateRisk with line_of_defense when reassigning a risk", async () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })
    mockUpdateRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<ThreeLinesOfDefensePage />)

    // Supply chain disruption risk is in FIRST -- the other-line buttons are
    // "Move to 2nd Line" and "Move to 3rd Line".
    const moveButtons = screen.getAllByRole("button", {
      name: "organization.threeLinesOfDefense.moveToSecond",
    })
    await userEvent.click(moveButtons[0])

    await waitFor(() =>
      expect(mockUpdateRisk).toHaveBeenCalledWith({
        id: "risk-1",
        data: { line_of_defense: "SECOND" },
      })
    )
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
  })

  it("calls updateFindingById with line_of_defense when reassigning an unclassified action", async () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })
    mockUpdateFindingById.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<ThreeLinesOfDefensePage />)

    // The unclassified action row has all 3 "move to" buttons since it has
    // no current line to exclude.
    const firstLineButtons = screen.getAllByRole("button", {
      name: "organization.threeLinesOfDefense.moveToFirst",
    })
    await userEvent.click(firstLineButtons[firstLineButtons.length - 1])

    await waitFor(() =>
      expect(mockUpdateFindingById).toHaveBeenCalledWith({
        id: "action-unclassified",
        body: { line_of_defense: "FIRST" },
      })
    )
  })

  it("shows an error toast when a reassignment mutation fails", async () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })
    mockUpdateRisk.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Only ADMIN/LEAD_AUDITOR can do this" } }),
    })

    render(<ThreeLinesOfDefensePage />)

    const moveButtons = screen.getAllByRole("button", {
      name: "organization.threeLinesOfDefense.moveToSecond",
    })
    await userEvent.click(moveButtons[0])

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Only ADMIN/LEAD_AUDITOR can do this"
      )
    )
  })

  it("shows the loading state while the query is in flight", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<ThreeLinesOfDefensePage />)

    expect(
      screen.getByText("organization.threeLinesOfDefense.loading")
    ).toBeInTheDocument()
  })

  it("shows empty-state text for a line with no items", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData({ risks: [], kris: [], complianceObligations: [] }),
      isLoading: false,
    })

    render(<ThreeLinesOfDefensePage />)

    // FIRST line now has no risks -- empty label should appear at least once.
    expect(
      screen.getAllByText("organization.threeLinesOfDefense.empty").length
    ).toBeGreaterThan(0)
  })
})
