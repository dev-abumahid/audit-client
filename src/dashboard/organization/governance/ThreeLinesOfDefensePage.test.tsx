import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ThreeLinesOfDefensePage from "./ThreeLinesOfDefensePage"

// This file never triggers src/i18n/i18n.ts's side-effect init, so
// react-i18next's real t() falls back to returning the raw key with no
// interpolation for every other assertion here. That fallback can't
// reproduce the humanized-label bug (raw backend enum/domain values like
// "cyber", "non_compliant", "TO_DO" rendered directly instead of going
// through a label map + t()), since there'd be no way to tell "the key was
// resolved to a humanized string" apart from "the raw value was rendered
// unchanged" without real translations loaded. Overriding just the specific
// keys the meta-line label maps resolve to, with plausible humanized English,
// lets the tests confirm the humanized label (not the raw enum) actually
// renders -- every other key still falls back to itself unchanged. Same
// technique as CompliancePage.test.tsx.
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  const HUMANIZED: Record<string, string> = {
    "organization.riskCategories.catCyber": "Cyber",
    "organization.riskRegister.statusOpen": "Open",
    "organization.findings.priorityHigh": "High",
    "organization.findings.statusToDo": "To Do",
    "organization.kri.status.ok": "OK",
    "organization.compliance.domains.data_protection": "Data Protection",
    "organization.compliance.status.non_compliant": "Non-Compliant",
    "organization.audit.statusPlanned": "Planned",
  }
  return {
    ...mod,
    useTranslation: () => ({
      t: (key: string) => HUMANIZED[key] ?? key,
    }),
  }
})

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

  // aexa-frontend#465 -- the page previously had only one <h1> then jumped
  // straight to <h4> (CardTitle rendered a plain div, not a heading, so it
  // never filled the h2/h3 gap). Assert the full heading level sequence is
  // contiguous (no skipped levels) rather than just that headings exist.
  it("has a contiguous heading hierarchy with no skipped levels", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    render(<ThreeLinesOfDefensePage />)

    const levels = screen
      .getAllByRole("heading")
      .map((el) => Number(el.tagName[1]))

    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
    // Sanity check the fix actually introduced h2s and h3s, not just that
    // nothing skips (a page with only an h1 would trivially pass the loop
    // above).
    expect(levels).toContain(2)
    expect(levels).toContain(3)
  })

  it("gives each truncated item title a hover tooltip via the title attribute", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    render(<ThreeLinesOfDefensePage />)

    const title = screen.getByText("Supply chain disruption")
    expect(title).toHaveAttribute("title", "Supply chain disruption")
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

  // aexa-server#208 / aexa-frontend#209: GOVERNING_BODY column + the
  // per-entity-type permission split (Risk/Kri/Compliance now require ADMIN
  // specifically; AuditEngagement now requires LEAD_AUDITOR specifically;
  // Action is unchanged).
  describe("GOVERNING_BODY column (#209)", () => {
    it("renders a 4th Governing Body column alongside the original three", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      render(<ThreeLinesOfDefensePage />)

      expect(
        screen.getByText("organization.threeLinesOfDefense.lines.governingBody")
      ).toBeInTheDocument()
    })

    it("offers Move to Governing Body as a reassignment option for an ADMIN", () => {
      mockRole = "ADMIN"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      render(<ThreeLinesOfDefensePage />)

      expect(
        screen.getAllByRole("button", {
          name: "organization.threeLinesOfDefense.moveToGoverningBody",
        }).length
      ).toBeGreaterThan(0)
    })

    it("reassigns a risk to GOVERNING_BODY", async () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockUpdateRisk.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      render(<ThreeLinesOfDefensePage />)

      const moveButtons = screen.getAllByRole("button", {
        name: "organization.threeLinesOfDefense.moveToGoverningBody",
      })
      await userEvent.click(moveButtons[0])

      await waitFor(() =>
        expect(mockUpdateRisk).toHaveBeenCalledWith({
          id: "risk-1",
          data: { line_of_defense: "GOVERNING_BODY" },
        })
      )
    })
  })

  describe("per-entity-type reassignment permissions (#208)", () => {
    it("ADMIN can reassign Risk/Kri/Compliance (management line)", () => {
      mockRole = "ADMIN"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      render(<ThreeLinesOfDefensePage />)

      const riskRow = screen.getByText("Supply chain disruption").closest("div")!
        .parentElement!
      const kriRow = screen.getByText("Supplier Lead Time").closest("div")!
        .parentElement!
      const complianceRow = screen.getByText("GDPR data mapping").closest("div")!
        .parentElement!
      expect(riskRow.querySelector("button")).toBeInTheDocument()
      expect(kriRow.querySelector("button")).toBeInTheDocument()
      expect(complianceRow.querySelector("button")).toBeInTheDocument()
    })

    it("LEAD_AUDITOR cannot reassign Risk/Kri/Compliance (management line requires ADMIN specifically)", () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      render(<ThreeLinesOfDefensePage />)

      const riskRow = screen.getByText("Supply chain disruption").closest("div")!
        .parentElement!
      const kriRow = screen.getByText("Supplier Lead Time").closest("div")!
        .parentElement!
      const complianceRow = screen.getByText("GDPR data mapping").closest("div")!
        .parentElement!
      expect(riskRow.querySelector("button")).not.toBeInTheDocument()
      expect(kriRow.querySelector("button")).not.toBeInTheDocument()
      expect(complianceRow.querySelector("button")).not.toBeInTheDocument()
    })

    it("LEAD_AUDITOR CAN reassign an AuditEngagement (audit line)", () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      render(<ThreeLinesOfDefensePage />)

      const auditRow = screen.getByText("Q3 internal audit").closest("div")!
        .parentElement!
      expect(auditRow.querySelector("button")).toBeInTheDocument()
    })

    it("ADMIN cannot reassign an AuditEngagement (audit line requires LEAD_AUDITOR specifically)", () => {
      mockRole = "ADMIN"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      render(<ThreeLinesOfDefensePage />)

      const auditRow = screen.getByText("Q3 internal audit").closest("div")!
        .parentElement!
      expect(auditRow.querySelector("button")).not.toBeInTheDocument()
    })

    it("both ADMIN and LEAD_AUDITOR can reassign an Action (unchanged)", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      mockRole = "ADMIN"
      const { unmount } = render(<ThreeLinesOfDefensePage />)
      let actionRow = screen.getByText("Patch critical vulnerability").closest("div")!
        .parentElement!
      expect(actionRow.querySelector("button")).toBeInTheDocument()
      unmount()

      mockRole = "LEAD_AUDITOR"
      render(<ThreeLinesOfDefensePage />)
      actionRow = screen.getByText("Patch critical vulnerability").closest("div")!
        .parentElement!
      expect(actionRow.querySelector("button")).toBeInTheDocument()
    })

    it("does not attempt updateCompliance when a LEAD_AUDITOR has no button to click (server 403 avoided client-side)", () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      render(<ThreeLinesOfDefensePage />)

      expect(mockUpdateCompliance).not.toHaveBeenCalled()
      const complianceRow = screen.getByText("GDPR data mapping").closest("div")!
        .parentElement!
      expect(complianceRow.querySelector("button")).toBeNull()
    })
  })

  // Regression: risk.category/status, action.priority/status, kri.status,
  // obligation.domain/status and engagement.status used to be interpolated
  // directly into the meta line with no label mapping, rendering raw
  // backend enum values like "cyber · open" or "data_protection ·
  // non_compliant" instead of humanized labels.
  it("shows humanized labels in the meta line, not raw backend enum/domain values", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData({
        risks: [
          {
            id: "risk-1",
            title: "Supply chain disruption",
            category: "cyber",
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
            priority: "High",
            status: "TO_DO",
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
            status: "non_compliant",
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
      }),
      isLoading: false,
    })

    render(<ThreeLinesOfDefensePage />)

    expect(screen.getByText("Cyber · Open")).toBeInTheDocument()
    // Classified (2nd Line) and Unclassified Actions sections render through
    // two separate ItemRow call sites in the source -- both must be fixed.
    expect(screen.getAllByText("High · To Do").length).toBe(2)
    expect(screen.getByText("days · OK")).toBeInTheDocument()
    expect(screen.getByText("Data Protection · Non-Compliant")).toBeInTheDocument()
    expect(screen.getByText("Jane Doe · Planned")).toBeInTheDocument()

    // None of the raw backend values should leak through unhumanized.
    expect(screen.queryByText(/cyber · open/)).not.toBeInTheDocument()
    expect(screen.queryByText(/TO_DO/)).not.toBeInTheDocument()
    expect(screen.queryByText(/non_compliant/)).not.toBeInTheDocument()
    expect(screen.queryByText(/data_protection ·/)).not.toBeInTheDocument()
  })

  // aexa-frontend round-4 audit bug #334: a failed query used to render
  // identically to a genuinely empty board -- no isError/error handling.
  it("shows an error state with a retry button when the query fails, and refetches on click", async () => {
    const mockRefetch = vi.fn()
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    })

    render(<ThreeLinesOfDefensePage />)

    expect(
      screen.getByText("organization.threeLinesOfDefense.loadFailed")
    ).toBeInTheDocument()
    // The genuinely-empty-board copy must not also render.
    expect(
      screen.queryByText("organization.threeLinesOfDefense.empty")
    ).not.toBeInTheDocument()
    await waitFor(() => expect(mockToastError).toHaveBeenCalled())

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.threeLinesOfDefense.retry",
      })
    )
    expect(mockRefetch).toHaveBeenCalled()
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
