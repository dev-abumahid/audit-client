import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ReportsPage from "./ReportsPage"

// Controllable `i18n.language` for the locale-formatting test below, while
// every other test in this file keeps relying on the real (uninitialized)
// react-i18next t(), which just echoes the raw key back -- same technique
// as TeamMembersTab.test.tsx.
let mockLanguage: string | undefined = undefined
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return { ...real, i18n: { ...real.i18n, language: mockLanguage } }
    },
  }
})

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
    mockLanguage = undefined
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

  // aexa-frontend#467: h1 -> h3 (report card title) skipped h2 entirely. A
  // sr-only h2 for the reports grid keeps the hierarchy unbroken.
  it("does not skip heading levels from h1 to h3", () => {
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport()] },
      isLoading: false,
    })

    render(<ReportsPage />)

    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1)
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(1)
    expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(0)
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

  // aexa-frontend round-3 audit bug #3: report.createdAt was hardcoded to
  // "en-US" regardless of the active UI language.
  it("formats the report date in French when the UI language is French", () => {
    mockLanguage = "fr"
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport({ createdAt: "2026-07-20T10:00:00.000Z" })] },
      isLoading: false,
    })

    render(<ReportsPage />)

    const expected = new Date("2026-07-20T10:00:00.000Z").toLocaleDateString(
      "fr-FR",
      { year: "numeric", month: "long", day: "numeric" }
    )
    expect(screen.getByText(expected)).toBeInTheDocument()
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

  // aexa-frontend round-4 audit bug #338: disabled option elements showed
  // "Coming soon" twice -- once as a label suffix, once as an identical
  // title tooltip. Keep only the label suffix.
  it("shows 'Coming soon' only once (as the label suffix, not also a title tooltip) for a disabled report type", () => {
    mockUseGetAllReportsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })

    render(<ReportsPage />)

    const monteCarloOption = screen.getByRole("option", {
      name: /organization\.reports\.types\.MONTE_CARLO/,
    }) as HTMLOptionElement

    expect(monteCarloOption.textContent).toContain(
      "organization.reports.comingSoon"
    )
    expect(monteCarloOption.title).toBe("")
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

  it("opens the PDF in a new tab when Preview is clicked on a READY report", async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport({ status: "READY" })] },
      isLoading: false,
    })

    render(<ReportsPage />)

    await user.click(
      screen.getByRole("button", {
        name: /organization\.reports\.preview/i,
      })
    )

    expect(openSpy).toHaveBeenCalledWith(
      "https://cdn.example/report.pdf",
      "_blank",
      "noopener"
    )
    openSpy.mockRestore()
  })

  // Regression (aexa-frontend#493): Preview and Download used to share the
  // identical openPdf() handler (window.open in a new tab), so Download
  // never actually downloaded anything. Now it must use a real <a download>
  // element -- the same pattern as FindingDetails.tsx's downloadFile() --
  // and must NOT call window.open (that would be the old, wrong behavior).
  it("downloads the PDF via a temporary <a download> element when Download is clicked on a READY report", async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
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

    expect(clickSpy).toHaveBeenCalledTimes(1)
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.href).toBe("https://cdn.example/report.pdf")
    expect(anchor.download).toBe("Q3 2026 Board Risk Report.pdf")
    expect(openSpy).not.toHaveBeenCalled()

    clickSpy.mockRestore()
    openSpy.mockRestore()
  })

  // Regression (review finding on #493): report.title is free-text, unlike
  // FindingDetails.tsx's attachmentFileName() which derives its name from a
  // URL path segment and is structurally immune to "/". A title containing
  // "/" must not be used verbatim as the download filename, since the
  // browser (and some OSes) would read it as a path separator and
  // mangle/truncate the actual downloaded file name.
  it("sanitizes filesystem-unsafe characters out of the report title before using it as the download filename", async () => {
    const user = userEvent.setup()
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
    mockUseGetAllReportsQuery.mockReturnValue({
      data: {
        data: [
          makeReport({ status: "READY", title: "Q3/2026 Board Report" }),
        ],
      },
      isLoading: false,
    })

    render(<ReportsPage />)

    await user.click(
      screen.getByRole("button", {
        name: /organization\.reports\.download/i,
      })
    )

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).not.toContain("/")
    expect(anchor.download).toBe("Q3_2026 Board Report.pdf")

    clickSpy.mockRestore()
  })

  // Regression (review round 2 polish on #493): a title made up entirely of
  // unsafe characters (e.g. "////") used to collapse to a bare "_" instead
  // of falling back to a real filename, since the trim/fallback only
  // checked for an empty string.
  it("falls back to a generic filename when the title is entirely unsafe characters", async () => {
    const user = userEvent.setup()
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
    mockUseGetAllReportsQuery.mockReturnValue({
      data: {
        data: [makeReport({ status: "READY", title: "////" })],
      },
      isLoading: false,
    })

    render(<ReportsPage />)

    await user.click(
      screen.getByRole("button", {
        name: /organization\.reports\.download/i,
      })
    )

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe("report.pdf")

    clickSpy.mockRestore()
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

  // quality-bar-loop-derived fix: none of this file's raw <button> elements
  // (Generate, Preview, Download, Publish) declared type="button",
  // defaulting to the implicit type="submit" -- harmless only because this
  // page's markup doesn't currently sit inside a <form>, but a real footgun
  // if it ever does. This file renders no shadcn <Button>, so a full sweep
  // is safe here -- an ADMIN viewing a READY report mounts all four at once.
  it("gives every button an explicit type so none default to implicit submit", () => {
    mockUseMyOrgRole.mockReturnValue("ADMIN")
    mockUseGetAllReportsQuery.mockReturnValue({
      data: { data: [makeReport({ status: "READY" })] },
      isLoading: false,
    })

    render(<ReportsPage />)

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })
})
