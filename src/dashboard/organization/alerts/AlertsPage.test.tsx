import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AlertsPage from "./AlertsPage"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

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

const mockUseGetAllAlertsQuery = vi.fn()
const mockMarkAlertRead = vi.fn()

vi.mock("@/redux/apis/organization/alert.api", () => ({
  useGetAllAlertsQuery: (...args: unknown[]) =>
    mockUseGetAllAlertsQuery(...args),
  useMarkAlertReadMutation: () => [mockMarkAlertRead, { isLoading: false }],
}))

function makeAlert(overrides = {}) {
  return {
    id: "alert-1",
    org_account_id: "org-1",
    source: "KRI Monitor",
    type: "threshold",
    severity: "high",
    title: "Overdue actions exceeded threshold",
    description: "12 actions are overdue.",
    is_read: false,
    ai_generated: false,
    createdAt: "2026-06-21T10:00:00.000Z",
    ...overrides,
  }
}

describe("AlertsPage", () => {
  beforeEach(() => {
    mockUseGetAllAlertsQuery.mockReset()
    mockMarkAlertRead.mockReset()
    mockToastError.mockReset()
    mockLanguage = undefined
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
  })

  it("shows a loading state", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    render(<AlertsPage />)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows an error state when alerts fail to load", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
    })
    render(<AlertsPage />)
    expect(screen.getByText("organization.alerts.loadFailed")).toBeInTheDocument()
  })

  it("shows the empty state when there are no alerts", () => {
    render(<AlertsPage />)
    expect(screen.getByText("organization.alerts.empty")).toBeInTheDocument()
  })

  it("renders an alert's title, description, and source", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert()] },
      isLoading: false,
    })
    render(<AlertsPage />)

    expect(
      screen.getByText("Overdue actions exceeded threshold")
    ).toBeInTheDocument()
    expect(screen.getByText("12 actions are overdue.")).toBeInTheDocument()
    expect(screen.getByText("KRI Monitor")).toBeInTheDocument()
  })

  it('shows a "New" badge and "Mark as read" button for an unread alert', () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ is_read: false })] },
      isLoading: false,
    })
    render(<AlertsPage />)

    expect(screen.getByText("organization.alerts.new")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "organization.alerts.markAsRead" })
    ).toBeInTheDocument()
  })

  it('does not show "New" or "Mark as read" for an already-read alert', () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ is_read: true })] },
      isLoading: false,
    })
    render(<AlertsPage />)

    expect(screen.queryByText("organization.alerts.new")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "organization.alerts.markAsRead" })
    ).not.toBeInTheDocument()
  })

  it("marks an alert as read when the button is clicked", async () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert()] },
      isLoading: false,
    })
    mockMarkAlertRead.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<AlertsPage />)
    await userEvent.click(screen.getByRole("button", { name: "organization.alerts.markAsRead" }))

    await waitFor(() =>
      expect(mockMarkAlertRead).toHaveBeenCalledWith("alert-1")
    )
  })

  it("shows an error toast when marking as read fails", async () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert()] },
      isLoading: false,
    })
    mockMarkAlertRead.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Failed to update" } }),
    })

    render(<AlertsPage />)
    await userEvent.click(screen.getByRole("button", { name: "organization.alerts.markAsRead" }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to update")
    )
  })

  it("counts alerts by severity into the quick filter row", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", severity: "critical" }),
          makeAlert({ id: "a2", severity: "critical" }),
          makeAlert({ id: "a3", severity: "high" }),
          makeAlert({ id: "a4", severity: "low" }),
        ],
      },
      isLoading: false,
    })
    render(<AlertsPage />)

    expect(screen.getByText("organization.alerts.activeCount")).toBeInTheDocument()
  })

  // aexa-frontend round-3 audit bug #5: `alert.type` used to render the raw
  // backend string directly with no humanization.
  it("humanizes a known alert.type via the label map", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ type: "kri_threshold_breach" })] },
      isLoading: false,
    })
    render(<AlertsPage />)

    expect(
      screen.getByText("organization.alerts.type.kriThresholdBreach")
    ).toBeInTheDocument()
    expect(screen.queryByText("kri_threshold_breach")).not.toBeInTheDocument()
  })

  it("falls back to the raw value for an alert.type with no label map entry", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ type: "some_future_backend_type" })] },
      isLoading: false,
    })
    render(<AlertsPage />)

    expect(screen.getByText("some_future_backend_type")).toBeInTheDocument()
  })

  // aexa-frontend round-3 audit bug #3: the alert timestamp used to be
  // hardcoded to "en-US" regardless of the active UI language.
  it("formats the alert timestamp in French when the UI language is French", () => {
    mockLanguage = "fr"
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ createdAt: "2026-06-21T10:00:00.000Z" })] },
      isLoading: false,
    })
    render(<AlertsPage />)

    const expected = new Date("2026-06-21T10:00:00.000Z").toLocaleDateString(
      "fr-FR",
      { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    )
    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
