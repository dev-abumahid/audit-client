import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CompliancePage from "./CompliancePage"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockUseGetAllComplianceQuery = vi.fn()
const mockUseGetComplianceScorecardQuery = vi.fn()
const mockCreateCompliance = vi.fn()
const mockUpdateCompliance = vi.fn()
const mockDeleteCompliance = vi.fn()

vi.mock("@/redux/apis/organization/compliance.api", () => ({
  useGetAllComplianceQuery: (...args: unknown[]) =>
    mockUseGetAllComplianceQuery(...args),
  useGetComplianceByIdQuery: () => ({ data: undefined }),
  useGetComplianceScorecardQuery: (...args: unknown[]) =>
    mockUseGetComplianceScorecardQuery(...args),
  useCreateComplianceMutation: () => [mockCreateCompliance, { isLoading: false }],
  useUpdateComplianceMutation: () => [mockUpdateCompliance, { isLoading: false }],
  useDeleteComplianceMutation: () => [mockDeleteCompliance],
}))

const mockUseGetAllSitesQuery = vi.fn()
vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) => mockUseGetAllSitesQuery(...args),
}))

// The reused Action-creation modal (#166) pulls in its own RTK Query hooks
// (findings/inspection/org-users/upload) that this suite doesn't wrap in a
// store — mock it and capture the props it's opened with, the same pattern
// AllFindingsPage.test uses.
const mockCreateActionModal = vi.fn()
vi.mock("@/dashboard/organization/findings/CreateNewFindingModal", () => ({
  default: (props: {
    open: boolean
    additionalData?: { complianceObligationId?: string; actionTitle?: string }
  }) => {
    mockCreateActionModal(props)
    return props.open ? (
      <div data-testid="create-action-modal">
        {props.additionalData?.actionTitle}
      </div>
    ) : null
  },
}))

// The Title label isn't associated with its input via htmlFor, so locate it
// through the label's wrapping <div>. In the test env i18n is not initialized,
// so t() echoes raw keys (same convention as RiskRegisterPage.test).
function titleInput(): HTMLInputElement {
  const label = screen.getByText(/organization\.compliance\.form\.title/)
  return label.parentElement!.querySelector("input")!
}

function makeObligation(overrides = {}) {
  return {
    id: "comp-1",
    org_account_id: "org-a",
    site_id: null,
    title: "GDPR Article 30 records",
    description: "Maintain records of processing activities",
    domain: "data_protection",
    status: "in_progress",
    owner: "Jane Doe",
    due_date: "2026-12-31T00:00:00.000Z",
    attachments: [],
    ai_generated: false,
    is_edited: true,
    createdAt: "2026-02-20T10:00:00.000Z",
    updatedAt: "2026-03-10T12:00:00.000Z",
    ...overrides,
  }
}

const emptyScorecard = {
  overall: { compliant: 0, total: 0, ratio: 0, band: "none" as const },
  byDomain: [],
  bySite: [],
  matrix: [],
}

describe("CompliancePage", () => {
  beforeEach(() => {
    mockUseGetAllComplianceQuery.mockReset()
    mockUseGetComplianceScorecardQuery.mockReset()
    mockCreateCompliance.mockReset()
    mockUpdateCompliance.mockReset()
    mockDeleteCompliance.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockCreateActionModal.mockReset()
    // Sensible defaults; individual tests override the compliance query.
    mockUseGetComplianceScorecardQuery.mockReturnValue({
      data: { data: emptyScorecard },
    })
    mockUseGetAllSitesQuery.mockReturnValue({ data: { data: [] } })
  })

  it("shows a loading spinner while the query is loading", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    const { container } = render(<CompliancePage />)

    expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    expect(
      screen.queryByText("organization.compliance.empty")
    ).not.toBeInTheDocument()
  })

  it("renders obligation rows from the query with title and domain", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    render(<CompliancePage />)

    expect(screen.getByText("GDPR Article 30 records")).toBeInTheDocument()
    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    // Domain label is echoed as its raw i18n key in the test environment.
    expect(
      within(row).getByText("organization.compliance.domains.data_protection")
    ).toBeInTheDocument()
  })

  it("shows the empty state when there are no obligations", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    render(<CompliancePage />)

    expect(
      screen.getByText("organization.compliance.empty")
    ).toBeInTheDocument()
  })

  it("renders the scorecard overall percentage and a matrix cell", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation({ status: "compliant" })] },
      isLoading: false,
    })
    mockUseGetComplianceScorecardQuery.mockReturnValue({
      data: {
        data: {
          overall: { compliant: 1, total: 2, ratio: 0.5, band: "red" },
          byDomain: [
            {
              domain: "data_protection",
              compliant: 1,
              total: 2,
              ratio: 0.5,
              band: "red",
            },
          ],
          bySite: [
            {
              site_id: null,
              site_name: null,
              compliant: 1,
              total: 2,
              ratio: 0.5,
              band: "red",
            },
          ],
          matrix: [
            {
              site_id: null,
              site_name: null,
              domain: "data_protection",
              compliant: 1,
              total: 2,
              ratio: 0.5,
              band: "red",
            },
          ],
        },
      },
    })

    render(<CompliancePage />)

    // Overall ratio 0.5 -> 50%
    expect(screen.getByText("50%")).toBeInTheDocument()
    // Matrix cell "1/2" for the org-wide row
    expect(screen.getByText("1/2")).toBeInTheDocument()
  })

  it("submits the create form and calls createCompliance with filled data", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockCreateCompliance.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "Obligation created" }),
    })

    render(<CompliancePage />)

    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.newObligation/i,
      })
    )
    await user.type(titleInput(), "New CCPA obligation")
    await user.click(
      screen.getByRole("button", {
        name: "organization.compliance.form.create",
      })
    )

    await waitFor(() => expect(mockCreateCompliance).toHaveBeenCalled())
    const submitted = mockCreateCompliance.mock.calls[0][0]
    expect(submitted).toMatchObject({
      title: "New CCPA obligation",
      domain: "data_protection",
      status: "in_progress",
      site_id: null,
    })
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("pre-fills the edit form and calls updateCompliance with is_edited on save", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })
    mockUpdateCompliance.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "Obligation updated" }),
    })

    render(<CompliancePage />)

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    // Within the row the actionable buttons are [edit, delete].
    await user.click(within(row).getAllByRole("button")[0])

    const input = titleInput()
    expect(input).toHaveValue("GDPR Article 30 records")

    await user.clear(input)
    await user.type(input, "GDPR Article 30 records EDITED")
    await user.click(
      screen.getByRole("button", {
        name: "organization.compliance.form.update",
      })
    )

    await waitFor(() => expect(mockUpdateCompliance).toHaveBeenCalled())
    const callArg = mockUpdateCompliance.mock.calls[0][0]
    expect(callArg.id).toBe("comp-1")
    expect(callArg.data).toMatchObject({
      title: "GDPR Article 30 records EDITED",
      is_edited: true,
    })
  })

  it("deletes an obligation after confirmation via the delete mutation", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })
    mockDeleteCompliance.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<CompliancePage />)

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    await user.click(within(row).getAllByRole("button")[1])

    await waitFor(() =>
      expect(mockDeleteCompliance).toHaveBeenCalledWith("comp-1")
    )
    expect(mockToastSuccess).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it("does not call the delete mutation when confirmation is cancelled", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    render(<CompliancePage />)

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    await user.click(within(row).getAllByRole("button")[1])

    expect(mockDeleteCompliance).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it("shows an error toast and keeps the modal open when create fails", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockCreateCompliance.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Server unavailable" } }),
    })

    render(<CompliancePage />)

    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.newObligation/i,
      })
    )
    await user.type(titleInput(), "Obligation that fails")
    await user.click(
      screen.getByRole("button", {
        name: "organization.compliance.form.create",
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server unavailable")
    )
    // Modal stays open on failure.
    expect(
      screen.getByText("organization.compliance.form.newTitle")
    ).toBeInTheDocument()
  })

  // ---- Pagination + server-side filtering (issue #161) ----

  it("requests page 1 with server-side filter params on first render", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    render(<CompliancePage />)

    const firstArgs = mockUseGetAllComplianceQuery.mock.calls[0][0]
    expect(firstArgs).toMatchObject({
      page: 1,
      limit: 20,
      searchTerm: "",
      // undefined (not "") when no filter is selected, so the query key stays
      // clean and the backend doesn't receive an empty filter param.
      status: undefined,
      domain: undefined,
    })
  })

  it("does not render pagination controls when there is only one page", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [makeObligation()],
        meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
      },
      isLoading: false,
    })

    render(<CompliancePage />)

    expect(
      screen.queryByLabelText("organization.compliance.pagination.next")
    ).not.toBeInTheDocument()
  })

  it("renders pagination controls and requests the next page when clicked", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [makeObligation()],
        meta: { page: 1, limit: 20, total: 45, totalPage: 3 },
      },
      isLoading: false,
    })

    render(<CompliancePage />)

    // Page buttons 1..3 are rendered.
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument()

    await user.click(
      screen.getByLabelText("organization.compliance.pagination.next")
    )

    const lastArgs =
      mockUseGetAllComplianceQuery.mock.calls[
        mockUseGetAllComplianceQuery.mock.calls.length - 1
      ][0]
    expect(lastArgs.page).toBe(2)
  })

  it("passes the selected domain filter to the query and resets to page 1", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [makeObligation()],
        meta: { page: 1, limit: 20, total: 45, totalPage: 3 },
      },
      isLoading: false,
    })

    render(<CompliancePage />)

    // Advance to page 2 first, then change a filter — page must reset to 1.
    await user.click(
      screen.getByLabelText("organization.compliance.pagination.next")
    )

    // The domain <select> is the first combobox in the filter bar.
    const domainSelect = screen.getAllByRole("combobox")[0]
    await user.selectOptions(domainSelect, "financial")

    const lastArgs =
      mockUseGetAllComplianceQuery.mock.calls[
        mockUseGetAllComplianceQuery.mock.calls.length - 1
      ][0]
    expect(lastArgs).toMatchObject({ domain: "financial", page: 1 })
  })

  it("drives the summary count cards from scorecard statusCounts, not the page", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      // Only one row on this page, but the org has many more.
      data: {
        data: [makeObligation({ status: "in_progress" })],
        meta: { page: 1, limit: 20, total: 60, totalPage: 3 },
      },
      isLoading: false,
    })
    mockUseGetComplianceScorecardQuery.mockReturnValue({
      data: {
        data: {
          ...emptyScorecard,
          overall: { compliant: 40, total: 60, ratio: 0.67, band: "red" },
          statusCounts: { compliant: 40, non_compliant: 9, in_progress: 11 },
        },
      },
    })

    render(<CompliancePage />)

    // Whole-org compliant (40) and non-compliant (9) counts, not the single
    // in_progress row on the current page.
    expect(screen.getByText("40")).toBeInTheDocument()
    expect(screen.getByText("9")).toBeInTheDocument()
  })

  // ── Create Action from a non-compliant obligation (#166) ──────────────────

  it("shows a Create Action button ONLY on non-compliant rows", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-fail",
            title: "Failing obligation",
            status: "non_compliant",
          }),
          makeObligation({
            id: "comp-ok",
            title: "Passing obligation",
            status: "compliant",
          }),
          makeObligation({
            id: "comp-wip",
            title: "In-progress obligation",
            status: "in_progress",
          }),
          makeObligation({
            id: "comp-na",
            title: "Not-applicable obligation",
            status: "not_applicable",
          }),
        ],
      },
      isLoading: false,
    })

    render(<CompliancePage />)

    const failRow = screen.getByText("Failing obligation").closest("tr")!
    const okRow = screen.getByText("Passing obligation").closest("tr")!
    const wipRow = screen.getByText("In-progress obligation").closest("tr")!
    const naRow = screen.getByText("Not-applicable obligation").closest("tr")!

    // Only the non-compliant row exposes the remediation affordance.
    expect(
      within(failRow).getByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).toBeInTheDocument()
    expect(
      within(okRow).queryByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).not.toBeInTheDocument()
    expect(
      within(wipRow).queryByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).not.toBeInTheDocument()
    expect(
      within(naRow).queryByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).not.toBeInTheDocument()
  })

  it("pre-fills a description that references the obligation even when it has no description", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-nodesc",
            title: "Undocumented control",
            description: undefined,
            status: "non_compliant",
          }),
        ],
      },
      isLoading: false,
    })

    render(<CompliancePage />)

    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    )

    const props = mockCreateActionModal.mock.calls.at(-1)![0]
    expect(props.additionalData.complianceObligationId).toBe("comp-nodesc")
    // Fallback branch (no description) still names the obligation and never
    // interpolates a literal "undefined".
    expect(props.additionalData.actionDisc).toContain("Undocumented control")
    expect(props.additionalData.actionDisc).not.toContain("undefined")
  })

  it("opens the reused Action modal pre-filled with a Remediate title and the obligation's complianceObligationId", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-77",
            title: "GDPR Article 30 records",
            description: "Maintain records of processing activities",
            status: "non_compliant",
          }),
        ],
      },
      isLoading: false,
    })

    render(<CompliancePage />)

    // Modal is not mounted until the button is clicked.
    expect(
      screen.queryByTestId("create-action-modal")
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    )

    expect(screen.getByTestId("create-action-modal")).toBeInTheDocument()
    const props = mockCreateActionModal.mock.calls.at(-1)![0]
    expect(props.open).toBe(true)
    // The real relation the backend (aexa-server#226) links on save.
    expect(props.additionalData.complianceObligationId).toBe("comp-77")
    // Pre-filled title references the obligation.
    expect(props.additionalData.actionTitle).toBe(
      "Remediate: GDPR Article 30 records"
    )
    // Description references the failing obligation too.
    expect(props.additionalData.actionDisc).toContain(
      "GDPR Article 30 records"
    )
  })
})
