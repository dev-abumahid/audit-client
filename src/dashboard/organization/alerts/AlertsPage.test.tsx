import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AlertsPage from "./AlertsPage"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

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
    expect(screen.getByText(/failed to load alerts/i)).toBeInTheDocument()
  })

  it("shows the empty state when there are no alerts", () => {
    render(<AlertsPage />)
    expect(screen.getByText("No alerts yet")).toBeInTheDocument()
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

    expect(screen.getByText("New")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /mark as read/i })
    ).toBeInTheDocument()
  })

  it('does not show "New" or "Mark as read" for an already-read alert', () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ is_read: true })] },
      isLoading: false,
    })
    render(<AlertsPage />)

    expect(screen.queryByText("New")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /mark as read/i })
    ).not.toBeInTheDocument()
  })

  it("marks an alert as read when the button is clicked", async () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert()] },
      isLoading: false,
    })
    mockMarkAlertRead.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<AlertsPage />)
    await userEvent.click(screen.getByRole("button", { name: /mark as read/i }))

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
    await userEvent.click(screen.getByRole("button", { name: /mark as read/i }))

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

    expect(screen.getByText("4 active alerts")).toBeInTheDocument()
  })
})
