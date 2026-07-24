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

  describe("report upload / download (issue #159)", () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it("uploads a report to /api/audit/attachment then PATCHes report_url", async () => {
      const user = userEvent.setup()
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: { data: [makeEngagement({ report_url: null })] },
        isLoading: false,
      })
      mockUpdateAuditEngagement.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ data: { url: "https://s3.example.com/r.pdf" } }),
      })
      vi.stubGlobal("fetch", fetchMock)

      const { container } = render(<AuditPage />)

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      const file = new File(["pdf"], "report.pdf", { type: "application/pdf" })
      await user.upload(fileInput, file)

      // 1) the file was POSTed to the real upload route
      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      const [url, opts] = fetchMock.mock.calls[0]
      expect(String(url)).toContain("/api/audit/attachment")
      expect((opts as RequestInit).method).toBe("POST")

      // 2) the returned URL was persisted onto the engagement via PATCH
      await waitFor(() =>
        expect(mockUpdateAuditEngagement).toHaveBeenCalledWith({
          id: "audit-1",
          data: { report_url: "https://s3.example.com/r.pdf" },
        })
      )
      expect(mockToastSuccess).toHaveBeenCalledWith("Report uploaded successfully")
    })

    it("shows an error toast and does not PATCH when the upload request fails", async () => {
      const user = userEvent.setup()
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: { data: [makeEngagement({ report_url: null })] },
        isLoading: false,
      })
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))

      const { container } = render(<AuditPage />)

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await user.upload(
        fileInput,
        new File(["pdf"], "report.pdf", { type: "application/pdf" })
      )

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("Failed to upload report")
      )
      expect(mockUpdateAuditEngagement).not.toHaveBeenCalled()
    })

    it("opens the real report URL in a new tab on download", async () => {
      const user = userEvent.setup()
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: {
          data: [
            makeEngagement({ report_url: "https://s3.example.com/final.pdf" }),
          ],
        },
        isLoading: false,
      })
      const openSpy = vi.fn()
      vi.stubGlobal("open", openSpy)

      render(<AuditPage />)

      await user.click(screen.getByRole("button", { name: /Report/i }))

      expect(openSpy).toHaveBeenCalledWith(
        "https://s3.example.com/final.pdf",
        "_blank",
        "noopener,noreferrer"
      )
    })
  })

  describe("search and pagination (issue #160)", () => {
    it("feeds the search box value into the query's searchTerm and resets to page 1", async () => {
      const user = userEvent.setup()
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: { data: [makeEngagement()], meta: { total: 1, totalPage: 1 } },
        isLoading: false,
      })

      render(<AuditPage />)

      const searchBox = screen.getByPlaceholderText(
        /Search by reference, title or lead auditor/i
      )
      await user.type(searchBox, "cyber")

      // The latest query call reflects the typed searchTerm and page 1.
      const lastCall =
        mockUseGetAllAuditEngagementsQuery.mock.calls[
          mockUseGetAllAuditEngagementsQuery.mock.calls.length - 1
        ][0]
      expect(lastCall).toMatchObject({ searchTerm: "cyber", page: 1 })
    })

    it("renders pagination controls and advances the page when Next is clicked", async () => {
      const user = userEvent.setup()
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: {
          data: [makeEngagement()],
          meta: { total: 45, totalPage: 3, page: 1, limit: 20 },
        },
        isLoading: false,
      })

      render(<AuditPage />)

      // Numbered page buttons are present (totalPage > 1).
      expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: /Next page/i }))

      const lastCall =
        mockUseGetAllAuditEngagementsQuery.mock.calls[
          mockUseGetAllAuditEngagementsQuery.mock.calls.length - 1
        ][0]
      expect(lastCall.page).toBe(2)
    })

    it("does not render pagination when there is only one page", () => {
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: { data: [makeEngagement()], meta: { total: 1, totalPage: 1 } },
        isLoading: false,
      })

      render(<AuditPage />)

      expect(
        screen.queryByRole("button", { name: /Next page/i })
      ).not.toBeInTheDocument()
    })
  })
})
