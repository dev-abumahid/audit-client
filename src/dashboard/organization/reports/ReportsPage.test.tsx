import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ReportsPage from "./ReportsPage"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockUseGetAllReportsQuery = vi.fn()
const mockGenerate = vi.fn()
const mockPublish = vi.fn()

vi.mock("@/redux/apis/organization/report.api", () => ({
  useGetAllReportsQuery: (...args: unknown[]) =>
    mockUseGetAllReportsQuery(...args),
  useGetReportByIdQuery: () => ({ data: undefined }),
  useGenerateReportMutation: () => [mockGenerate, { isLoading: false }],
  usePublishReportMutation: () => [mockPublish, { isLoading: false }],
}))

const mockUseMyOrgRole = vi.fn()
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockUseMyOrgRole(),
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

function makeReport(overrides = {}) {
  return {
    id: "rep-1",
    org_account_id: "org-a",
    type: "BOARD",
    title: "Q3 2026 Board Risk Report",
    reference: "BOARD-2026-Q3",
    status: "READY",
    content: null,
    file_url: "https://cdn.example/report.pdf",
    pages: null,
    parameters: null,
    version: 1,
    generated_by: "acc-1",
    reviewed_by: null,
    reviewed_at: null,
    ai_generated: true,
    error_message: null,
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  }
}

describe("ReportsPage", () => {
  beforeEach(() => {
    mockUseGetAllReportsQuery.mockReset()
    mockGenerate.mockReset()
    mockPublish.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockUseMyOrgRole.mockReset()
    mockUseMyOrgRole.mockReturnValue("ADMIN")
  })

  it("shows the Generate section for an ADMIN", () => {
    mockUseGetAllReportsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })

    render(<ReportsPage />)

    expect(
      screen.getByRole("button", { name: /organization\.reports\.generate/i })
    ).toBeInTheDocument()
  })

  it("hides the Generate section for a VIEWER", () => {
    mockUseMyOrgRole.mockReturnValue("VIEWER")
    mockUseGetAllReportsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })

    render(<ReportsPage />)

    expect(
      screen.queryByRole("button", { name: /organization\.reports\.generate/i })
    ).not.toBeInTheDocument()
  })

  it("hides the Generate section for a LIGHT_USER", () => {
    mockUseMyOrgRole.mockReturnValue("LIGHT_USER")
    mockUseGetAllReportsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })

    render(<ReportsPage />)

    expect(
      screen.queryByRole("button", { name: /organization\.reports\.generate/i })
    ).not.toBeInTheDocument()
  })

  it("shows a loading spinner while the query is loading", () => {
    mockUseGetAllReportsQuery.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = render(<ReportsPage />)

    expect(container.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("renders report cards from the query with title and status", () => {
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport()] },
      isLoading: false,
    })

    render(<ReportsPage />)

    expect(screen.getByText("Q3 2026 Board Risk Report")).toBeInTheDocument()
    expect(
      screen.getByText("organization.reports.status.READY")
    ).toBeInTheDocument()
  })

  it("shows the empty state when there are no reports", () => {
    mockUseGetAllReportsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })

    render(<ReportsPage />)

    expect(screen.getByText("organization.reports.empty")).toBeInTheDocument()
  })

  it("disables the 4 non-BOARD report types in the dropdown", () => {
    mockUseGetAllReportsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })

    render(<ReportsPage />)

    const boardOption = screen.getByRole("option", {
      name: /organization\.reports\.types\.BOARD/,
    }) as HTMLOptionElement
    const monteCarloOption = screen.getByRole("option", {
      name: /organization\.reports\.types\.MONTE_CARLO/,
    }) as HTMLOptionElement

    expect(boardOption.disabled).toBe(false)
    expect(monteCarloOption.disabled).toBe(true)
  })

  it("calls generateReport with the selected type and shows a success toast", async () => {
    const user = userEvent.setup()
    mockUseGetAllReportsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockGenerate.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, data: { status: "READY" } }),
    })

    render(<ReportsPage />)

    await user.click(
      screen.getByRole("button", { name: /organization\.reports\.generate/i })
    )

    await waitFor(() => expect(mockGenerate).toHaveBeenCalled())
    expect(mockGenerate.mock.calls[0][0]).toEqual({ type: "BOARD" })
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "organization.reports.generateSuccess"
    )
  })

  it("shows an error toast when generation returns a FAILED report", async () => {
    const user = userEvent.setup()
    mockUseGetAllReportsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockGenerate.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, data: { status: "FAILED" } }),
    })

    render(<ReportsPage />)

    await user.click(
      screen.getByRole("button", { name: /organization\.reports\.generate/i })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.reports.generateFailed"
      )
    )
  })

  it("shows the Publish button for an ADMIN on a READY report and calls the mutation", async () => {
    const user = userEvent.setup()
    mockUseMyOrgRole.mockReturnValue("ADMIN")
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport({ status: "READY" })] },
      isLoading: false,
    })
    mockPublish.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<ReportsPage />)

    const publishBtn = screen.getByRole("button", {
      name: /organization\.reports\.publish/i,
    })
    await user.click(publishBtn)

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith("rep-1"))
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "organization.reports.publishSuccess"
    )
  })

  it("hides the Publish button for a non-admin (LEAD_AUDITOR)", () => {
    mockUseMyOrgRole.mockReturnValue("LEAD_AUDITOR")
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport({ status: "READY" })] },
      isLoading: false,
    })

    render(<ReportsPage />)

    expect(
      screen.queryByRole("button", { name: /organization\.reports\.publish/i })
    ).not.toBeInTheDocument()
  })

  it("does not show the Publish button on an already PUBLISHED report", () => {
    mockUseMyOrgRole.mockReturnValue("ADMIN")
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport({ status: "PUBLISHED" })] },
      isLoading: false,
    })

    render(<ReportsPage />)

    expect(
      screen.queryByRole("button", { name: /organization\.reports\.publish/i })
    ).not.toBeInTheDocument()
  })

  it("shows a failure hint and no download button for a FAILED report", () => {
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport({ status: "FAILED", file_url: null })] },
      isLoading: false,
    })

    render(<ReportsPage />)

    expect(
      screen.getByText("organization.reports.failedHint")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /organization\.reports\.download/i })
    ).not.toBeInTheDocument()
  })

  it("opens the PDF in a new tab when Download is clicked on a READY report", async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport({ status: "READY" })] },
      isLoading: false,
    })

    render(<ReportsPage />)

    await user.click(
      screen.getByRole("button", {
        name: /organization\.reports\.download/i,
      })
    )

    expect(openSpy).toHaveBeenCalledWith(
      "https://cdn.example/report.pdf",
      "_blank",
      "noopener"
    )
    openSpy.mockRestore()
  })

  it("polls the reports list while a report is GENERATING (#220)", async () => {
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport({ status: "GENERATING", file_url: null })] },
      isLoading: false,
    })

    render(<ReportsPage />)

    // The effect flips polling on once it sees a GENERATING report; the hook is
    // re-invoked with a non-zero pollingInterval.
    await waitFor(() => {
      const lastArgs = mockUseGetAllReportsQuery.mock.calls.at(-1)
      expect(lastArgs?.[1]).toMatchObject({ pollingInterval: 5000 })
    })
  })

  it("does not poll when no report is GENERATING (#220)", async () => {
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport({ status: "READY" })] },
      isLoading: false,
    })

    render(<ReportsPage />)

    await waitFor(() => {
      const lastArgs = mockUseGetAllReportsQuery.mock.calls.at(-1)
      expect(lastArgs?.[1]).toMatchObject({ pollingInterval: 0 })
    })
  })
})
