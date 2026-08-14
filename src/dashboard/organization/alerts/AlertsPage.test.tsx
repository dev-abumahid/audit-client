import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
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
const mockToastSuccess = vi.mocked(toast.success)

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
  const { useCallback } = await import("react")
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      // Round 14 (efficiency fix): a fresh `trackedT` closure every call
      // gave every consumer's own `t`-keyed `useCallback` a new
      // dependency on every render, which would defeat AlertsPage's
      // `handleMarkRead` memoization regardless of how correct that
      // memoization is -- an uninitialized real react-i18next `t` is
      // itself stable across re-renders, so this mock should be too.
      const trackedT = useCallback(
        (...args: unknown[]) => {
          tCalls.push(args)
          const untypedT = real.t as unknown as (...a: unknown[]) => string
          return untypedT(...args)
        },
        [real.t]
      ) as unknown as typeof real.t
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

const mockDeleteAlert = vi.fn()
let mockIsDeletingAlert = false

// Round 7 (industry-standards): dismiss uses the shared DeleteAlertModal --
// same simplified stub convention as InspectionTable.test.tsx/
// AllFindingsPage.test.tsx, exposing just enough of its contract
// (open/onConfirm/loading) to drive the confirm flow without pulling in
// Radix's real AlertDialog.
vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({
    open,
    onConfirm,
    loading,
    confirmLabel,
    loadingLabel,
  }: {
    open: boolean
    onConfirm: () => void
    loading?: boolean
    confirmLabel?: string
    loadingLabel?: string
  }) =>
    open ? (
      // Round-1 review of PR #836: querying "the last button named X" only
      // worked by coincidence of this mock rendering after the alert list
      // in the DOM -- a real, if not currently reachable, way for a future
      // reorder to silently break the tests below with no failure
      // explaining why. Scoping to this wrapper (matched via `within`)
      // makes the modal's own button unambiguous regardless of render order.
      <div data-testid="delete-alert-modal">
        <button onClick={onConfirm} disabled={loading}>
          {loading ? (loadingLabel ?? "Confirm dismiss") : (confirmLabel ?? "Confirm dismiss")}
        </button>
      </div>
    ) : null,
}))

// Round 12 (UX): sort control -- same mock convention as
// InspectionTable.test.tsx, a native <select>/<option> pair standing in
// for Radix's Select so userEvent.selectOptions works without pulling in
// Radix's real listbox/portal behavior.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode
    value?: string
    onValueChange?: (v: string) => void
  }) => (
    <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string
    children: ReactNode
  }) => <option value={value}>{children}</option>,
}))

// Round 14 (efficiency fix): wraps the real formatLocaleDate so the
// memoization test below can count exactly which alert.createdAt values
// were re-formatted after an unrelated row's state changed, without
// altering its actual (real) formatting behavior for every other test.
const formatLocaleDateSpy = vi.fn()
vi.mock("@/utils/formatDate", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/utils/formatDate")>()
  return {
    ...mod,
    formatLocaleDate: (...args: Parameters<typeof mod.formatLocaleDate>) => {
      formatLocaleDateSpy(...args)
      return mod.formatLocaleDate(...args)
    },
  }
})

vi.mock("@/redux/apis/organization/alert.api", () => ({
  useGetAllAlertsQuery: (...args: unknown[]) =>
    mockUseGetAllAlertsQuery(...args),
  useMarkAlertReadMutation: () => [mockMarkAlertRead, { isLoading: false }],
  useDeleteAlertMutation: () => [
    mockDeleteAlert,
    { isLoading: mockIsDeletingAlert },
  ],
}))

// Round 5 (security fix): mark-read/mark-all-read are now gated on
// canWriteOrgResource(role) -- same mock convention as
// RiskRegisterPage.test.tsx. Defaults to ADMIN so every pre-existing test
// in this file (all written assuming the buttons are visible) keeps
// passing unchanged.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
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
    mockDeleteAlert.mockReset()
    mockIsDeletingAlert = false
    mockToastError.mockReset()
    mockToastSuccess.mockReset()
    formatLocaleDateSpy.mockReset()
    mockLanguage = undefined
    mockRole = "ADMIN"
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

  // Round 12 (UX finding): no sort control existed at all -- alerts only
  // ever rendered in the server's fixed createdAt-desc order, with no way
  // to group unread first or surface the most severe alerts.
  describe("sort control (round 12 UX fix)", () => {
    function threeAlerts() {
      return [
        makeAlert({
          id: "old-low",
          title: "Old low",
          severity: "low",
          is_read: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
        makeAlert({
          id: "new-critical",
          title: "New critical",
          severity: "critical",
          is_read: false,
          createdAt: "2026-06-01T00:00:00.000Z",
        }),
        makeAlert({
          id: "mid-medium",
          title: "Mid medium",
          severity: "medium",
          is_read: true,
          createdAt: "2026-03-01T00:00:00.000Z",
        }),
      ]
    }

    function titleOrder() {
      return screen
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent)
    }

    it("defaults to newest-first, matching the server's own order", () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: threeAlerts() },
        isLoading: false,
      })
      renderPage()

      expect(titleOrder()).toEqual(["New critical", "Mid medium", "Old low"])
    })

    it("sorts oldest-first when selected", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: threeAlerts() },
        isLoading: false,
      })
      renderPage()

      await userEvent.selectOptions(
        screen.getByRole("combobox"),
        "oldest"
      )

      expect(titleOrder()).toEqual(["Old low", "Mid medium", "New critical"])
    })

    it("sorts unread-first, newest within each group, when selected", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: threeAlerts() },
        isLoading: false,
      })
      renderPage()

      await userEvent.selectOptions(
        screen.getByRole("combobox"),
        "unreadFirst"
      )

      // Only "New critical" is unread -- it must lead regardless of the
      // other two reads' own createdAt order.
      expect(titleOrder()).toEqual(["New critical", "Mid medium", "Old low"])
    })

    it("sorts by severity (high to low) when selected", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: threeAlerts() },
        isLoading: false,
      })
      renderPage()

      await userEvent.selectOptions(
        screen.getByRole("combobox"),
        "severity"
      )

      expect(titleOrder()).toEqual(["New critical", "Mid medium", "Old low"])
    })

    // Round-1 review of PR #837: `alert.severity` is a free-form column
    // server-side (see this file's own icon-color fallback comment), so
    // an unrecognized value reaching the severity-sort comparator must
    // not produce `NaN` (an unguarded `SEVERITY_RANK` lookup returns
    // `undefined`, and `undefined - number` is `NaN`, which isn't
    // spec-guaranteed to sort consistently).
    it("treats an unrecognized severity as lowest-ranked instead of producing NaN", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          // Deliberately fed in the WRONG order relative to the expected
          // sorted result below -- an unguarded `SEVERITY_RANK` lookup
          // returns `undefined` for "unknown_severity", `undefined -
          // number` is `NaN`, and V8's sort leaves a NaN-comparator pair
          // in its ORIGINAL relative order. Asserting the fixed order
          // only proves the fallback works if the input starts reversed;
          // verified via negative control (reverting just the `?? ...`
          // fallback left this exact test passing when the array started
          // pre-sorted, and failing once flipped like this).
          data: [
            makeAlert({
              id: "a2",
              title: "Unrecognized severity",
              severity: "unknown_severity",
              createdAt: "2026-02-01T00:00:00.000Z",
            }),
            makeAlert({
              id: "a1",
              title: "Known high",
              severity: "high",
              createdAt: "2026-01-01T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })
      renderPage()

      await userEvent.selectOptions(screen.getByRole("combobox"), "severity")

      expect(titleOrder()).toEqual(["Known high", "Unrecognized severity"])
    })

    it("re-applies the active sort after the severity filter narrows the list", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({
              id: "a1",
              title: "Newer high",
              severity: "high",
              createdAt: "2026-06-01T00:00:00.000Z",
            }),
            makeAlert({
              id: "a2",
              title: "Older high",
              severity: "high",
              createdAt: "2026-01-01T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })
      renderPage()

      await userEvent.selectOptions(
        screen.getByRole("combobox"),
        "oldest"
      )
      await userEvent.click(screen.getByRole("button", { name: /riskLevel\.high/i }))

      expect(titleOrder()).toEqual(["Older high", "Newer high"])
    })
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

  // quality-bar-loop round 15 (accessibility): the "read" dimming used to
  // be a blanket opacity-60 on the WHOLE card, which live-measured a
  // read-state description at ~2.95:1 contrast, under WCAG AA's 4.5:1
  // floor for small text. Scoping the dimming to just the decorative icon
  // square keeps a visual "read" cue without ever touching the actual
  // text nodes' rendered opacity.
  it("does not dim the alert's text content when read, only the decorative icon", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ is_read: true })] },
      isLoading: false,
    })
    renderPage()

    expect(
      screen.getByText("Overdue actions exceeded threshold").closest(".opacity-60")
    ).toBeNull()
    expect(
      screen.getByText("12 actions are overdue.").closest(".opacity-60")
    ).toBeNull()
  })

  // Round 5 (security finding): mark-read/mark-all-read had no role gate
  // at all -- is_read is an org-wide field with no per-user scoping, so an
  // ungated mutation let any authenticated member (including a
  // low-privilege VIEWER) silently clear the unread state for the entire
  // org, potentially hiding a real critical alert from an Admin/Lead
  // Auditor.
  describe("role gating on mark-read actions (round 5 security fix)", () => {
    it("hides the per-row Mark as read button for a VIEWER", () => {
      mockRole = "VIEWER"
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ is_read: false })] },
        isLoading: false,
      })
      renderPage()

      // The "New" badge is purely informational, not an action -- it
      // should stay visible for a read-only viewer.
      expect(screen.getByText("organization.alerts.new")).toBeInTheDocument()
      expect(
        screen.queryByRole("button", {
          name: "organization.alerts.markAsRead",
        })
      ).not.toBeInTheDocument()
    })

    it("hides the bulk Mark all as read button for a VIEWER even with unread alerts present", () => {
      mockRole = "VIEWER"
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({ id: "a1", is_read: false }),
            makeAlert({ id: "a2", is_read: false }),
          ],
        },
        isLoading: false,
      })
      renderPage()

      expect(
        screen.queryByRole("button", {
          name: "organization.alerts.markAllRead",
        })
      ).not.toBeInTheDocument()
    })

    it("shows both mark-read affordances for an ADMIN", () => {
      mockRole = "ADMIN"
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ is_read: false })] },
        isLoading: false,
      })
      renderPage()

      expect(
        screen.getByRole("button", { name: "organization.alerts.markAsRead" })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", {
          name: "organization.alerts.markAllRead",
        })
      ).toBeInTheDocument()
    })

    it("shows both mark-read affordances for a LEAD_AUDITOR", () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ is_read: false })] },
        isLoading: false,
      })
      renderPage()

      expect(
        screen.getByRole("button", { name: "organization.alerts.markAsRead" })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", {
          name: "organization.alerts.markAllRead",
        })
      ).toBeInTheDocument()
    })
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): the severity
  // filter chips, "View KRI" link, and "Mark as read" button measured
  // 25-33px tall -- under the 44px touch-target guideline, and the
  // filter row had no wrap so the "Low" chip was completely unreachable
  // on mobile (right edge past the 375px viewport, no horizontal
  // scroll). Same h-11 fix already shipped on 4 sibling pages this
  // session, plus flex-wrap on the filter row.
  it("gives the severity filter chips and per-alert action links a 44px touch target, and lets the filter row wrap", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ is_read: false, kri_id: "kri-1" })] },
      isLoading: false,
    })
    const { container } = renderPage()

    expect(
      screen.getByRole("button", { name: /riskLevel\.low/i }).className
    ).toContain("h-11")
    expect(
      screen.getByRole("link", { name: "organization.alerts.viewKri" })
        .className
    ).toContain("h-11")
    expect(
      screen.getByRole("button", { name: "organization.alerts.markAsRead" })
        .className
    ).toContain("h-11")

    const filterRow = container.querySelector(".animate-slide-up")
    expect(filterRow?.className).toContain("flex-wrap")
  })

  // Round 9 (mobile, round-5 finding, stuck_streak 5): the bulk "Mark all
  // as read" button added in round 4 was h-9 (36px), under the 44px floor
  // every OTHER control on this page was already sized to clear -- added
  // after that convention was established on this same file, just missed.
  it("gives the bulk Mark all as read button a 44px touch target", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ is_read: false })] },
      isLoading: false,
    })
    renderPage()

    expect(
      screen.getByRole("button", { name: "organization.alerts.markAllRead" })
        .className
    ).toContain("h-11")
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

  // Round 8 (accessibility fix): mark-read previously had no success
  // feedback at all -- neither a toast nor an announcement -- and the
  // button unmounting on success silently relocated focus with nothing
  // to tell a keyboard/screen-reader user what happened.
  describe("mark-as-read success feedback and focus (round 8 accessibility fix)", () => {
    it("shows a success toast when marking as read succeeds", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert()] },
        isLoading: false,
      })
      mockMarkAlertRead.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      renderPage()
      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.markAsRead" })
      )

      await waitFor(() =>
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "organization.alerts.markReadSuccess"
        )
      )
    })

    it("does not show a success toast when marking as read fails", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert()] },
        isLoading: false,
      })
      mockMarkAlertRead.mockReturnValue({
        unwrap: () => Promise.reject({ data: { message: "failed" } }),
      })

      renderPage()
      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.markAsRead" })
      )

      await waitFor(() => expect(mockToastError).toHaveBeenCalled())
      expect(mockToastSuccess).not.toHaveBeenCalled()
    })

    it("moves focus to the alert row (not lost to the document body) after marking it read", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({ id: "a1", title: "First alert", is_read: false }),
          ],
        },
        isLoading: false,
      })
      mockMarkAlertRead.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      renderPage()
      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.markAsRead" })
      )

      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
      expect(document.activeElement).not.toBe(document.body)
      expect(document.activeElement?.textContent).toContain("First alert")
    })
  })

  // quality-bar-loop round 3 (efficiency, round-1 finding): the
  // severity-count summary and filtered list were recomputed on every
  // render, including unrelated re-renders elsewhere in the same
  // component -- now memoized. Marking one alert read (a real,
  // unrelated mutation-driven re-render) must not corrupt or freeze the
  // OTHER alert's still-correct severity count.
  it("keeps the severity counts correct after an unrelated mark-as-read re-render", async () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", severity: "critical", is_read: false }),
          makeAlert({ id: "a2", severity: "high", is_read: false }),
        ],
      },
      isLoading: false,
    })
    mockMarkAlertRead.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    const { rerender } = renderPage()

    // criticalCount=1, highCount=1 -- both filter chips show "1".
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2)

    const [markReadButton] = screen.getAllByRole("button", {
      name: "organization.alerts.markAsRead",
    })
    await userEvent.click(markReadButton)

    await waitFor(() => expect(mockMarkAlertRead).toHaveBeenCalled())
    // Counts are derived from allAlerts (unaffected by the mutation
    // itself in this mocked setup, since is_read isn't refetched) --
    // still correct, not frozen at a stale value or corrupted.
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2)

    // The counterpart risk of memoizing these: an empty/wrong
    // dependency array would freeze the counts instead of just
    // recomputing them needlessly. Rerendering with genuinely new
    // alert data must still update the counts, not serve a stale
    // memoized value.
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", severity: "critical", is_read: false }),
          makeAlert({ id: "a2", severity: "critical", is_read: false }),
        ],
      },
      isLoading: false,
    })
    rerender(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    )
    expect(screen.getByText("2")).toBeInTheDocument()
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

  // Round-4 review finding: the mutation hook's own shared `isLoading`
  // used to disable EVERY unread alert's "Mark as read" button the moment
  // any one of them was clicked, with no way to tell which one was
  // actually in flight. Per-id tracking means only the clicked row shows
  // as busy.
  describe("per-row mark-as-read loading state (round 4)", () => {
    it("only disables the clicked alert's button, not every unread alert's button", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({ id: "a1", is_read: false }),
            makeAlert({ id: "a2", is_read: false }),
          ],
        },
        isLoading: false,
      })
      // Never resolves -- keeps a1's button in the "marking read" state
      // long enough to assert a2's button is unaffected.
      mockMarkAlertRead.mockReturnValue({ unwrap: () => new Promise(() => {}) })

      renderPage()
      const [buttonA1, buttonA2] = screen.getAllByRole("button", {
        name: "organization.alerts.markAsRead",
      })
      await userEvent.click(buttonA1)

      expect(buttonA1).toBeDisabled()
      expect(buttonA2).not.toBeDisabled()
    })
  })

  // Round 14 (efficiency fix): the row list used to render every card
  // inline with no memoization boundary, so a single row's state change
  // (e.g. markingReadIds flipping for one id) re-rendered and
  // re-formatted EVERY currently-filtered row, not just the changed one.
  // formatLocaleDate is called once per row per render, so counting its
  // per-alert call volume before/after an unrelated row's click is a
  // direct, real (not approximated) measure of whether the other row
  // actually re-rendered.
  describe("row-level memoization (round 14 efficiency fix)", () => {
    it("does not re-render an unrelated row when only one row's mark-as-read state changes", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({
              id: "a1",
              title: "First alert",
              is_read: false,
              createdAt: "2026-01-01T00:00:00.000Z",
            }),
            makeAlert({
              id: "a2",
              title: "Second alert",
              is_read: false,
              createdAt: "2026-02-02T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })
      // Never resolves -- keeps a1 in the "marking read" state long
      // enough to observe whether a2 re-rendered in response.
      mockMarkAlertRead.mockReturnValue({ unwrap: () => new Promise(() => {}) })

      renderPage()
      const callsForA2Before = formatLocaleDateSpy.mock.calls.filter(
        (call) => call[0] === "2026-02-02T00:00:00.000Z"
      ).length
      expect(callsForA2Before).toBeGreaterThan(0)

      // Not positional (`getAllByRole(...)[0]`) -- the default "newest
      // first" sort renders a2 before a1 in the DOM, so index 0 is a2's
      // button, not a1's. Scoped explicitly to a1's own row via its
      // title so this test clicks the alert it actually names.
      const a1Row = screen
        .getByRole("heading", { level: 3, name: "First alert" })
        .closest('[tabindex="-1"]') as HTMLElement
      await userEvent.click(
        within(a1Row).getByRole("button", {
          name: "organization.alerts.markAsRead",
        })
      )

      // a1's own row re-renders (its isMarkingRead prop changed) -- but
      // a2's props are unchanged, so a memoized AlertRow must skip it.
      // Without React.memo, this click would re-render (and re-format)
      // every row, including a2's.
      const callsForA2After = formatLocaleDateSpy.mock.calls.filter(
        (call) => call[0] === "2026-02-02T00:00:00.000Z"
      ).length
      expect(callsForA2After).toBe(callsForA2Before)
    })
  })

  // Round-4 industry-standards finding: no bulk action existed at all --
  // every alert had to be marked read one at a time, with no way to clear
  // a backlog in one action.
  describe("mark all as read (round 4)", () => {
    it("shows a mark-all-read button only when there are unread alerts", () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ is_read: true })] },
        isLoading: false,
      })
      renderPage()

      expect(
        screen.queryByRole("button", {
          name: "organization.alerts.markAllRead",
        })
      ).not.toBeInTheDocument()
    })

    it("marks every currently-visible unread alert as read, but not already-read ones", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({ id: "a1", is_read: false }),
            makeAlert({ id: "a2", is_read: false }),
            makeAlert({ id: "a3", is_read: true }),
          ],
        },
        isLoading: false,
      })
      mockMarkAlertRead.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      renderPage()
      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.markAllRead" })
      )

      await waitFor(() => expect(mockMarkAlertRead).toHaveBeenCalledTimes(2))
      expect(mockMarkAlertRead).toHaveBeenCalledWith("a1")
      expect(mockMarkAlertRead).toHaveBeenCalledWith("a2")
      expect(mockMarkAlertRead).not.toHaveBeenCalledWith("a3")
    })

    it("respects the active severity filter -- only marks alerts currently visible under it", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({ id: "a1", severity: "critical", is_read: false }),
            makeAlert({ id: "a2", severity: "low", is_read: false }),
          ],
        },
        isLoading: false,
      })
      mockMarkAlertRead.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      renderPage()
      await userEvent.click(
        screen.getByRole("button", { name: /riskLevel\.critical/ })
      )
      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.markAllRead" })
      )

      await waitFor(() => expect(mockMarkAlertRead).toHaveBeenCalledTimes(1))
      expect(mockMarkAlertRead).toHaveBeenCalledWith("a1")
      expect(mockMarkAlertRead).not.toHaveBeenCalledWith("a2")
    })

    // Round-4 review finding: the button's visibility used to be gated on
    // the org-wide unread count while the action only ever touches the
    // filtered list -- a filter that hides every unread alert (while
    // unread ones exist under a DIFFERENT severity) left the button
    // visible but clicking it silently did nothing.
    it("shows the mark-all-read button with no filter active when any alert is unread", () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({ id: "a1", severity: "critical", is_read: true }),
            makeAlert({ id: "a2", severity: "low", is_read: false }),
          ],
        },
        isLoading: false,
      })

      renderPage()
      // No filter active: alerts === allAlerts, so this baseline case
      // can't itself distinguish the fix from the pre-fix bug -- see the
      // next test for the actual regression guard (filtered to a
      // severity with zero unread, while another severity still has some).
      expect(
        screen.getByRole("button", { name: "organization.alerts.markAllRead" })
      ).toBeInTheDocument()
    })

    it("hides the mark-all-read button once filtered to a severity where every visible alert is already read", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({ id: "a1", severity: "critical", is_read: true }),
            makeAlert({ id: "a2", severity: "low", is_read: false }),
          ],
        },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(
        screen.getByRole("button", { name: /riskLevel\.critical/ })
      )

      // Filtered to critical, whose only alert (a1) is already read -- the
      // button must NOT be visible even though a2 (low, unread) exists.
      expect(
        screen.queryByRole("button", { name: "organization.alerts.markAllRead" })
      ).not.toBeInTheDocument()
    })

    it("shows a partial-failure toast when some alerts fail to mark read, without blocking the rest", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({ id: "a1", is_read: false }),
            makeAlert({ id: "a2", is_read: false }),
          ],
        },
        isLoading: false,
      })
      mockMarkAlertRead.mockImplementation((id: string) => ({
        unwrap: () =>
          id === "a1"
            ? Promise.reject({ data: { message: "failed" } })
            : Promise.resolve({}),
      }))

      renderPage()
      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.markAllRead" })
      )

      await waitFor(() => expect(mockToastError).toHaveBeenCalled())
      expect(mockMarkAlertRead).toHaveBeenCalledWith("a1")
      expect(mockMarkAlertRead).toHaveBeenCalledWith("a2")
      expect(mockToastSuccess).not.toHaveBeenCalled()
    })

    // Round 8 (accessibility fix): same unmount-focus-loss issue as the
    // per-row button -- once every visible alert is marked read, this
    // button itself disappears, and there was previously nothing telling
    // a keyboard/screen-reader user the bulk action had succeeded.
    it("shows a success toast and moves focus to the heading after a full-success mark-all-read", async () => {
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            makeAlert({ id: "a1", is_read: false }),
            makeAlert({ id: "a2", is_read: false }),
          ],
        },
        isLoading: false,
      })
      mockMarkAlertRead.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      renderPage()
      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.markAllRead" })
      )

      await waitFor(() =>
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "organization.alerts.markAllReadSuccess"
        )
      )
      expect(mockToastError).not.toHaveBeenCalled()
      expect(document.activeElement).not.toBe(document.body)
      expect(document.activeElement?.tagName).toBe("H1")
    })
  })

  // Round-4 UX finding: the error state had no way to recover short of a
  // full page reload -- a real backend 429 hit this state live with no
  // retry action anywhere.
  it("shows a retry button on the error state that refetches the alerts list", async () => {
    const mockRefetch = vi.fn()
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
      refetch: mockRefetch,
    })
    renderPage()

    await userEvent.click(
      screen.getByRole("button", { name: "organization.alerts.retry" })
    )

    expect(mockRefetch).toHaveBeenCalled()
  })

  // Round-4 UX finding: no unread indicator existed anywhere on the page.
  it("shows an unread count alongside the active-alerts stat", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", is_read: false }),
          makeAlert({ id: "a2", is_read: true }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    expect(
      screen.getByText("organization.alerts.unreadCount")
    ).toBeInTheDocument()
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

    // Round-4 UX finding added an unread-count fragment as a sibling text
    // node inside the same <p>, so its full textContent is no longer just
    // the activeCount string -- match on the containing paragraph instead
    // of an exact equal string.
    expect(
      screen.getByText((_, element) =>
        element?.tagName === "P" &&
        (element.textContent ?? "").includes(
          "organization.alerts.activeCount"
        )
      )
    ).toBeInTheDocument()
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

  // Raw <button>s default to type="submit" per HTML spec, which is a latent
  // bug if this page ever ends up inside a <form>. Every button here (the
  // severity filter chips and the per-alert "Mark as read" button) is a
  // raw <button>.
  it("gives every button an explicit type", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ is_read: false })] },
      isLoading: false,
    })
    renderPage()

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })

  // Round 7 (industry-standards): the alert lifecycle was binary is_read
  // with no way to permanently clear noise -- unlike GitHub Notifications
  // (mark-done) or PagerDuty (resolve). useDeleteAlertMutation already
  // existed (a real server endpoint) but was never wired up.
  describe("dismiss an alert (round 7 fix)", () => {
    it("shows a Dismiss button for ADMIN, and calls the delete mutation on confirm", async () => {
      mockRole = "ADMIN"
      mockDeleteAlert.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true, message: "ok" }),
      })
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ id: "alert-1" })] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.dismiss" })
      )
      await userEvent.click(
        within(screen.getByTestId("delete-alert-modal")).getByRole("button", {
          name: "organization.alerts.dismiss",
        })
      )

      await waitFor(() =>
        expect(mockDeleteAlert).toHaveBeenCalledWith("alert-1")
      )
    })

    it("hides the Dismiss button for a VIEWER", () => {
      mockRole = "VIEWER"
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert()] },
        isLoading: false,
      })
      renderPage()

      expect(
        screen.queryByRole("button", { name: "organization.alerts.dismiss" })
      ).not.toBeInTheDocument()
    })

    it("shows a success toast after a successful dismiss", async () => {
      mockRole = "ADMIN"
      mockDeleteAlert.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true, message: "ok" }),
      })
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ id: "alert-1" })] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.dismiss" })
      )
      await userEvent.click(
        within(screen.getByTestId("delete-alert-modal")).getByRole("button", {
          name: "organization.alerts.dismiss",
        })
      )

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith(
          "organization.alerts.dismissSuccess"
        )
      )
    })

    it("shows an error toast when the dismiss mutation fails", async () => {
      mockRole = "ADMIN"
      mockDeleteAlert.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: "Alert not found" } }),
      })
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ id: "alert-1" })] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.dismiss" })
      )
      await userEvent.click(
        within(screen.getByTestId("delete-alert-modal")).getByRole("button", {
          name: "organization.alerts.dismiss",
        })
      )

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("Alert not found")
      )
    })

    it("shows the Dismiss button for both read and unread alerts, unlike Mark as read", () => {
      mockRole = "ADMIN"
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ id: "alert-1", is_read: true })] },
        isLoading: false,
      })
      renderPage()

      // A read alert has no "Mark as read" button, but dismiss should
      // still be reachable -- there's no reason to force marking read
      // before you can clear an alert entirely.
      expect(
        screen.queryByRole("button", { name: "organization.alerts.markAsRead" })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "organization.alerts.dismiss" })
      ).toBeInTheDocument()
    })

    // Round 11 (UX finding): the confirm modal used to always show the
    // shared DeleteAlertModal's hardcoded "Delete" copy no matter what the
    // trigger/toast/title around it called the action -- a genuine
    // terminology flip mid-flow, live-confirmed as confusing right before
    // an irreversible action. Passing confirmLabel/loadingLabel keeps the
    // modal's own copy consistent with every other "Dismiss" affordance
    // on this page.
    it("passes Dismiss-consistent confirm/loading labels to the shared delete modal, not the default Delete copy", async () => {
      mockRole = "ADMIN"
      mockIsDeletingAlert = true
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [makeAlert({ id: "alert-1" })] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: "organization.alerts.dismiss" })
      )

      expect(
        screen.getByRole("button", { name: "organization.alerts.dismissing" })
      ).toBeInTheDocument()
    })
  })
})
