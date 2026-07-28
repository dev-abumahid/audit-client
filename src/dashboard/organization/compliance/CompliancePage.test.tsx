import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CompliancePage from "./CompliancePage"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// aexa-frontend#217 -- role hook mocked per-test via this mutable holder,
// same convention as RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockUseGetAllComplianceQuery = vi.fn()
const mockUseGetComplianceScorecardQuery = vi.fn()
const mockCreateCompliance = vi.fn()
const mockUpdateCompliance = vi.fn()
const mockDeleteCompliance = vi.fn()
const mockAttestCompliance = vi.fn()
const mockUseGetComplianceAttestationsQuery = vi.fn()

vi.mock("@/redux/apis/organization/compliance.api", () => ({
  useGetAllComplianceQuery: (...args: unknown[]) =>
    mockUseGetAllComplianceQuery(...args),
  useGetComplianceByIdQuery: () => ({ data: undefined }),
  useGetComplianceScorecardQuery: (...args: unknown[]) =>
    mockUseGetComplianceScorecardQuery(...args),
  useCreateComplianceMutation: () => [mockCreateCompliance, { isLoading: false }],
  useUpdateComplianceMutation: () => [mockUpdateCompliance, { isLoading: false }],
  useDeleteComplianceMutation: () => [mockDeleteCompliance],
  useAttestComplianceMutation: () => [mockAttestCompliance, { isLoading: false }],
  useGetComplianceAttestationsQuery: (...args: unknown[]) =>
    mockUseGetComplianceAttestationsQuery(...args),
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
    line_of_defense: "SECOND",
    regulation_reference: null,
    recurrence: null,
    next_review_date: null,
    overdue: false,
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
    mockRole = "ADMIN"
    mockUseGetAllComplianceQuery.mockReset()
    mockUseGetComplianceScorecardQuery.mockReset()
    mockCreateCompliance.mockReset()
    mockUpdateCompliance.mockReset()
    mockDeleteCompliance.mockReset()
    mockAttestCompliance.mockReset()
    mockUseGetComplianceAttestationsQuery.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockCreateActionModal.mockReset()
    // Sensible defaults; individual tests override the compliance query.
    mockUseGetComplianceScorecardQuery.mockReturnValue({
      data: { data: emptyScorecard },
    })
    mockUseGetAllSitesQuery.mockReturnValue({ data: { data: [] } })
    mockUseGetComplianceAttestationsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
  })

  it("shows New Obligation, Edit, Attest and Delete for an ADMIN", () => {
    mockRole = "ADMIN"
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    render(<CompliancePage />)

    expect(
      screen.getByText("organization.compliance.newObligation")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.compliance.attest.button")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.compliance.attest.historyButton")
    ).toBeInTheDocument()
  })

  it("hides New Obligation, Edit, Attest and Delete for a VIEWER but keeps History", () => {
    mockRole = "VIEWER"
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    render(<CompliancePage />)

    expect(
      screen.queryByText("organization.compliance.newObligation")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("organization.compliance.attest.button")
    ).not.toBeInTheDocument()
    // History (read-only) stays visible regardless of role.
    expect(
      screen.getByLabelText("organization.compliance.attest.historyButton")
    ).toBeInTheDocument()
  })

  it("hides write controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    render(<CompliancePage />)

    expect(
      screen.queryByText("organization.compliance.newObligation")
    ).not.toBeInTheDocument()
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
    await user.click(within(row).getAllByRole("button")[3])

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
    await user.click(within(row).getAllByRole("button")[3])

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

  // aexa-frontend#265: the delete-path counterpart to #234/#243 (this file's
  // own handleSearchChange/handleDomainChange/handleStatusChange reset page
  // on a filter change, but nothing resets it when a delete alone shrinks
  // totalPages).
  it("aexa-frontend#265: clamps the page back into range after deleting the last obligation on the last page", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [makeObligation()],
        meta: { page: 1, limit: 20, total: 45, totalPage: 3 },
      },
      isLoading: false,
    })
    mockDeleteCompliance.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    const { rerender } = render(<CompliancePage />)

    await user.click(
      screen.getByLabelText("organization.compliance.pagination.next")
    )
    await user.click(
      screen.getByLabelText("organization.compliance.pagination.next")
    )

    let lastArgs =
      mockUseGetAllComplianceQuery.mock.calls[
        mockUseGetAllComplianceQuery.mock.calls.length - 1
      ][0]
    expect(lastArgs.page).toBe(3)

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    await user.click(within(row).getAllByRole("button")[3])

    await waitFor(() =>
      expect(mockDeleteCompliance).toHaveBeenCalledWith("comp-1")
    )

    // Deleting the last obligation on page 3 drops total to 25 -> totalPage
    // 2, stranding page 3 out of range. Unlike the other 5 list pages,
    // CompliancePage's handleDelete has no local setState on success -- in
    // the real app the re-render comes from RTK Query's own cache
    // subscription reacting to the invalidated list query, which this
    // fully-mocked hook can't reproduce on its own, so the refreshed
    // (smaller) result is applied via an explicit rerender here, standing in
    // for that cache-driven re-render.
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [],
        meta: { page: 3, limit: 20, total: 25, totalPage: 2 },
      },
      isLoading: false,
    })
    rerender(<CompliancePage />)

    await waitFor(() => {
      lastArgs =
        mockUseGetAllComplianceQuery.mock.calls[
          mockUseGetAllComplianceQuery.mock.calls.length - 1
        ][0]
      expect(lastArgs.page).toBe(2)
    })

    confirmSpy.mockRestore()
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

  it("hides the Create Action button on a non-compliant row for a VIEWER", () => {
    mockRole = "VIEWER"
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-fail",
            title: "Failing obligation",
            status: "non_compliant",
          }),
        ],
      },
      isLoading: false,
    })

    render(<CompliancePage />)

    expect(
      screen.queryByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).not.toBeInTheDocument()
  })

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

  // aexa-server#250 / aexa-frontend#212
  describe("recurrence, regulation reference, and re-attestation", () => {
    it("submits regulation_reference and recurrence on create", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockCreateCompliance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      render(<CompliancePage />)

      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )
      await user.type(titleInput(), "SOX annual filing")

      const regInput = screen
        .getByText("organization.compliance.form.regulationReference")
        .parentElement!.querySelector("input")!
      await user.type(regInput, "SOX Section 404")

      const recurrenceSelect = screen
        .getByText("organization.compliance.form.recurrence")
        .parentElement!.querySelector("select")!
      await user.selectOptions(recurrenceSelect, "annual")

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.form.create",
        })
      )

      await waitFor(() => expect(mockCreateCompliance).toHaveBeenCalled())
      const submitted = mockCreateCompliance.mock.calls[0][0]
      expect(submitted.regulation_reference).toBe("SOX Section 404")
      expect(submitted.recurrence).toBe("annual")
    })

    it("sends null recurrence for the default one-time option", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockCreateCompliance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      render(<CompliancePage />)

      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )
      await user.type(titleInput(), "One-time obligation")
      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.form.create",
        })
      )

      await waitFor(() => expect(mockCreateCompliance).toHaveBeenCalled())
      const submitted = mockCreateCompliance.mock.calls[0][0]
      expect(submitted.recurrence).toBeNull()
      expect(submitted.regulation_reference).toBeNull()
    })

    it("pre-fills regulation_reference and recurrence on edit, and shows next_review_date read-only", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              regulation_reference: "GDPR Art. 30(1)",
              recurrence: "annual",
              next_review_date: "2027-01-15T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })

      render(<CompliancePage />)

      const row = screen.getByText("GDPR Article 30 records").closest("tr")!
      await user.click(within(row).getAllByRole("button")[0])

      const regInput = screen
        .getByText("organization.compliance.form.regulationReference")
        .parentElement!.querySelector("input")!
      expect(regInput).toHaveValue("GDPR Art. 30(1)")

      const recurrenceSelect = screen
        .getByText("organization.compliance.form.recurrence")
        .parentElement!.querySelector("select")!
      expect(recurrenceSelect).toHaveValue("annual")

      expect(
        screen.getByText(/organization\.compliance\.form\.nextReview/)
      ).toBeInTheDocument()
    })

    it("shows an overdue badge driven by the server-computed overdue flag, not a client-side due_date check", () => {
      // due_date is in the future, but the server says overdue anyway (e.g. a
      // recurring obligation whose next_review_date has lapsed) -- if the
      // component still re-derived this from due_date alone, this would fail.
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              due_date: "2099-01-01T00:00:00.000Z",
              overdue: true,
            }),
          ],
        },
        isLoading: false,
      })

      render(<CompliancePage />)

      expect(
        screen.getByText("organization.compliance.overdueLabel")
      ).toBeInTheDocument()
    })

    it("does not show the overdue badge when overdue is false, even with a past due_date", () => {
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              due_date: "2020-01-01T00:00:00.000Z",
              overdue: false,
            }),
          ],
        },
        isLoading: false,
      })

      render(<CompliancePage />)

      expect(
        screen.queryByText("organization.compliance.overdueLabel")
      ).not.toBeInTheDocument()
    })

    it("shows the evidence-required warning when status is compliant with no attachments", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      render(<CompliancePage />)

      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )

      expect(
        screen.queryByText(
          "organization.compliance.form.evidenceRequiredWarning"
        )
      ).not.toBeInTheDocument()

      const statusSelect = screen
        .getByText("organization.compliance.form.status")
        .parentElement!.querySelector("select")!
      await user.selectOptions(statusSelect, "compliant")

      expect(
        screen.getByText(
          "organization.compliance.form.evidenceRequiredWarning"
        )
      ).toBeInTheDocument()
    })

    it("opens the re-attest modal and calls attestCompliance with a trimmed note", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockAttestCompliance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      render(<CompliancePage />)

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.button",
        })
      )
      const noteInput = screen.getByPlaceholderText(
        "organization.compliance.attest.notePlaceholder"
      )
      await user.type(noteInput, "  Confirmed with legal  ")
      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.confirmButton",
        })
      )

      await waitFor(() =>
        expect(mockAttestCompliance).toHaveBeenCalledWith({
          id: "comp-1",
          note: "Confirmed with legal",
        })
      )
      expect(mockToastSuccess).toHaveBeenCalled()
    })

    it("sends undefined (not an empty string) for note when the re-attest modal is confirmed blank", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockAttestCompliance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      render(<CompliancePage />)

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.button",
        })
      )
      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.confirmButton",
        })
      )

      await waitFor(() =>
        expect(mockAttestCompliance).toHaveBeenCalledWith({
          id: "comp-1",
          note: undefined,
        })
      )
    })

    it("shows an error toast when attestCompliance fails", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockAttestCompliance.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: "Obligation not found" } }),
      })

      render(<CompliancePage />)

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.button",
        })
      )
      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.confirmButton",
        })
      )

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("Obligation not found")
      )
    })

    it("opens the attestation history modal and renders entries from the query", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockUseGetComplianceAttestationsQuery.mockReturnValue({
        data: {
          data: [
            {
              id: "att-1",
              org_account_id: "org-a",
              obligation_id: "comp-1",
              attested_by: "acct-9",
              attested_at: "2026-06-01T10:00:00.000Z",
              status_at_attestation: "compliant",
              note: "Confirmed with legal counsel",
              createdAt: "2026-06-01T10:00:00.000Z",
            },
          ],
        },
        isLoading: false,
      })

      render(<CompliancePage />)

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      expect(
        screen.getByText("Confirmed with legal counsel")
      ).toBeInTheDocument()
      // The query should be scoped to this specific obligation, not skipped.
      expect(mockUseGetComplianceAttestationsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ id: "comp-1" }),
        expect.objectContaining({ skip: false })
      )
    })

    it("shows the empty state in the history modal when there are no attestations", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })

      render(<CompliancePage />)

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      expect(
        screen.getByText("organization.compliance.attest.historyEmpty")
      ).toBeInTheDocument()
    })

    it("skips the attestations query until the history modal is opened", () => {
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })

      render(<CompliancePage />)

      expect(mockUseGetComplianceAttestationsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ id: "" }),
        expect.objectContaining({ skip: true })
      )
    })

    // Regression for a round-1 review finding: actionObligation/
    // attestObligation/historyObligation used to be independent state, so
    // opening one modal without dismissing another left the first one
    // stacked underneath, invisible but still mounted.
    it("closes the re-attest modal when the history modal is opened for a different row", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({ id: "comp-1", title: "GDPR Article 30 records" }),
            makeObligation({ id: "comp-2", title: "SOX annual filing" }),
          ],
        },
        isLoading: false,
      })

      render(<CompliancePage />)

      const rowA = screen.getByText("GDPR Article 30 records").closest("tr")!
      await user.click(
        within(rowA).getByRole("button", {
          name: "organization.compliance.attest.button",
        })
      )
      expect(
        screen.getByRole("button", {
          name: "organization.compliance.attest.confirmButton",
        })
      ).toBeInTheDocument()

      const rowB = screen.getByText("SOX annual filing").closest("tr")!
      await user.click(
        within(rowB).getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      // History modal (row B) is open...
      expect(
        screen.getByText("organization.compliance.attest.historyEmpty")
      ).toBeInTheDocument()
      // ...and the re-attest modal (row A) is gone, not just hidden behind it.
      expect(
        screen.queryByRole("button", {
          name: "organization.compliance.attest.confirmButton",
        })
      ).not.toBeInTheDocument()
    })
  })

  // aexa-frontend#244: due_date/next_review_date are date-only values -- the
  // backend's DATE columns serialize as UTC-midnight ISO strings (see
  // makeObligation's "...T00:00:00.000Z" fixtures above, matching the real
  // /api/compliance response shape). `new Date(obl.due_date).toLocaleDateString()`
  // parses that as a UTC instant but formats in the *local* timezone, which
  // rolls the displayed day back one for anyone at a negative UTC offset.
  // Same root cause as #238 (already fixed for the findings due-date
  // datetime-local input), different mechanism (date-only, not datetime).
  describe("due date / next review date rendering is timezone-safe (#244)", () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it("renders the correct calendar day for due_date and next_review_date at a negative UTC offset (west of UTC)", () => {
      // Pacific/Honolulu is UTC-10 with no DST -- deterministic year-round.
      // Under the bug, a UTC-midnight due_date would display one day early.
      vi.stubEnv("TZ", "Pacific/Honolulu")

      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              due_date: "2026-12-31T00:00:00.000Z",
              recurrence: "annual",
              next_review_date: "2027-06-15T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })

      render(<CompliancePage />)

      expect(screen.getByText("Dec 31, 2026")).toBeInTheDocument()
      expect(screen.getByText(/Jun 15, 2027/)).toBeInTheDocument()
    })

    it("renders the correct calendar day for due_date at a positive UTC offset (east of UTC)", () => {
      // IST, UTC+5:30 -- a positive offset wouldn't have shown the #244 bug
      // (it rolls the day *forward*, not backward), but it must still
      // render correctly, not just avoid the specific failure direction.
      vi.stubEnv("TZ", "Asia/Kolkata")

      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [makeObligation({ due_date: "2026-01-01T00:00:00.000Z" })],
        },
        isLoading: false,
      })

      render(<CompliancePage />)

      expect(screen.getByText("Jan 1, 2026")).toBeInTheDocument()
    })

    it("renders the correct calendar day in the edit form's derived next-review note at a negative UTC offset", async () => {
      const user = userEvent.setup()
      vi.stubEnv("TZ", "Pacific/Honolulu")

      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              recurrence: "annual",
              next_review_date: "2026-03-01T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })

      render(<CompliancePage />)

      const row = screen.getByText("GDPR Article 30 records").closest("tr")!
      await user.click(within(row).getAllByRole("button")[0])

      expect(
        screen.getByText(/organization\.compliance\.form\.nextReview/)
      ).toHaveTextContent("Mar 1, 2026")
    })

    it("still renders the correct calendar day for a next_review_date with a real, non-midnight time-of-day", () => {
      // aexa-server's attest_compliance_into_db recomputes next_review_date
      // from the actual attestation clock time, not midnight (see
      // dueDateInput.ts's comment) -- unlike due_date, this field genuinely
      // carries a non-zero time-of-day in production. formatDateOnlyForDisplay
      // still truncates to a single UTC calendar day rather than letting that
      // time-of-day leak into the display or interact with the local offset.
      vi.stubEnv("TZ", "Pacific/Honolulu")

      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              recurrence: "annual",
              next_review_date: "2027-03-01T23:50:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })

      render(<CompliancePage />)

      expect(screen.getByText(/Mar 1, 2027/)).toBeInTheDocument()
    })
  })
})
