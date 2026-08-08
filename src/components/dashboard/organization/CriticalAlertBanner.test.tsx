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
    org_account_id: "org-1",
    kri_id: null,
    source: "system_monitor",
    type: "security",
    severity: "high",
    title: "Unauthorized login attempt detected",
    description: null,
    is_read: false,
    ai_generated: true,
    createdAt: "2026-04-15T08:30:00Z",
    updatedAt: "2026-04-15T08:30:00Z",
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

  // Alert has no relevance_score column on the real backend, so the banner
  // can't sort by it — it just preserves whatever order GET /alert returns
  // (createdAt-desc server-side). This locks in that the list isn't
  // silently reordered/dropped by the (now-removed) filter+sort chain.
  it("preserves the API's response order, first alert first", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", severity: "critical", title: "First alert" }),
          makeAlert({ id: "a2", severity: "critical", title: "Second alert" }),
        ],
      },
    })
    render(<CriticalAlertBanner />)

    const text = screen.getByText(/First alert, Second alert/)
    expect(text).toBeInTheDocument()
  })

  // quality-bar-loop round 1 review (Overview.tsx's own resilience fix,
  // same round): this component's fetch had no error check at all -- on
  // failure, `alerts` fell through to `?? []`, `criticalAlerts.length`
  // came out to 0, and the banner silently rendered nothing, the exact
  // same false-all-clear pattern as the sibling Overview.tsx fix, but
  // worse: this banner's entire purpose is surfacing critical alerts, so
  // "renders nothing" is indistinguishable from "genuinely zero critical
  // alerts."
  it("shows a distinct error notice instead of silently rendering nothing when the fetch fails", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: undefined,
      isError: true,
    })
    const { container } = render(<CriticalAlertBanner />)

    expect(container).not.toBeEmptyDOMElement()
    // No I18nextProvider in this test's tree, so react-i18next's real t()
    // falls back to the raw key -- same convention other test files in
    // this codebase rely on (e.g. RiskGraphPage.test.tsx).
    expect(
      screen.getByText("alert.criticalAlertsCheckFailed")
    ).toBeInTheDocument()
  })

  it("dismisses the error notice when the close button is clicked, same as the normal banner", async () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: undefined,
      isError: true,
    })
    const { container } = render(<CriticalAlertBanner />)

    await userEvent.click(screen.getByRole("button"))

    expect(container).toBeEmptyDOMElement()
  })

  // Round 2 review: the error notice and the normal banner used to share one
  // `dismissed` flag, so dismissing an error and then having the query
  // recover with real critical alerts left the banner permanently hidden --
  // the failure mode this whole fix exists to prevent, just delayed.
  it("still shows real critical alerts after the error notice was dismissed and the fetch later recovers", async () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: undefined,
      isError: true,
    })
    const { rerender } = render(<CriticalAlertBanner />)

    await userEvent.click(screen.getByRole("button"))

    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [makeAlert({ severity: "critical", title: "Recovered alert" })],
      },
    })
    rerender(<CriticalAlertBanner />)

    expect(screen.getByText(/Recovered alert/)).toBeInTheDocument()
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
