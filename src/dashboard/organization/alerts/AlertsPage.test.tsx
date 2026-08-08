import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import AlertsPage from "./AlertsPage"

// aexa-frontend#530: an alert with kri_id set now renders a <Link> to the
// KRI dashboard, so this needs a Router context -- same convention as
// InspectionTable.test.tsx's renderTable(). initialPath (round 14) lets
// the ?severity= filter tests below drive the initial URL, same convention
// as KriDashboardPage.test.tsx's renderPage(initialPath).
function renderPage(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AlertsPage />
    </MemoryRouter>
  )
}

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
// Records every t() call (args included) while still delegating to the real
// uninitialized t() for rendering -- lets tests assert on *which* args a
// given key was called with (e.g. activeCount's `count`) without needing a
// real i18next instance loaded.
const tCalls: unknown[][] = []
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      const trackedT = ((...args: unknown[]) => {
        tCalls.push(args)
        const untypedT = real.t as unknown as (...a: unknown[]) => string
        return untypedT(...args)
      }) as unknown as typeof real.t
      return {
        ...real,
        t: trackedT,
        i18n: { ...real.i18n, language: mockLanguage },
      }
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
    tCalls.length = 0
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
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows an error state when alerts fail to load", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
    })
    renderPage()
    expect(screen.getByText("organization.alerts.loadFailed")).toBeInTheDocument()
  })

  it("shows the empty state when there are no alerts", () => {
    renderPage()
    expect(screen.getByText("organization.alerts.empty")).toBeInTheDocument()
  })

  it("renders an alert's title, description, and source", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert()] },
      isLoading: false,
    })
    renderPage()

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
    renderPage()

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
    renderPage()

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

    renderPage()
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

    renderPage()
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
    renderPage()

    expect(screen.getByText("organization.alerts.activeCount")).toBeInTheDocument()
  })

  // aexa-frontend round-3 audit bug #5: `alert.type` used to render the raw
  // backend string directly with no humanization.
  it("humanizes a known alert.type via the label map", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ type: "kri_threshold_breach" })] },
      isLoading: false,
    })
    renderPage()

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
    renderPage()

    expect(screen.getByText("some_future_backend_type")).toBeInTheDocument()
  })

  // aexa-frontend round-4 audit bug #331: the icon color logic only branched
  // critical/high/else, so low-severity alerts rendered with medium's amber
  // styling instead of RiskBadge's low color.
  it("gives a low-severity alert its own icon color, not medium's", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ id: "a1", severity: "low" })] },
      isLoading: false,
    })
    renderPage()

    // Colors now come from severityStyles.ts's verified-AA-safe pairing
    // (see src/utils/severityStyles.ts) rather than the raw --risk-* token
    // classes, which fail contrast as small text/icons on their own tint.
    const icon = document.querySelector("svg.text-emerald-700")
    expect(icon).toBeInTheDocument()
    expect(document.querySelector("svg.text-amber-800")).not.toBeInTheDocument()
  })

  // quality-bar-loop round 16 (resilience regression): this indexed
  // straight into SEVERITY_STYLES[alert.severity] with no fallback -- a
  // genuine crash (`Cannot read properties of undefined`) for any alert
  // whose severity isn't one of the 4 canonical values this page's own
  // filter chips assume (e.g. a legacy/malformed record).
  it("does not crash on an alert with an unrecognized severity value", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [makeAlert({ id: "a1", severity: "unknown-legacy-value" })],
      },
      isLoading: false,
    })

    expect(() => renderPage()).not.toThrow()
  })

  // aexa-frontend round-4 audit bug #332: the severity quick-filter chips
  // were inert <div>s. Clicking one should narrow the list, clicking again
  // should clear the filter (toggle behavior).
  it("filters the alert list when a severity quick-filter chip is clicked, and toggles off on a second click", async () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", severity: "critical", title: "Critical one" }),
          makeAlert({ id: "a2", severity: "high", title: "High one" }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("Critical one")).toBeInTheDocument()
    expect(screen.getByText("High one")).toBeInTheDocument()

    const criticalChip = screen.getAllByRole("button").find((btn) =>
      btn.querySelector(".text-red-700")
    )
    expect(criticalChip).toBeDefined()

    await userEvent.click(criticalChip!)
    expect(screen.getByText("Critical one")).toBeInTheDocument()
    expect(screen.queryByText("High one")).not.toBeInTheDocument()

    await userEvent.click(criticalChip!)
    expect(screen.getByText("Critical one")).toBeInTheDocument()
    expect(screen.getByText("High one")).toBeInTheDocument()
  })

  // quality-bar-loop round 14 (industry-standards): the dashboard's
  // "Critical Alerts" card now links here with ?severity=critical, seeding
  // the same quick-filter chip state this page already had.
  it("pre-filters to critical severity when ?severity=critical is in the URL", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", severity: "critical", title: "Critical one" }),
          makeAlert({ id: "a2", severity: "high", title: "High one" }),
        ],
      },
      isLoading: false,
    })

    renderPage("/?severity=critical")

    expect(screen.getByText("Critical one")).toBeInTheDocument()
    expect(screen.queryByText("High one")).not.toBeInTheDocument()
  })

  it("ignores an invalid ?severity= value instead of crashing", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", severity: "critical", title: "Critical one" }),
          makeAlert({ id: "a2", severity: "high", title: "High one" }),
        ],
      },
      isLoading: false,
    })

    renderPage("/?severity=not-a-real-severity")

    expect(screen.getByText("Critical one")).toBeInTheDocument()
    expect(screen.getByText("High one")).toBeInTheDocument()
  })

  // Round-4 review finding: the header's "N active alerts" count used to
  // read the severity-filtered list's length, so activating a filter made
  // the header understate how many alerts actually exist. It must always
  // reflect the true org-wide total, regardless of which (if any) severity
  // chip is active.
  it("keeps the header count at the org-wide total, not the filtered count, when a severity filter is active", async () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", severity: "critical" }),
          makeAlert({ id: "a2", severity: "high" }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    const criticalChip = screen.getAllByRole("button").find((btn) =>
      btn.querySelector(".text-red-700")
    )
    await userEvent.click(criticalChip!)

    const activeCountCalls = tCalls.filter(
      (args) => args[0] === "organization.alerts.activeCount"
    )
    expect(activeCountCalls.length).toBeGreaterThan(0)
    activeCountCalls.forEach((args) => {
      expect((args[1] as { count: number }).count).toBe(2)
    })
  })

  // aexa-frontend#466: h1 -> h3 (per-alert-card title) skipped h2 entirely.
  // A sr-only h2 for the list section keeps the hierarchy unbroken without
  // changing the visible layout.
  it("does not skip heading levels from h1 to h3", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert()] },
      isLoading: false,
    })
    renderPage()

    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1)
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(1)
    expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(0)
  })

  // aexa-frontend round-3 audit bug #3: the alert timestamp used to be
  // hardcoded to "en-US" regardless of the active UI language.
  it("formats the alert timestamp in French when the UI language is French", () => {
    mockLanguage = "fr"
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ createdAt: "2026-06-21T10:00:00.000Z" })] },
      isLoading: false,
    })
    renderPage()

    const expected = new Date("2026-06-21T10:00:00.000Z").toLocaleDateString(
      "fr-FR",
      { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    )
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  // aexa-frontend#530: kri_id was populated on every kri_threshold_breach
  // alert but never surfaced -- this is the Alert-side half of the fix.
  describe("View KRI link (#530)", () => {
    it("shows a View KRI link to the KRI dashboard when kri_id is set", () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ kri_id: "kri-1" })] },
        isLoading: false,
      })
      renderPage()

      const link = screen.getByRole("link", {
        name: "organization.alerts.viewKri",
      })
      expect(link).toHaveAttribute("href", "/organization/kri?highlight=kri-1")
    })

    it("does not show a View KRI link when kri_id is null", () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ kri_id: null })] },
        isLoading: false,
      })
      renderPage()

      expect(
        screen.queryByRole("link", { name: "organization.alerts.viewKri" })
      ).not.toBeInTheDocument()
    })
  })
})
