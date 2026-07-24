import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AuditPage from "./AuditPage"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockUseGetAllAuditEngagementsQuery = vi.fn()
const mockCreateAuditEngagement = vi.fn()
const mockUpdateAuditEngagement = vi.fn()
const mockDeleteAuditEngagement = vi.fn()

vi.mock("@/redux/apis/organization/audit.api", () => ({
  useGetAllAuditEngagementsQuery: (...args: unknown[]) =>
    mockUseGetAllAuditEngagementsQuery(...args),
  useGetAuditEngagementByIdQuery: () => ({ data: undefined }),
  useCreateAuditEngagementMutation: () => [
    mockCreateAuditEngagement,
    { isLoading: false },
  ],
  useUpdateAuditEngagementMutation: () => [
    mockUpdateAuditEngagement,
    { isLoading: false },
  ],
  useDeleteAuditEngagementMutation: () => [mockDeleteAuditEngagement],
}))

// The Title label isn't associated with its input via htmlFor, so locate it
// through the label's wrapping <div>.
function titleInput(): HTMLInputElement {
  const label = screen.getByText("Title")
  return label.parentElement!.querySelector("input")!
}

function makeEngagement(overrides = {}) {
  return {
    id: "audit-1",
    org_account_id: "org-a",
    ref: "AUD-001",
    title: "Supply Chain Risk Audit",
    scope: "Review of supplier dependencies",
    status: "in_progress",
    lead_auditor: "John Doe",
    priority_score: 85,
    findings_count: 3,
    started_at: "2026-03-01T09:00:00.000Z",
    closed_at: null,
    ai_generated: false,
    is_edited: true,
    linked_risk_refs: ["RISK-001"],
    report_url: null,
    createdAt: "2026-02-20T10:00:00.000Z",
    updatedAt: "2026-03-10T12:00:00.000Z",
    ...overrides,
  }
}

describe("AuditPage", () => {
  beforeEach(() => {
    mockUseGetAllAuditEngagementsQuery.mockReset()
    mockCreateAuditEngagement.mockReset()
    mockUpdateAuditEngagement.mockReset()
    mockDeleteAuditEngagement.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
  })

  it("shows a loading spinner while the query is loading", () => {
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    const { container } = render(<AuditPage />)

    expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    expect(
      screen.queryByText("No audit engagements found")
    ).not.toBeInTheDocument()
  })

  it("renders engagement rows from the query with ref, title and status", () => {
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [makeEngagement()] },
      isLoading: false,
    })

    render(<AuditPage />)

    expect(screen.getByText("Supply Chain Risk Audit")).toBeInTheDocument()
    expect(screen.getByText("AUD-001")).toBeInTheDocument()
    // "In Progress" appears both as the card's status badge and the summary
    // stats label, so assert the status badge inside the card specifically.
    const card = screen
      .getByText("Supply Chain Risk Audit")
      .closest("[class*='rounded-xl']")! as HTMLElement
    expect(within(card).getByText("In Progress")).toBeInTheDocument()
  })

  it("shows the empty state when there are no engagements", () => {
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    render(<AuditPage />)

    expect(screen.getByText("No audit engagements found")).toBeInTheDocument()
  })

  it("submits the create form and calls createAuditEngagement with filled data", async () => {
    const user = userEvent.setup()
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockCreateAuditEngagement.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "Audit engagement created" }),
    })

    render(<AuditPage />)

    await user.click(screen.getByRole("button", { name: /New Audit Mission/i }))
    await user.type(screen.getByPlaceholderText("AUD-2026-001"), "AUD-2026-999")
    await user.type(titleInput(), "ZZZ Unique Audit Mission XYZ")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => expect(mockCreateAuditEngagement).toHaveBeenCalled())
    const submitted = mockCreateAuditEngagement.mock.calls[0][0]
    expect(submitted).toMatchObject({
      ref: "AUD-2026-999",
      title: "ZZZ Unique Audit Mission XYZ",
      status: "planned",
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("Audit engagement created")
  })

  it("pre-fills the edit form and calls updateAuditEngagement on save", async () => {
    const user = userEvent.setup()
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [makeEngagement()] },
      isLoading: false,
    })
    mockUpdateAuditEngagement.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "Audit engagement updated" }),
    })

    render(<AuditPage />)

    const card = screen
      .getByText("Supply Chain Risk Audit")
      .closest("[class*='rounded-xl']")! as HTMLElement
    // Within the card the actionable buttons are [edit, delete]; the Upload
    // Report control is a <label>, not a button.
    await user.click(within(card).getAllByRole("button")[0])

    // Edit form is pre-filled with the existing title.
    const input = titleInput()
    expect(input).toHaveValue("Supply Chain Risk Audit")

    await user.clear(input)
    await user.type(input, "Supply Chain Risk Audit EDITED")
    await user.click(screen.getByRole("button", { name: "Update" }))

    await waitFor(() => expect(mockUpdateAuditEngagement).toHaveBeenCalled())
    const callArg = mockUpdateAuditEngagement.mock.calls[0][0]
    expect(callArg.id).toBe("audit-1")
    expect(callArg.data).toMatchObject({
      title: "Supply Chain Risk Audit EDITED",
      is_edited: true,
    })
  })

  it("deletes an engagement after confirmation via the delete mutation", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [makeEngagement()] },
      isLoading: false,
    })
    mockDeleteAuditEngagement.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<AuditPage />)

    const card = screen
      .getByText("Supply Chain Risk Audit")
      .closest("[class*='rounded-xl']")! as HTMLElement
    await user.click(within(card).getAllByRole("button")[1])

    await waitFor(() =>
      expect(mockDeleteAuditEngagement).toHaveBeenCalledWith("audit-1")
    )
    expect(mockToastSuccess).toHaveBeenCalledWith("Audit engagement deleted")
    confirmSpy.mockRestore()
  })

  it("does not call the delete mutation when confirmation is cancelled", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [makeEngagement()] },
      isLoading: false,
    })

    render(<AuditPage />)

    const card = screen
      .getByText("Supply Chain Risk Audit")
      .closest("[class*='rounded-xl']")! as HTMLElement
    await user.click(within(card).getAllByRole("button")[1])

    expect(mockDeleteAuditEngagement).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it("shows an error toast and keeps the modal open when create fails", async () => {
    const user = userEvent.setup()
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockCreateAuditEngagement.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Server unavailable" } }),
    })

    render(<AuditPage />)

    await user.click(screen.getByRole("button", { name: /New Audit Mission/i }))
    await user.type(titleInput(), "Audit that fails to save")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server unavailable")
    )
    // Modal stays open on failure.
    expect(screen.getByText("New Audit Engagement")).toBeInTheDocument()
  })
})
