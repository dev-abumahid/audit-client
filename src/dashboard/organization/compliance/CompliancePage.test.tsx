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
})
