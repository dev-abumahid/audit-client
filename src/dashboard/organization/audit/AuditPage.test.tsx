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
const mockUseGetAllRisksQuery = vi.fn()
const mockNavigate = vi.fn()

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

// aexa-frontend#165: the linked-risks multi-select fetches the org's real risks.
vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
}))

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}))

// aexa-frontend#226 -- role hook mocked per-test via this mutable holder,
// same convention as RiskRegisterPage.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

// A small pool of org risks the multi-select renders as checkbox options.
const RISK_OPTIONS = [
  { id: "risk-1", name: "Data breach", category: "Cyber" },
  { id: "risk-2", name: "Supplier default", category: "Operational" },
  { id: "risk-3", name: "Flood damage", category: "Physical" },
]

// The Title label isn't associated with its input via htmlFor, so locate it
// through the label's wrapping <div>. i18n isn't initialized in the test
// environment, so t() echoes the raw key back (see RiskRegisterPage.test.tsx).
function titleInput(): HTMLInputElement {
  const label = screen.getByText("organization.audit.titleLabel")
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
    linked_risks: [{ id: "risk-1", name: "Data breach", category: "Cyber" }],
    report_url: null,
    createdAt: "2026-02-20T10:00:00.000Z",
    updatedAt: "2026-03-10T12:00:00.000Z",
    ...overrides,
  }
}

describe("AuditPage", () => {
  beforeEach(() => {
    mockRole = "ADMIN"
    mockUseGetAllAuditEngagementsQuery.mockReset()
    mockCreateAuditEngagement.mockReset()
    mockUpdateAuditEngagement.mockReset()
    mockDeleteAuditEngagement.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockUseGetAllRisksQuery.mockReset()
    mockNavigate.mockReset()
    // Default: the org's risks are available to the picker unless a test
    // overrides this.
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: RISK_OPTIONS },
      isLoading: false,
    })
  })

  it("shows New Mission, Edit and Delete for an ADMIN", () => {
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [makeEngagement()] },
      isLoading: false,
    })

    render(<AuditPage />)

    expect(
      screen.getByText("organization.audit.newMission")
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pencil"))
    ).toBe(true)
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
    ).toBe(true)
  })

  it("hides New Mission, Edit and Delete for a VIEWER", () => {
    mockRole = "VIEWER"
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [makeEngagement()] },
      isLoading: false,
    })

    render(<AuditPage />)

    expect(
      screen.queryByText("organization.audit.newMission")
    ).not.toBeInTheDocument()
    expect(
      screen.queryAllByRole("button").some((b) => b.querySelector("svg.lucide-pencil"))
    ).toBe(false)
    expect(
      screen.queryAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
    ).toBe(false)
  })

  it("hides write controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [makeEngagement()] },
      isLoading: false,
    })

    render(<AuditPage />)

    expect(
      screen.queryByText("organization.audit.newMission")
    ).not.toBeInTheDocument()
  })

  it("shows a loading spinner while the query is loading", () => {
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    const { container } = render(<AuditPage />)

    expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    expect(
      screen.queryByText("organization.audit.empty")
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
    expect(
      within(card).getByText("organization.audit.statusInProgress")
    ).toBeInTheDocument()
  })

  it("shows the empty state when there are no engagements", () => {
    mockUseGetAllAuditEngagementsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    render(<AuditPage />)

    expect(screen.getByText("organization.audit.empty")).toBeInTheDocument()
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

    await user.click(
      screen.getByRole("button", { name: /organization\.audit\.newMission/i })
    )
    await user.type(
      screen.getByPlaceholderText("organization.audit.refPlaceholder"),
      "AUD-2026-999"
    )
    await user.type(titleInput(), "ZZZ Unique Audit Mission XYZ")
    await user.click(
      screen.getByRole("button", { name: "organization.audit.create" })
    )

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
    await user.click(
      screen.getByRole("button", { name: "organization.audit.update" })
    )

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
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "organization.audit.deleteSuccess"
    )
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

    await user.click(
      screen.getByRole("button", { name: /organization\.audit\.newMission/i })
    )
    await user.type(titleInput(), "Audit that fails to save")
    await user.click(
      screen.getByRole("button", { name: "organization.audit.create" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server unavailable")
    )
    // Modal stays open on failure.
    expect(
      screen.getByText("organization.audit.newModalTitle")
    ).toBeInTheDocument()
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
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "organization.audit.reportUploadSuccess"
      )
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
        expect(mockToastError).toHaveBeenCalledWith(
          "organization.audit.uploadReportFailed"
        )
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

  // aexa-frontend round-4 audit bug #337: the In Progress / Completed /
  // Total Findings stat cards silently mixed a page-scoped client-side tally
  // with meta.total's org-wide accuracy, undercounting on orgs with more
  // than one page of engagements. The page-scoped stats now carry a
  // "(this page)" qualifier so the two kinds of numbers aren't conflated.
  describe("page-scoped stat qualifiers (issue #337)", () => {
    it("qualifies the page-scoped stats but not the org-wide total", () => {
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: {
          data: [makeEngagement()],
          meta: { total: 45, totalPage: 3, page: 1, limit: 20 },
        },
        isLoading: false,
      })

      render(<AuditPage />)

      const qualifiedLabels = document.querySelectorAll(
        '[title="organization.audit.statPageScopedTooltip"]'
      )
      expect(qualifiedLabels.length).toBe(3)
      qualifiedLabels.forEach((el) =>
        expect(el.textContent).toContain(
          "organization.audit.statPageQualifier"
        )
      )

      const totalLabel = screen.getByText("organization.audit.statTotal")
      expect(
        totalLabel.textContent?.includes(
          "organization.audit.statPageQualifier"
        )
      ).toBe(false)
      expect(totalLabel).not.toHaveAttribute("title")
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
        "organization.audit.searchPlaceholder"
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

      await user.click(
        screen.getByRole("button", { name: /organization\.audit\.nextPage/i })
      )

      const lastCall =
        mockUseGetAllAuditEngagementsQuery.mock.calls[
          mockUseGetAllAuditEngagementsQuery.mock.calls.length - 1
        ][0]
      expect(lastCall.page).toBe(2)
    })

    // aexa-frontend#265: the delete-path counterpart to #234/#243 (this
    // file's own handleSearchChange resets page on a search change, but
    // nothing resets it when a delete alone shrinks totalPages).
    it("aexa-frontend#265: clamps the page back into range after deleting the last engagement on the last page", async () => {
      const user = userEvent.setup()
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: {
          data: [makeEngagement()],
          meta: { total: 45, totalPage: 3, page: 1, limit: 20 },
        },
        isLoading: false,
      })
      mockDeleteAuditEngagement.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      const { rerender } = render(<AuditPage />)

      await user.click(
        screen.getByRole("button", { name: /organization\.audit\.nextPage/i })
      )
      await user.click(
        screen.getByRole("button", { name: /organization\.audit\.nextPage/i })
      )

      let lastCall =
        mockUseGetAllAuditEngagementsQuery.mock.calls[
          mockUseGetAllAuditEngagementsQuery.mock.calls.length - 1
        ][0]
      expect(lastCall.page).toBe(3)

      const card = screen
        .getByText("Supply Chain Risk Audit")
        .closest("[class*='rounded-xl']")! as HTMLElement
      await user.click(within(card).getAllByRole("button")[1])

      await waitFor(() =>
        expect(mockDeleteAuditEngagement).toHaveBeenCalledWith("audit-1")
      )

      // Deleting the last engagement on page 3 drops total to 25 ->
      // totalPage 2, stranding page 3 out of range. Unlike the other 5 list
      // pages, AuditPage's handleDelete has no local setState on success --
      // in the real app the re-render comes from RTK Query's own cache
      // subscription reacting to the invalidated list query, which this
      // fully-mocked hook can't reproduce on its own, so the refreshed
      // (smaller) result is applied via an explicit rerender here, standing
      // in for that cache-driven re-render.
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: {
          data: [],
          meta: { total: 25, totalPage: 2, page: 3, limit: 20 },
        },
        isLoading: false,
      })
      rerender(<AuditPage />)

      await waitFor(() => {
        lastCall =
          mockUseGetAllAuditEngagementsQuery.mock.calls[
            mockUseGetAllAuditEngagementsQuery.mock.calls.length - 1
          ][0]
        expect(lastCall.page).toBe(2)
      })

      confirmSpy.mockRestore()
    })

    it("does not render pagination when there is only one page", () => {
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: { data: [makeEngagement()], meta: { total: 1, totalPage: 1 } },
        isLoading: false,
      })

      render(<AuditPage />)

      expect(
        screen.queryByRole("button", { name: /organization\.audit\.nextPage/i })
      ).not.toBeInTheDocument()
    })
  })

  describe("linked-risks multi-select (aexa-frontend#165)", () => {
    it("renders the org's available risks as options in the create form", async () => {
      const user = userEvent.setup()
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      render(<AuditPage />)

      await user.click(
        screen.getByRole("button", { name: /organization\.audit\.newMission/i })
      )
      // Open the risk picker dropdown.
      await user.click(
        screen.getByRole("button", {
          name: /organization\.audit\.riskSelect\.selectPlaceholder/i,
        })
      )

      // Every org risk shows up as a selectable option.
      expect(screen.getByText("Data breach")).toBeInTheDocument()
      expect(screen.getByText("Supplier default")).toBeInTheDocument()
      expect(screen.getByText("Flood damage")).toBeInTheDocument()
    })

    it("persists the selected risk ids to createAuditEngagement on save", async () => {
      const user = userEvent.setup()
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockCreateAuditEngagement.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            success: true,
            message: "Audit engagement created",
          }),
      })

      render(<AuditPage />)

      await user.click(
        screen.getByRole("button", { name: /organization\.audit\.newMission/i })
      )
      await user.type(titleInput(), "Audit with linked risk")
      await user.click(
        screen.getByRole("button", {
          name: /organization\.audit\.riskSelect\.selectPlaceholder/i,
        })
      )
      // Select two risks from the dropdown.
      await user.click(screen.getByText("Data breach"))
      await user.click(screen.getByText("Flood damage"))
      await user.click(
        screen.getByRole("button", { name: "organization.audit.create" })
      )

      await waitFor(() => expect(mockCreateAuditEngagement).toHaveBeenCalled())
      const submitted = mockCreateAuditEngagement.mock.calls[0][0]
      expect(submitted.riskIds).toEqual(["risk-1", "risk-3"])
    })

    it("pre-fills the multi-select with the engagement's existing linked risks on edit", async () => {
      const user = userEvent.setup()
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: { data: [makeEngagement()] },
        isLoading: false,
      })
      mockUpdateAuditEngagement.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            success: true,
            message: "Audit engagement updated",
          }),
      })

      render(<AuditPage />)

      const card = screen
        .getByText("Supply Chain Risk Audit")
        .closest("[class*='rounded-xl']")! as HTMLElement
      await user.click(within(card).getAllByRole("button")[0])

      // The existing link (risk-1 "Data breach") is shown as a selected chip in
      // the modal, with a remove control — proving edit round-trips it.
      expect(
        screen.getByRole("button", {
          name: /organization\.audit\.riskSelect\.removeRisk/i,
        })
      ).toBeInTheDocument()

      // Saving without touching the picker sends the existing link back.
      await user.click(
        screen.getByRole("button", { name: "organization.audit.update" })
      )
      await waitFor(() => expect(mockUpdateAuditEngagement).toHaveBeenCalled())
      const callArg = mockUpdateAuditEngagement.mock.calls[0][0]
      expect(callArg.data.riskIds).toEqual(["risk-1"])
    })

    it("navigates to the Risk Register when a linked risk in a card is clicked", async () => {
      const user = userEvent.setup()
      mockUseGetAllAuditEngagementsQuery.mockReturnValue({
        data: { data: [makeEngagement()] },
        isLoading: false,
      })

      render(<AuditPage />)

      const card = screen
        .getByText("Supply Chain Risk Audit")
        .closest("[class*='rounded-xl']")! as HTMLElement
      // The card's "Linked Risks: Data breach" is a clickable button.
      await user.click(
        within(card).getByRole("button", { name: "Data breach" })
      )

      expect(mockNavigate).toHaveBeenCalledWith("/organization/risks")
    })
  })
})
