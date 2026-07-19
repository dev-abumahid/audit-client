import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CriticalAlertBanner from "./CriticalAlertBanner"

const mockUseGetAllAlertsQuery = vi.fn()

vi.mock("@/redux/apis/organization/alert.api", () => ({
  useGetAllAlertsQuery: (...args: unknown[]) =>
    mockUseGetAllAlertsQuery(...args),
}))

function makeAlert(overrides = {}) {
  return {
    id: "a1",
    organization_id: "org-1",
    user_id: "user-1",
    source: "system_monitor",
    type: "security",
    severity: "high",
    title: "Unauthorized login attempt detected",
    description: null,
    relevance_score: 0.87,
    matched_risks: [],
    country: null,
    is_read: false,
    ai_generated: true,
    is_edited: false,
    created_at: "2026-04-15T08:30:00Z",
    ...overrides,
  }
}

describe("CriticalAlertBanner", () => {
  beforeEach(() => {
    mockUseGetAllAlertsQuery.mockReset()
    mockUseGetAllAlertsQuery.mockReturnValue({ data: { data: [] } })
  })

  it("renders nothing when there are no real critical alerts", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ severity: "high" })] },
    })
    const { container } = render(<CriticalAlertBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing while still loading, not a stale/fake count", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({ data: undefined })
    const { container } = render(<CriticalAlertBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the real critical alert count and titles, not the old hardcoded fixture", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", severity: "critical", title: "Real breach" }),
          makeAlert({ id: "a2", severity: "critical", title: "Real fraud" }),
          makeAlert({ id: "a3", severity: "low" }),
        ],
      },
    })
    render(<CriticalAlertBanner />)

    expect(screen.getByText(/Real breach/)).toBeInTheDocument()
    expect(screen.getByText(/Real fraud/)).toBeInTheDocument()
    expect(
      screen.queryByText("Potential financial fraud activity")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Data breach risk detected")
    ).not.toBeInTheDocument()
  })

  it("sorts by relevance_score, highest first", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({
            id: "a1",
            severity: "critical",
            title: "Lower relevance",
            relevance_score: 0.5,
          }),
          makeAlert({
            id: "a2",
            severity: "critical",
            title: "Higher relevance",
            relevance_score: 0.9,
          }),
        ],
      },
    })
    render(<CriticalAlertBanner />)

    const text = screen.getByText(/Higher relevance, Lower relevance/)
    expect(text).toBeInTheDocument()
  })

  it("dismisses the banner when the close button is clicked", async () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ severity: "critical" })] },
    })
    const { container } = render(<CriticalAlertBanner />)

    await userEvent.click(screen.getByRole("button"))

    expect(container).toBeEmptyDOMElement()
  })
})
