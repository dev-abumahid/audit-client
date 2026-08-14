import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useNavigate } from "react-router"
import KriDashboardPage from "./KriDashboardPage"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// This file never triggers src/i18n/i18n.ts's side-effect init, so
// react-i18next's real t() falls back to returning the raw key for every
// other assertion here -- except when a call passes `defaultValue` (as the
// frequency fix now does, per issue #360's independent-review follow-up), in
// which case the uninitialized stub returns the defaultValue instead of the
// key. Since KriDashboardPage.tsx passes `{ defaultValue: kri.frequency }`
// and defaultValue always mirrors kri.frequency, the plain fallback can no
// longer tell "translated" apart from "still raw" for the frequency keys
// specifically -- both would render "quarterly". Overriding just those keys
// with their real en.json translation (distinct from the raw enum value)
// restores that ability; every other key still falls back to itself
// unchanged. Same technique as CompliancePage.test.tsx.
const FREQUENCY_TRANSLATIONS: Record<string, string> = {
  "organization.kri.frequency.daily": "Daily",
  "organization.kri.frequency.weekly": "Weekly",
  "organization.kri.frequency.monthly": "Monthly",
  "organization.kri.frequency.quarterly": "Quarterly",
}
// Controllable `i18n.language` for the locale-formatting test below, same
// technique as AdminTransactions.test.tsx/AdminOrganization.test.tsx. Kept at
// "en" by default so existing assertions in this file are unaffected.
let mockLanguage = "en"
const tCalls: unknown[][] = []
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => {
        // Round-1 review of PR #846: records every t() call (args
        // included) so the crafted-?status=constructor regression test
        // below can assert on exactly what was interpolated into
        // filteredByStatus's `status` option, without changing this
        // mock's actual return value for every other existing assertion
        // in this file.
        tCalls.push([key, opts])
        return (
          FREQUENCY_TRANSLATIONS[key] ?? (opts?.defaultValue as string) ?? key
        )
      },
      i18n: { language: mockLanguage },
    }),
  }
})

// The trend chart's recorded_at labels are fed to recharts as XAxis
// `dataKey` values, which recharts never renders to real DOM text under
// jsdom (see the 0x0-layout note on the "renders a chart" test below) -- so
// there's no rendered text to assert a locale-formatted date against
// directly. Spying on the shared formatLocaleDate helper (real
// implementation preserved via importOriginal) instead confirms
// KriDashboardPage.tsx threads `i18n.language` through to it correctly,
// same bug class as AdminOrganization.tsx/AdminOverview.tsx/
// AdminTransactions.tsx (#364), now also fixed here.
const mockFormatLocaleDate = vi.hoisted(() => vi.fn())
vi.mock("@/utils/formatDate", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/utils/formatDate")>()
  mockFormatLocaleDate.mockImplementation(mod.formatLocaleDate)
  return {
    ...mod,
    formatLocaleDate: (...args: Parameters<typeof mod.formatLocaleDate>) =>
      mockFormatLocaleDate(...args),
  }
})

// aexa-frontend#217 -- role hook mocked per-test via this mutable holder,
// same convention as RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockUseGetAllKriQuery = vi.fn()
const mockUseGetAllRisksQuery = vi.fn()
const mockCreateKri = vi.fn()
const mockSubmitKriValue = vi.fn()
const mockUpdateKri = vi.fn()
const mockDeleteKri = vi.fn()
const mockUseGetKriReadingsQuery = vi.fn()

vi.mock("@/redux/apis/organization/kri.api", () => ({
  useGetAllKriQuery: (...args: unknown[]) => mockUseGetAllKriQuery(...args),
  useCreateNewKriMutation: () => [mockCreateKri],
  useSubmitKriValueMutation: () => [mockSubmitKriValue],
  useUpdateKriMutation: () => [mockUpdateKri],
  useDeleteKriMutation: () => [mockDeleteKri],
  useGetKriReadingsQuery: (...args: unknown[]) =>
    mockUseGetKriReadingsQuery(...args),
}))

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
}))

// aexa-frontend#530: drives the new per-card alert-count badge.
const mockUseGetAllAlertsQuery = vi.fn()
vi.mock("@/redux/apis/organization/alert.api", () => ({
  useGetAllAlertsQuery: (...args: unknown[]) =>
    mockUseGetAllAlertsQuery(...args),
}))

// aexa-frontend#530: the KRI name is now scrollable-to via a ?highlight=
// URL param (from AlertsPage's "View KRI" link), so this needs a Router
// context -- same convention as InspectionTable.test.tsx's renderTable().
// initialEntries lets the highlight tests below drive the ?highlight= param
// through a real URL, same as the rest of the app would.
function renderPage(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <KriDashboardPage />
    </MemoryRouter>
  )
}

// aexa-frontend#530 round 3: a real client-side re-navigation to the exact
// same `?highlight=` URL (e.g. two different alerts referencing the same
// KRI, clicked one after another without a full page reload) must still
// re-trigger the scroll/highlight -- a plain "have I already highlighted
// this id" ref would treat it as a no-op. This harness drives that
// re-navigation the same way AlertsPage's <Link> would, without unmounting
// KriDashboardPage in between.
function ReNavigateHarness({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <div>
      <button onClick={() => navigate(to)}>renavigate</button>
      <KriDashboardPage />
    </div>
  )
}

// jsdom doesn't implement Element.scrollIntoView at all (not even as a
// no-op) -- the highlight effect below would throw without this stub.
Element.prototype.scrollIntoView = vi.fn()

function makeKri(overrides = {}) {
  return {
    id: "kri-1",
    risk_id: "risk-1",
    name: "Overdue actions",
    unit: "%",
    current_value: 50,
    alert_threshold: 80,
    target_value: 10,
    frequency: "monthly",
    status: "OK",
    last_measured_at: null,
    overdue: false,
    ...overrides,
  }
}

function makeRisk(overrides = {}) {
  return { id: "risk-1", name: "Fire safety risk", ...overrides }
}

describe("KriDashboardPage", () => {
  beforeEach(() => {
    mockRole = "ADMIN"
    mockUseGetAllKriQuery.mockReset()
    mockUseGetAllRisksQuery.mockReset()
    mockUseGetAllAlertsQuery.mockReset()
    mockCreateKri.mockReset()
    mockSubmitKriValue.mockReset()
    mockUpdateKri.mockReset()
    mockDeleteKri.mockReset()
    mockUseGetKriReadingsQuery.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockLanguage = "en"
    tCalls.length = 0
    mockFormatLocaleDate.mockClear()
    ;(Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear()

    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk()] },
    })
    mockUseGetAllAlertsQuery.mockReturnValue({ data: { data: [] } })
    mockUseGetKriReadingsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
  })

  it("shows New KRI and update-value controls for an ADMIN, plus the read-only trend button", () => {
    mockRole = "ADMIN"
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText("organization.kri.newKri")
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pencil"))
    ).toBe(true)
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-chart-line"))
    ).toBe(true)
  })

  // Fresh full-panel re-score (resilience finding): a failed risks/alerts
  // fetch fell through to the same `?? []` empty-array fallback every KRI
  // card already uses when a risk/alert genuinely doesn't exist -- a real
  // outage looked identical to "nothing to show," with no indication card
  // data (risk names, alert counts) might be incomplete.
  describe("secondary-query resilience (fresh full-panel finding)", () => {
    it("shows a warning banner when the risks fetch fails, without blocking the KRI list itself", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUseGetAllRisksQuery.mockReturnValue({
        data: undefined,
        isError: true,
      })

      renderPage()

      expect(
        screen.getByText("organization.kri.relatedDataLoadError")
      ).toBeInTheDocument()
      // The KRI list itself still rendered -- this is a non-blocking
      // notice, not the full-page error state.
      expect(
        screen.queryByText("organization.kri.loadError")
      ).not.toBeInTheDocument()
    })

    it("shows a warning banner when the alerts fetch fails", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: undefined,
        isError: true,
      })

      renderPage()

      expect(
        screen.getByText("organization.kri.relatedDataLoadError")
      ).toBeInTheDocument()
    })

    it("shows no warning banner when risks and alerts both load successfully", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.queryByText("organization.kri.relatedDataLoadError")
      ).not.toBeInTheDocument()
    })
  })

  it("hides New KRI and update-value controls for a VIEWER but keeps the trend button", () => {
    mockRole = "VIEWER"
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByText("organization.kri.newKri")
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pencil"))
    ).toBe(false)
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-chart-line"))
    ).toBe(true)
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): the trend-view,
  // update-value, and New KRI buttons measured well under the 44px
  // touch-target guideline (22x22px and 343x32px respectively) -- same
  // h-11/h-11-w-11 fix already shipped on RiskMatrixPage/
  // CorrelationMatrixPage for their own identical icon-button controls.
  it("gives the trend-view, update-value, and New KRI buttons a 44px touch target", () => {
    mockRole = "ADMIN"
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByTitle("organization.kri.trend.viewTooltip").className
    ).toContain("h-11")
    expect(
      screen.getByTitle("organization.kri.updateValueTooltip").className
    ).toContain("h-11")
    expect(
      screen.getByRole("button", { name: /organization\.kri\.newKri/i })
        .className
    ).toContain("h-11")
  })

  it("gives the New KRI modal's close button a 44px touch target", async () => {
    mockRole = "ADMIN"
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", { name: /organization\.kri\.newKri/i })
    )

    const closeButton = screen
      .getAllByRole("button", { name: "organization.kri.cancel" })
      .find((b) => b.querySelector("svg.lucide-x"))
    expect(closeButton).toBeDefined()
    expect(closeButton!.className).toContain("h-11")
  })

  it("hides write controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByText("organization.kri.newKri")
    ).not.toBeInTheDocument()
  })

  it("shows a loading state", () => {
    mockUseGetAllKriQuery.mockReturnValue({ data: undefined, isLoading: true })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows an error state when the KRI list fails to load", () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
    })
    renderPage()
    expect(screen.getByText("organization.kri.loadError")).toBeInTheDocument()
  })

  it("shows the empty state when there are no KRIs", () => {
    renderPage()
    expect(screen.getByText("organization.kri.noKris")).toBeInTheDocument()
  })

  // Round 8 (UX finding): the empty state was a bare line of text with no
  // icon and no way to act on it -- a new org with zero KRIs had no
  // visible next step besides scrolling back up to the header button.
  describe("empty-state call to action (round 8 UX fix)", () => {
    it("shows a create-first-KRI CTA for a write-capable role", () => {
      mockRole = "ADMIN"
      renderPage()

      expect(
        screen.getByRole("button", {
          name: "organization.kri.createFirstKri",
        })
      ).toBeInTheDocument()
    })

    it("hides the CTA for a read-only role", () => {
      mockRole = "VIEWER"
      renderPage()

      expect(
        screen.queryByRole("button", {
          name: "organization.kri.createFirstKri",
        })
      ).not.toBeInTheDocument()
    })

    it("hides the CTA while a ?status= filter is active, since there's nothing to create matching an empty filtered view", () => {
      mockRole = "ADMIN"
      renderPage("/?status=ALERT")

      expect(
        screen.queryByRole("button", {
          name: "organization.kri.createFirstKri",
        })
      ).not.toBeInTheDocument()
    })

    it("opens the New KRI modal when the empty-state CTA is clicked", async () => {
      mockRole = "ADMIN"
      renderPage()

      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.kri.createFirstKri",
        })
      )

      expect(
        screen.getByRole("dialog", { name: "organization.kri.newKri" })
      ).toBeInTheDocument()
    })
  })

  // quality-bar-loop round 14 (industry-standards): the dashboard's
  // "KRI Alerts" card now links here with ?status=ALERT -- this narrows
  // the card grid to ALERT-status KRIs while the summary chips above stay
  // computed from the full list.
  describe("?status= filter from the dashboard's KRI Alerts card (round 14)", () => {
    it("shows only ALERT-status KRIs and a clear-filter link when ?status=ALERT is present", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: {
          data: [
            makeKri({ id: "k1", name: "Alert KRI", status: "ALERT" }),
            makeKri({ id: "k2", name: "OK KRI", status: "OK" }),
          ],
        },
        isLoading: false,
      })

      renderPage("/?status=ALERT")

      expect(screen.getByText("Alert KRI")).toBeInTheDocument()
      expect(screen.queryByText("OK KRI")).not.toBeInTheDocument()
      expect(
        screen.getByText("organization.kri.filteredByStatus")
      ).toBeInTheDocument()
      expect(
        screen.getByRole("link", { name: "organization.kri.clearFilter" })
      ).toHaveAttribute("href", "/organization/kri")
    })

    it("does not narrow the list or show a clear-filter link with no ?status= param", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: {
          data: [
            makeKri({ id: "k1", name: "Alert KRI", status: "ALERT" }),
            makeKri({ id: "k2", name: "OK KRI", status: "OK" }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      expect(screen.getByText("Alert KRI")).toBeInTheDocument()
      expect(screen.getByText("OK KRI")).toBeInTheDocument()
      expect(
        screen.queryByText("organization.kri.filteredByStatus")
      ).not.toBeInTheDocument()
    })

    // Round-1 review of PR #846: the recognized/unrecognized status check
    // originally used `statusParam in KRI_STATUS_META`, which walks the
    // prototype chain -- a crafted ?status=constructor matched the
    // inherited Object.prototype.constructor key and would have rendered
    // something other than the literal "constructor" passthrough the
    // original ternary chain produced for any unrecognized value.
    it("passes an unrecognized ?status= value through as-is, even a prototype-chain name like 'constructor'", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      renderPage("/?status=constructor")

      const filteredByStatusCall = tCalls.find(
        (call) => call[0] === "organization.kri.filteredByStatus"
      )
      expect(filteredByStatusCall).toBeDefined()
      expect(
        (filteredByStatusCall?.[1] as { status?: unknown })?.status
      ).toBe("constructor")
    })

    it("shows the empty state, not a crash, when the status filter matches nothing", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "k1", name: "OK KRI", status: "OK" })] },
        isLoading: false,
      })

      renderPage("/?status=ALERT")

      expect(screen.getByText("organization.kri.noKris")).toBeInTheDocument()
    })
  })

  it("renders a KRI with its real risk name and status", () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri({ status: "ALERT" })] },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText("Overdue actions")).toBeInTheDocument()
    expect(screen.getByText(/Fire safety risk/)).toBeInTheDocument()
    // Regression (audit round 3): the per-KRI status badge used to render
    // the raw `kri.status` enum value ("ALERT") instead of going through
    // t(), unlike the summary cards above it which already used
    // organization.kri.status.alert/warning/ok. i18n isn't loaded in this
    // test, so t() falls back to the raw key -- asserting the key (not the
    // enum value) proves the badge now goes through translation too.
    expect(
      screen.getAllByText("organization.kri.status.alert").length
    ).toBeGreaterThan(0)
    expect(screen.queryByText("ALERT")).not.toBeInTheDocument()
  })

  // quality-bar-loop round 3 (efficiency, round-1 finding): the risk
  // lookup, alert-count summaries, and status filter were all recomputed
  // on every render including unrelated state changes elsewhere in the
  // same component (e.g. every keystroke in the New KRI form) -- now
  // memoized. Typing in that form is exactly the unrelated re-render this
  // used to redo everything on; this guards against a wrong dependency
  // array quietly making the memoized values go stale instead.
  it("keeps showing the correct risk name and summary counts while typing in the New KRI form", async () => {
    mockRole = "ADMIN"
    mockUseGetAllKriQuery.mockReturnValue({
      data: {
        data: [
          makeKri({ id: "kri-1", status: "ALERT" }),
          makeKri({ id: "kri-2", status: "OK", name: "Second KRI" }),
        ],
      },
      isLoading: false,
    })

    function alertSummaryChipCount(container: HTMLElement) {
      return container
        .querySelector(".border-risk-critical\\/30")
        ?.textContent?.match(/\d+/)?.[0]
    }

    const { container, rerender } = renderPage()
    expect(screen.getAllByText(/Fire safety risk/).length).toBeGreaterThan(0)
    expect(alertSummaryChipCount(container)).toBe("1")

    await userEvent.click(
      screen.getByRole("button", { name: /organization\.kri\.newKri/i })
    )
    await userEvent.type(
      screen.getByPlaceholderText("organization.kri.form.namePlaceholder"),
      "Unrelated typing"
    )

    expect(screen.getAllByText(/Fire safety risk/).length).toBeGreaterThan(0)
    expect(screen.getByText("Second KRI")).toBeInTheDocument()
    expect(alertSummaryChipCount(container)).toBe("1")

    // The counterpart risk of memoizing these: an empty/wrong dependency
    // array would freeze the count instead of just recomputing it
    // needlessly. Rerendering with genuinely new kri data must still
    // update the chip, not serve a stale memoized value.
    mockUseGetAllKriQuery.mockReturnValue({
      data: {
        data: [
          makeKri({ id: "kri-1", status: "ALERT" }),
          makeKri({ id: "kri-2", status: "ALERT", name: "Second KRI" }),
        ],
      },
      isLoading: false,
    })
    rerender(
      <MemoryRouter>
        <KriDashboardPage />
      </MemoryRouter>
    )
    expect(alertSummaryChipCount(container)).toBe("2")
  })

  // Regression (issue #360): kri.frequency (raw enum: daily/weekly/monthly/
  // quarterly) rendered unmodified next to the risk name, unlike the
  // create-form's dropdown which already goes through
  // organization.kri.frequency.<value>. Asserting the real translated text
  // (not the raw enum value) proves the card now goes through the same
  // translation the form uses.
  it("renders the KRI's frequency through the same i18n key convention as the create form's dropdown, not the raw enum value", () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri({ frequency: "quarterly" })] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText((_, el) => el?.textContent === "Fire safety risk · Quarterly")
    ).toBeInTheDocument()
    expect(
      screen.queryByText((_, el) => el?.textContent === "Fire safety risk · quarterly")
    ).not.toBeInTheDocument()
  })

  // Regression follow-up (found in independent review): kri.frequency is an
  // open string field, not a closed enum -- only daily/weekly/monthly/
  // quarterly have translations. An unexpected/legacy value must still
  // render as itself (via the `defaultValue` fallback) rather than a raw
  // i18n key path like "organization.kri.frequency.biweekly".
  it("falls back to the raw value for a frequency with no matching translation key", () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri({ frequency: "biweekly" })] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText((_, el) => el?.textContent === "Fire safety risk · biweekly")
    ).toBeInTheDocument()
    expect(
      screen.queryByText((_, el) =>
        el?.textContent === "Fire safety risk · organization.kri.frequency.biweekly"
      )
    ).not.toBeInTheDocument()
  })

  it("counts KRIs by status into the summary cards", () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: {
        data: [
          makeKri({ id: "k1", status: "ALERT" }),
          makeKri({ id: "k2", status: "WARNING" }),
          makeKri({ id: "k3", status: "OK" }),
          makeKri({ id: "k4", status: "OK" }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    // Summary labels ("Alert"/"Warning"/"OK") also appear as per-card status
    // badges (audit round 3 fixed the badges to go through the same i18n
    // keys as the summary, so both now render identical key text) -- scope
    // to the summary row specifically by its text-muted-foreground class.
    const alertLabels = screen.getAllByText("organization.kri.status.alert")
    const summaryAlertLabel = alertLabels.find((el) =>
      el.className.includes("text-muted-foreground")
    )
    expect(summaryAlertLabel?.previousSibling).toHaveTextContent("1")

    const warningLabels = screen.getAllByText(
      "organization.kri.status.warning"
    )
    const summaryWarningLabel = warningLabels.find((el) =>
      el.className.includes("text-muted-foreground")
    )
    expect(summaryWarningLabel?.previousSibling).toHaveTextContent("1")

    const okLabels = screen.getAllByText("organization.kri.status.ok")
    const summaryOkLabel = okLabels.find(
      (el) => el.className.includes("text-muted-foreground")
    )
    expect(summaryOkLabel?.previousSibling).toHaveTextContent("2")
  })

  it("creates a new KRI with the selected risk_id and shows a success toast", async () => {
    mockCreateKri.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.newKri/i }))

    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.namePlaceholder"), "New KRI")
    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.unitPlaceholder"), "count")
    const [riskSelect] = screen.getAllByRole("combobox")
    await userEvent.selectOptions(riskSelect, "risk-1")
    // target_value/alert_threshold both default to 0 — set them apart so
    // this test isn't accidentally exercising the equal-values guard below.
    // Order in the form: Current Value, Alert Threshold, Target.
    const numberInputs = screen.getAllByRole("spinbutton")
    await userEvent.type(numberInputs[2], "10")
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.createKri/i }))

    await waitFor(() =>
      expect(mockCreateKri).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New KRI", risk_id: "risk-1" })
      )
    )
    expect(mockToastSuccess).toHaveBeenCalledWith("organization.kri.toast.created")
  })

  // KRI owner field (industry-standards finding, round 20): a filled-in
  // owner is sent trimmed; a left-blank owner is omitted entirely (not sent
  // as an empty string) so an unset owner reads as "no owner" server-side.
  it("sends a trimmed owner when supplied", async () => {
    mockCreateKri.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.newKri/i }))

    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.namePlaceholder"), "New KRI")
    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.unitPlaceholder"), "count")
    await userEvent.type(
      screen.getByPlaceholderText("organization.kri.form.ownerPlaceholder"),
      "  Jane Procurement  "
    )
    const [riskSelect] = screen.getAllByRole("combobox")
    await userEvent.selectOptions(riskSelect, "risk-1")
    const numberInputs = screen.getAllByRole("spinbutton")
    await userEvent.type(numberInputs[2], "10")
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.createKri/i }))

    await waitFor(() =>
      expect(mockCreateKri).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "Jane Procurement" })
      )
    )
  })

  // Independent review of PR #871: the earlier version of this test only
  // covered the "owner supplied" half -- it never actually left the field
  // blank and asserted the create payload omits the key entirely (rather
  // than sending an empty string), which is the exact behavior
  // handleSave/KriDashboardPage.tsx relies on to keep a never-set owner as
  // NULL server-side instead of "".
  it("omits owner entirely from the create payload when left blank", async () => {
    mockCreateKri.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.newKri/i }))

    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.namePlaceholder"), "New KRI")
    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.unitPlaceholder"), "count")
    const [riskSelect] = screen.getAllByRole("combobox")
    await userEvent.selectOptions(riskSelect, "risk-1")
    const numberInputs = screen.getAllByRole("spinbutton")
    await userEvent.type(numberInputs[2], "10")
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.createKri/i }))

    await waitFor(() => expect(mockCreateKri).toHaveBeenCalled())
    const payload = mockCreateKri.mock.calls[0][0]
    // `owner: undefined` (rather than an omitted key) is what
    // KriDashboardPage.tsx's handleSave actually produces -- RTK Query's
    // JSON.stringify body serialization drops it either way, so what
    // matters is that no owner *value* is sent, not literal key presence.
    expect(payload.owner).toBeUndefined()
  })

  // Regression (audit round 4 / #345): the risk-name option in the "Link
  // Risk" dropdown truncated to 30 chars with no ellipsis or way to see the
  // full name, so a long risk name and its truncated sibling could look
  // identical (or just look cut off with no indication). Now shows an
  // ellipsis when actually truncated, and the full name is always available
  // via a title tooltip.
  it("truncates a long risk name with an ellipsis and exposes the full name via a title tooltip", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            id: "risk-long",
            name: "A very long risk name that definitely exceeds thirty characters in length",
          }),
        ],
      },
    })
    mockUseGetAllKriQuery.mockReturnValue({ data: { data: [] } })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", { name: /organization\.kri\.newKri/i })
    )

    const [riskSelect] = screen.getAllByRole("combobox")
    const option = within(riskSelect).getByRole("option", {
      name: "A very long risk name that def...",
    })
    expect(option).toHaveAttribute(
      "title",
      "A very long risk name that definitely exceeds thirty characters in length"
    )
  })

  it("does not add an ellipsis to a risk name that's already 30 chars or fewer", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "risk-short", name: "Short risk name" })] },
    })
    mockUseGetAllKriQuery.mockReturnValue({ data: { data: [] } })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", { name: /organization\.kri\.newKri/i })
    )

    const [riskSelect] = screen.getAllByRole("combobox")
    const option = within(riskSelect).getByRole("option", {
      name: "Short risk name",
    })
    expect(option).toHaveAttribute("title", "Short risk name")
  })

  // Option-element title tooltips don't reliably render everywhere (same
  // constraint the round-4 ReportsPage "Coming soon" fix documents), so the
  // full name must also be visible without relying on hover once a
  // truncated risk is actually selected.
  it("shows the full risk name as visible text (not just a hover tooltip) once a truncated risk is selected", async () => {
    const longName =
      "A very long risk name that definitely exceeds thirty characters in length"
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "risk-long", name: longName })] },
    })
    mockUseGetAllKriQuery.mockReturnValue({ data: { data: [] } })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", { name: /organization\.kri\.newKri/i })
    )

    const [riskSelect] = screen.getAllByRole("combobox")
    expect(screen.queryByText(longName)).not.toBeInTheDocument()

    await userEvent.selectOptions(riskSelect, "risk-long")

    expect(screen.getByText(longName)).toBeInTheDocument()
  })

  it("does not show a visible full-name caption for a risk name that's already 30 chars or fewer", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "risk-short", name: "Short risk name" })] },
    })
    mockUseGetAllKriQuery.mockReturnValue({ data: { data: [] } })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", { name: /organization\.kri\.newKri/i })
    )

    const [riskSelect] = screen.getAllByRole("combobox")
    await userEvent.selectOptions(riskSelect, "risk-short")

    // "Short risk name" already appears once as the selected <option>'s own
    // text -- the caption should not add a second copy.
    expect(screen.getAllByText("Short risk name")).toHaveLength(1)
  })

  it("rejects creating a KRI when target and alert threshold are equal", async () => {
    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.newKri/i }))

    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.namePlaceholder"), "Bad KRI")
    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.unitPlaceholder"), "count")
    const [riskSelect] = screen.getAllByRole("combobox")
    await userEvent.selectOptions(riskSelect, "risk-1")
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.createKri/i }))

    expect(mockToastError).toHaveBeenCalledWith(
      "organization.kri.toast.thresholdMustDiffer"
    )
    expect(mockCreateKri).not.toHaveBeenCalled()
  })

  // Round 22 (resilience finding): current_value/alert_threshold/
  // target_value had no floor -- `type="number"` alone doesn't stop a
  // negative count/percentage/dollar figure, none of which are meaningful
  // for the KRI value types this app deals with.
  it("rejects creating a KRI when alert threshold is negative", async () => {
    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.newKri/i }))

    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.namePlaceholder"), "Bad KRI")
    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.unitPlaceholder"), "count")
    const [riskSelect] = screen.getAllByRole("combobox")
    await userEvent.selectOptions(riskSelect, "risk-1")
    // Order in the form: Current Value, Alert Threshold, Target.
    // userEvent.type can't reliably enter a leading "-" into a type="number"
    // input in jsdom (the keystroke is dropped rather than accumulating into
    // a negative value) -- fireEvent.change sets the value directly instead.
    const numberInputs = screen.getAllByRole("spinbutton")
    fireEvent.change(numberInputs[1], { target: { value: "-5" } })
    await userEvent.type(numberInputs[2], "10")
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.createKri/i }))

    expect(mockToastError).toHaveBeenCalledWith(
      "organization.kri.toast.valueCannotBeNegative"
    )
    expect(mockCreateKri).not.toHaveBeenCalled()
  })

  it("submits an updated current_value via the pencil button", async () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })
    mockSubmitKriValue.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    renderPage()
    await userEvent.click(screen.getByTitle("organization.kri.updateValueTooltip"))

    const input = screen.getByDisplayValue("50")
    await userEvent.clear(input)
    await userEvent.type(input, "75")
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.save/i }))

    await waitFor(() =>
      expect(mockSubmitKriValue).toHaveBeenCalledWith({
        id: "kri-1",
        current_value: 75,
      })
    )
    expect(mockToastSuccess).toHaveBeenCalledWith("organization.kri.toast.valueUpdated")
  })

  // Round 22: same negative-value floor as the New KRI form's guard.
  it("rejects a negative current_value submitted via the pencil button", async () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    renderPage()
    await userEvent.click(screen.getByTitle("organization.kri.updateValueTooltip"))

    const input = screen.getByDisplayValue("50")
    fireEvent.change(input, { target: { value: "-10" } })
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.save/i }))

    expect(mockToastError).toHaveBeenCalledWith(
      "organization.kri.toast.valueCannotBeNegative"
    )
    expect(mockSubmitKriValue).not.toHaveBeenCalled()
  })

  // Round 8 (UX finding): the update-value modal was a bare number input
  // with no indication which KRI it was for, or what unit/threshold it's
  // measured against.
  it("shows the KRI's name, threshold, and target in the update-value modal for context", async () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: {
        data: [
          makeKri({
            name: "Overdue actions",
            alert_threshold: 80,
            target_value: 10,
            unit: "%",
          }),
        ],
      },
      isLoading: false,
    })

    renderPage()
    await userEvent.click(screen.getByTitle("organization.kri.updateValueTooltip"))

    const dialog = screen.getByRole("dialog", {
      name: "organization.kri.updateValueTitle",
    })
    expect(within(dialog).getByText("Overdue actions")).toBeInTheDocument()
    expect(within(dialog).getByText(/80/)).toBeInTheDocument()
    expect(within(dialog).getByText(/10/)).toBeInTheDocument()
  })

  it("rejects an emptied value instead of silently submitting 0", async () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    renderPage()
    await userEvent.click(screen.getByTitle("organization.kri.updateValueTooltip"))

    const input = screen.getByDisplayValue("50")
    await userEvent.clear(input)
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.save/i }))

    expect(mockToastError).toHaveBeenCalledWith("organization.kri.toast.enterValidNumber")
    expect(mockSubmitKriValue).not.toHaveBeenCalled()
  })

  // Round-5 industry-standards finding: updateKri/deleteKri existed
  // server-side with zero frontend consumer -- a KRI's own fields could
  // never be corrected, and a mistakenly created one could never be
  // removed, without going around the UI.
  describe("edit KRI (round 5)", () => {
    it("shows the Edit button for a write-capable role", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      renderPage()

      expect(
        screen.getByTitle("organization.kri.editTooltip")
      ).toBeInTheDocument()
    })

    it("hides the Edit and Delete buttons for a read-only role", () => {
      mockRole = "VIEWER"
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      renderPage()

      expect(
        screen.queryByTitle("organization.kri.editTooltip")
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTitle("organization.kri.deleteTooltip")
      ).not.toBeInTheDocument()
    })

    it("pre-fills the edit form with the KRI's current fields and saves the changes", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: {
          data: [
            makeKri({
              name: "Failed Login Attempts",
              unit: "count",
              alert_threshold: 50,
              target_value: 10,
              frequency: "weekly",
            }),
          ],
        },
        isLoading: false,
      })
      mockUpdateKri.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.editTooltip"))

      const nameInput = screen.getByDisplayValue("Failed Login Attempts")
      await userEvent.clear(nameInput)
      await userEvent.type(nameInput, "Failed Logins")
      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.save/i })
      )

      await waitFor(() =>
        expect(mockUpdateKri).toHaveBeenCalledWith({
          id: "kri-1",
          data: {
            name: "Failed Logins",
            owner: "",
            unit: "count",
            alert_threshold: 50,
            target_value: 10,
            frequency: "weekly",
          },
        })
      )
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "organization.kri.toast.edited"
      )
    })

    // Round 22 (resilience finding, independent review of PR #875): the
    // create and update-value negative-value guards each had their own
    // test, but the Edit KRI modal's guard (handleSaveEdit) didn't -- a
    // future refactor could silently drop it with nothing to catch that.
    it("rejects saving an edit when alert threshold is negative", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ alert_threshold: 50, target_value: 10 })] },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.editTooltip"))

      const thresholdInput = screen.getByDisplayValue("50")
      // userEvent.type can't reliably enter a leading "-" into a
      // type="number" input in jsdom -- fireEvent.change sets it directly.
      fireEvent.change(thresholdInput, { target: { value: "-5" } })
      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.save/i })
      )

      expect(mockToastError).toHaveBeenCalledWith(
        "organization.kri.toast.valueCannotBeNegative"
      )
      expect(mockUpdateKri).not.toHaveBeenCalled()
    })

    // KRI owner field (industry-standards finding, round 20): free-text
    // owner, editable the same way as every other KRI field on this modal.
    it("pre-fills the edit form with the KRI's existing owner and saves an updated one", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ owner: "Jane Procurement" })] },
        isLoading: false,
      })
      mockUpdateKri.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.editTooltip"))

      const ownerInput = screen.getByDisplayValue("Jane Procurement")
      await userEvent.clear(ownerInput)
      await userEvent.type(ownerInput, "John Risk")
      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.save/i })
      )

      await waitFor(() =>
        expect(mockUpdateKri).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "kri-1",
            data: expect.objectContaining({ owner: "John Risk" }),
          })
        )
      )
    })

    // Independent review of PR #871: unlike create (which omits a blank
    // owner so it's never stored), edit deliberately sends an explicit ""
    // so a previously-set owner actually gets cleared rather than the
    // update being a silent no-op -- aexa-server#328's update_kri_into_db
    // normalizes that "" to a real NULL server-side.
    it("sends an explicit empty-string owner when clearing a previously-set one", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ owner: "Jane Procurement" })] },
        isLoading: false,
      })
      mockUpdateKri.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.editTooltip"))

      const ownerInput = screen.getByDisplayValue("Jane Procurement")
      await userEvent.clear(ownerInput)
      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.save/i })
      )

      await waitFor(() =>
        expect(mockUpdateKri).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "kri-1",
            data: expect.objectContaining({ owner: "" }),
          })
        )
      )
    })

    it("rejects saving when target and alert threshold are equal, same rule as create", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ alert_threshold: 80, target_value: 10 })] },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.editTooltip"))

      const targetInput = screen.getByDisplayValue("10")
      await userEvent.clear(targetInput)
      await userEvent.type(targetInput, "80")
      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.save/i })
      )

      expect(mockToastError).toHaveBeenCalledWith(
        "organization.kri.toast.thresholdMustDiffer"
      )
      expect(mockUpdateKri).not.toHaveBeenCalled()
    })

    it("shows an error toast when the edit mutation fails", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUpdateKri.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: "edit backend error" } }),
      })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.editTooltip"))
      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.save/i })
      )

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("edit backend error")
      )
    })
  })

  describe("delete KRI (round 5)", () => {
    it("deletes the KRI after confirming in the dialog", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "kri-9", name: "Stale KRI" })] },
        isLoading: false,
      })
      mockDeleteKri.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      renderPage()
      await userEvent.click(
        screen.getByTitle("organization.kri.deleteTooltip")
      )
      await userEvent.click(
        screen.getByRole("button", { name: "common.deleteAlertModal.delete" })
      )

      await waitFor(() => expect(mockDeleteKri).toHaveBeenCalledWith("kri-9"))
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "organization.kri.toast.deleted"
      )
    })

    it("does not delete the KRI if the confirm dialog is cancelled", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(
        screen.getByTitle("organization.kri.deleteTooltip")
      )
      await userEvent.click(
        screen.getByRole("button", { name: "common.deleteAlertModal.cancel" })
      )

      expect(mockDeleteKri).not.toHaveBeenCalled()
    })

    it("shows an error toast when the delete mutation fails", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockDeleteKri.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: "delete backend error" } }),
      })

      renderPage()
      await userEvent.click(
        screen.getByTitle("organization.kri.deleteTooltip")
      )
      await userEvent.click(
        screen.getByRole("button", { name: "common.deleteAlertModal.delete" })
      )

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("delete backend error")
      )
    })
  })

  // aexa-server#242 / aexa-frontend#211
  describe("trend history", () => {
    it("skips the readings query until the trend modal is opened", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })

      renderPage()

      expect(mockUseGetKriReadingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ id: "" }),
        expect.objectContaining({ skip: true })
      )
    })

    it("fetches readings scoped to the clicked KRI when the trend modal opens", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))

      expect(mockUseGetKriReadingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ id: "kri-1" }),
        expect.objectContaining({ skip: false })
      )
    })

    it("shows the empty state when there are no readings yet", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))

      expect(
        screen.getByText("organization.kri.trend.empty")
      ).toBeInTheDocument()
    })

    // Fresh full-panel re-score (resilience finding): a failed readings
    // fetch fell through to the same empty-state message as "this KRI
    // genuinely has no readings yet" -- indistinguishable from a real
    // outage.
    it("shows a distinct error message, not the empty state, when the readings fetch fails", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUseGetKriReadingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))

      expect(
        screen.getByText("organization.kri.trend.loadError")
      ).toBeInTheDocument()
      expect(
        screen.queryByText("organization.kri.trend.empty")
      ).not.toBeInTheDocument()
    })

    it("renders a chart (not the empty state) once readings resolve", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUseGetKriReadingsQuery.mockReturnValue({
        data: {
          data: [
            { id: "r-2", kri_id: "kri-1", value: 60, recorded_at: "2026-06-15T00:00:00.000Z" },
            { id: "r-1", kri_id: "kri-1", value: 50, recorded_at: "2026-05-15T00:00:00.000Z" },
          ],
        },
        isLoading: false,
      })

      const { container } = renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))

      // recharts' ResponsiveContainer never measures a real size under
      // jsdom (0x0 layout), so it renders no SVG at all -- this only proves
      // data reached the chart branch instead of the empty/loading state,
      // not that recharts itself rendered correctly.
      expect(
        screen.queryByText("organization.kri.trend.empty")
      ).not.toBeInTheDocument()
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument()
    })

    // Round-1 review of PR #847: getKriReadings' providesTags: ["KRI"]
    // means a background refetch (e.g. from submitting a new value while
    // this modal is open) can fail while the prior successful fetch's
    // chart data is still cached -- the original fix hid that still-valid
    // stale chart behind the error message unconditionally, the same
    // stale-but-valid-data anti-pattern already fixed on Alerts/
    // Intelligence this session.
    it("keeps showing the stale chart, not the error state, when isError is true but readings data is still present", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUseGetKriReadingsQuery.mockReturnValue({
        data: {
          data: [
            { id: "r-1", kri_id: "kri-1", value: 50, recorded_at: "2026-05-15T00:00:00.000Z" },
          ],
        },
        isLoading: false,
        isError: true,
      })

      const { container } = renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))

      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument()
      expect(
        screen.queryByText("organization.kri.trend.loadError")
      ).not.toBeInTheDocument()
      expect(
        screen.getByText("organization.kri.trend.refetchFailedStale")
      ).toBeInTheDocument()
    })

    // Issue #461: the trend chart's date labels were built via a local
    // formatDate() hardcoded to toLocaleDateString("en-US", ...), ignoring
    // the app's selected language. Now goes through the shared
    // formatLocaleDate helper with i18n.language threaded through.
    it("formats trend chart dates using the French locale when i18n.language starts with fr", async () => {
      mockLanguage = "fr-FR"
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUseGetKriReadingsQuery.mockReturnValue({
        data: {
          data: [
            { id: "r-1", kri_id: "kri-1", value: 50, recorded_at: "2026-05-15T00:00:00.000Z" },
          ],
        },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))

      expect(mockFormatLocaleDate).toHaveBeenCalledWith(
        "2026-05-15T00:00:00.000Z",
        "fr-FR",
        { month: "short", day: "numeric" }
      )
      expect(mockFormatLocaleDate).toHaveReturnedWith(
        new Date("2026-05-15T00:00:00.000Z").toLocaleDateString("fr-FR", {
          month: "short",
          day: "numeric",
        })
      )
    })

    it("formats trend chart dates using the English locale by default", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUseGetKriReadingsQuery.mockReturnValue({
        data: {
          data: [
            { id: "r-1", kri_id: "kri-1", value: 50, recorded_at: "2026-05-15T00:00:00.000Z" },
          ],
        },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))

      expect(mockFormatLocaleDate).toHaveBeenCalledWith(
        "2026-05-15T00:00:00.000Z",
        "en",
        { month: "short", day: "numeric" }
      )
    })

    it("closes the trend modal via the close button", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))
      expect(
        screen.getByText("organization.kri.trend.empty")
      ).toBeInTheDocument()

      // The X close button has no accessible name of its own; it's the only
      // button inside the modal's header row alongside the title.
      const modalHeading = screen.getByText(/organization\.kri\.trend\.modalTitle/)
      const closeButton = modalHeading.parentElement!.querySelector("button")!
      await userEvent.click(closeButton)

      expect(
        screen.queryByText("organization.kri.trend.empty")
      ).not.toBeInTheDocument()
    })
  })

  describe("accessibility (round 9)", () => {
    // A CSS-truncated name has no way to see the full text without a title
    // fallback -- title is the same pattern already used for the risk-name
    // dropdown truncation above.
    it("exposes the full KRI name via a title attribute when the card's name is truncated", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: {
          data: [makeKri({ name: "A very long key risk indicator name that overflows" })],
        },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByTitle("A very long key risk indicator name that overflows")
      ).toBeInTheDocument()
    })

    // The alert-count badge previously conveyed its tooltip text only via
    // `title`, which isn't reliably exposed to screen readers/touch
    // devices -- aria-label carries the same text through the accessibility
    // tree directly.
    it("gives the alert-count badge an aria-label matching its tooltip text, with the real alert count interpolated", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "kri-1" })] },
        isLoading: false,
      })
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            { id: "a1", kri_id: "kri-1" },
            { id: "a2", kri_id: "kri-1" },
          ],
        },
      })

      renderPage()

      const badge = screen.getByTitle("organization.kri.relatedAlertsTooltip")
      expect(badge).toHaveAttribute(
        "aria-label",
        "organization.kri.relatedAlertsTooltip"
      )
      const tooltipCalls = tCalls.filter(
        (call) => call[0] === "organization.kri.relatedAlertsTooltip"
      )
      // Both the title and the aria-label read from the same t() call site
      // in source, so this stub's identical-string return doesn't by
      // itself prove the real count was interpolated -- asserting on the
      // recorded call args does.
      expect(tooltipCalls.length).toBeGreaterThan(0)
      for (const call of tooltipCalls) {
        expect((call[1] as { count?: unknown })?.count).toBe(2)
      }
    })

    // The trend chart is a purely visual Recharts SVG with no built-in text
    // alternative -- an sr-only summary gives screen reader users the same
    // count/range/latest-value information sighted users get from the chart.
    it("renders an sr-only text summary of the trend chart's data", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUseGetKriReadingsQuery.mockReturnValue({
        data: {
          data: [
            { id: "r-2", kri_id: "kri-1", value: 60, recorded_at: "2026-06-15T00:00:00.000Z" },
            { id: "r-1", kri_id: "kri-1", value: 50, recorded_at: "2026-05-15T00:00:00.000Z" },
          ],
        },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))

      const summary = screen.getByText("organization.kri.trend.summary")
      expect(summary.className).toContain("sr-only")

      // The mocked t() ignores interpolation options for this key (it just
      // echoes the raw key string), so the rendered text alone can't prove
      // the right count/dates/value were passed in -- asserting on the
      // recorded call args does. Readings are reversed from the API's
      // newest-first order, so the oldest reading (r-1, May) is `first`
      // and the newest (r-2, June) is both `last` and `latestValue`.
      const summaryCall = tCalls.find(
        (call) => call[0] === "organization.kri.trend.summary"
      )
      expect(summaryCall).toBeDefined()
      const summaryOpts = summaryCall?.[1] as {
        count?: unknown
        first?: unknown
        last?: unknown
        latestValue?: unknown
      }
      expect(summaryOpts.count).toBe(2)
      expect(summaryOpts.latestValue).toBe(60)
      // mockFormatLocaleDate wraps the real formatLocaleDate implementation
      // (see the module mock near the top of this file), so calling it
      // directly here gives the exact expected formatted-date strings.
      expect(summaryOpts.first).toBe(
        mockFormatLocaleDate("2026-05-15T00:00:00.000Z", "en", {
          month: "short",
          day: "numeric",
        })
      )
      expect(summaryOpts.last).toBe(
        mockFormatLocaleDate("2026-06-15T00:00:00.000Z", "en", {
          month: "short",
          day: "numeric",
        })
      )
    })
  })

  // Regression: none of this file's raw <button> elements declared
  // type="button", defaulting to the implicit type="submit" -- harmless only
  // because this page's markup never sits inside a <form>, but a latent
  // footgun if it ever does. Same convention as InspectionActions.test.tsx's
  // "gives every button an explicit type" test. The New KRI, Update Value,
  // and Trend modals are independent state (not mutually exclusive), so
  // opening all three mounts every button this page can render -- otherwise
  // a sweep here could silently skip buttons that only render with specific
  // state.
  it("gives every rendered button an explicit type so none default to implicit submit", async () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", { name: /organization\.kri\.newKri/i })
    )
    await userEvent.click(
      screen.getByTitle("organization.kri.updateValueTooltip")
    )
    await userEvent.click(
      screen.getByTitle("organization.kri.trend.viewTooltip")
    )

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })

  describe("overdue badge", () => {
    it("shows the overdue badge when the server reports overdue", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ overdue: true })] },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByText("organization.kri.overdueLabel")
      ).toBeInTheDocument()
    })

    it("does not show the overdue badge when overdue is false", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ overdue: false })] },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.queryByText("organization.kri.overdueLabel")
      ).not.toBeInTheDocument()
    })
  })

  // KRI owner field (industry-standards finding, round 20): shown compactly
  // on the card only when set, same conditional-metadata pattern as the
  // overdue badge just above -- no unconditional column for an org that
  // never fills it in.
  describe("owner display", () => {
    it("shows the owner on the card when set", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ owner: "Jane Procurement" })] },
        isLoading: false,
      })

      renderPage()

      expect(screen.getByText("Jane Procurement")).toBeInTheDocument()
    })

    it("does not render an owner line when owner is unset", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ owner: null })] },
        isLoading: false,
      })

      renderPage()

      // Round-2 independent review of #871: "organization.kri.ownerLabel"
      // is only ever used as the owner span's `title` attribute -- its
      // visible text content is kri.owner itself (e.g. "Jane Procurement"),
      // never the translation key -- so queryByText against that key never
      // actually exercised this assertion. queryByTitle checks the
      // attribute the conditional block actually sets.
      expect(
        screen.queryByTitle("organization.kri.ownerLabel")
      ).not.toBeInTheDocument()
    })
  })

  // Round 13 (fresh full-panel re-score, industry-standards finding): every
  // numeric readout rendered bare Number(...) with no thousands grouping,
  // e.g. "15000" instead of "15,000" -- inconsistent with this file's own
  // formatLocaleDate discipline already applied to dates.
  describe("numeric formatting (round 13)", () => {
    it("renders the current value with thousands grouping", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ current_value: 15000 })] },
        isLoading: false,
      })

      renderPage()

      expect(screen.getByText("15,000")).toBeInTheDocument()
      expect(screen.queryByText("15000")).not.toBeInTheDocument()
    })

    it("renders the threshold and target with thousands grouping", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: {
          data: [
            makeKri({ alert_threshold: 250000, target_value: 1500 }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      expect(screen.getByText("250,000")).toBeInTheDocument()
      expect(screen.getByText("1,500")).toBeInTheDocument()
    })

    it("preserves a fractional value's precision instead of rounding it off", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ current_value: 12345.6789 })] },
        isLoading: false,
      })

      renderPage()

      expect(screen.getByText("12,345.6789")).toBeInTheDocument()
    })

    // Round-2 review of PR #852: an earlier version of this fix hardcoded
    // "en-US" unconditionally, which would show a French-language user
    // English-convention grouping right next to dates already correctly
    // rendered in French via this file's own formatLocaleDate(i18n.language)
    // call. Mirrors the "formats trend chart dates using the French locale"
    // test above -- computing the expected string via the same
    // toLocaleString call (rather than hardcoding the French group
    // separator, a narrow no-break space distinct from a plain space)
    // keeps this test independent of that Unicode detail.
    it("formats the current value using the French locale when i18n.language starts with fr", () => {
      mockLanguage = "fr-FR"
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ current_value: 12345.6789 })] },
        isLoading: false,
      })

      renderPage()

      // Matched via regex with a wildcard group separator rather than the
      // exact literal string: fr-FR's thousands separator is a narrow
      // no-break space (U+202F), whose exact glyph can differ across ICU
      // data builds/environments -- the decimal comma is the stable,
      // environment-independent signal that French formatting was
      // actually applied (English would use a period).
      expect(screen.getByText(/^12.345,6789$/)).toBeInTheDocument()
      expect(screen.queryByText("12,345.6789")).not.toBeInTheDocument()
    })

    it("renders the update-value modal's threshold/target context with thousands grouping", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: {
          data: [
            makeKri({ alert_threshold: 80000, target_value: 12000 }),
          ],
        },
        isLoading: false,
      })

      renderPage()
      await userEvent.click(
        screen.getByTitle("organization.kri.updateValueTooltip")
      )

      const dialog = screen.getByRole("dialog")
      expect(within(dialog).getByText(/80,000/)).toBeInTheDocument()
      expect(within(dialog).getByText(/12,000/)).toBeInTheDocument()
    })

    // Spotted live right after the thousands-grouping fix shipped: a large
    // value (now wider still with comma separators) had nowhere to go but
    // into the action-button row's space, shrinking the 44px touch targets
    // round 2 established. The value now truncates (with a title fallback)
    // instead of compressing its siblings.
    it("truncates a very large current value instead of shrinking the action buttons below their touch-target size", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ current_value: 1241153215 })] },
        isLoading: false,
      })

      renderPage()

      const value = screen.getByTitle("1,241,153,215")
      expect(value.className).toContain("truncate")

      for (const title of [
        "organization.kri.trend.viewTooltip",
        "organization.kri.updateValueTooltip",
        "organization.kri.editTooltip",
        "organization.kri.deleteTooltip",
      ]) {
        const button = screen.getByTitle(title)
        expect(button.className).toContain("h-11")
        expect(button.className).toContain("w-11")
        expect(button.className).toContain("shrink-0")
      }
    })
  })

  // aexa-frontend#471 -- KriDashboardPage's three modals were plain divs
  // with no role="dialog", no aria-modal, and no Escape handling.
  describe("modal accessibility", () => {
    it("marks the Update Value modal as a labeled dialog and closes it on Escape", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByTitle("organization.kri.updateValueTooltip")
      )
      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-modal", "true")
      expect(dialog).toHaveAccessibleName("organization.kri.updateValueTitle")

      await userEvent.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    // Round 16 (fresh accessibility re-check finding): the input's
    // `autoFocus` fired during React's commit, before useModalA11y's own
    // effect ran -- so that effect captured the input itself (not the
    // button that opened the modal) as "the trigger to restore focus to on
    // close." Removed `autoFocus` (useModalA11y's own focusable[0]?.focus()
    // already overrode where autoFocus put focus anyway, so this changes
    // nothing about where focus lands on open).
    it("returns focus to the trigger button when the Update Value modal closes, not the input autoFocus used to steal", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      renderPage()

      const trigger = screen.getByTitle("organization.kri.updateValueTooltip")
      await userEvent.click(trigger)
      expect(screen.getByRole("dialog")).toBeInTheDocument()

      await userEvent.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })

    it("marks the New KRI modal as a labeled dialog and closes it on Escape", async () => {
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.newKri/i })
      )
      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-modal", "true")
      expect(dialog).toHaveAccessibleName("organization.kri.newKri")

      await userEvent.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("marks the trend modal as a labeled dialog and closes it on Escape", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUseGetKriReadingsQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByTitle("organization.kri.trend.viewTooltip")
      )
      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-modal", "true")

      await userEvent.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("does not steal focus from the name field while typing in the New KRI modal", async () => {
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.newKri/i })
      )
      const nameInput = screen.getByPlaceholderText(
        "organization.kri.form.namePlaceholder"
      )
      await userEvent.type(nameInput, "New KRI")

      // Regression: an onClose callback re-created every render (instead of
      // stored in a ref) used to make the modal's focus-trap effect tear
      // down and set up again on every keystroke, re-focusing the first
      // focusable element in the modal (the close button) and truncating
      // typed input to a single character.
      expect(nameInput).toHaveValue("New KRI")
    })

    // Round 15 (fresh full-panel re-check finding): none of the 5 open-state
    // setters closed the others, so e.g. opening "New KRI" then a card's
    // "Update value" button mounted two useModalA11y dialogs at once --
    // each hook's own Tab-trap only walks its own container, so focus
    // could escape both into the background page entirely.
    it("closes the New KRI modal when the Update Value modal is opened from a card", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.newKri/i })
      )
      expect(screen.getAllByRole("dialog")).toHaveLength(1)

      await userEvent.click(
        screen.getByTitle("organization.kri.updateValueTooltip")
      )

      const dialogs = screen.getAllByRole("dialog")
      expect(dialogs).toHaveLength(1)
      expect(dialogs[0]).toHaveAccessibleName(
        "organization.kri.updateValueTitle"
      )
    })

    it("closes the Update Value modal when the trend modal is opened for the same card", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      mockUseGetKriReadingsQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByTitle("organization.kri.updateValueTooltip")
      )
      expect(screen.getAllByRole("dialog")).toHaveLength(1)

      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))

      expect(screen.getAllByRole("dialog")).toHaveLength(1)
      expect(
        screen.queryByLabelText("organization.kri.form.currentValue")
      ).not.toBeInTheDocument()
    })

    it("closes the Edit KRI modal when the Delete confirmation is opened for the same card", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(screen.getByTitle("organization.kri.editTooltip"))
      expect(screen.getAllByRole("dialog")).toHaveLength(1)

      await userEvent.click(
        screen.getByTitle("organization.kri.deleteTooltip")
      )

      // DeleteAlertModal is a separate (Radix-based) component -- still
      // gets closeAllModals()'d away from alongside the other four.
      expect(
        screen.queryByLabelText("organization.kri.form.name", {
          exact: false,
        })
      ).not.toBeInTheDocument()
    })
  })

  // aexa-frontend#483 -- the Update Value modal's number input had no
  // <label>/aria-label/id (the dialog's aria-labelledby names the dialog
  // itself, not this field), and all 7 New KRI modal fields used a
  // <label> with no htmlFor and inputs/selects with no id.
  describe("form field accessible names (#483)", () => {
    it("gives the Update Value modal's input an accessible name", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByTitle("organization.kri.updateValueTooltip")
      )

      expect(
        screen.getByLabelText("organization.kri.form.currentValue")
      ).toBeInTheDocument()
    })

    it("pairs every New KRI modal field to its label via htmlFor/id", async () => {
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.newKri/i })
      )

      const labelKeys = [
        "name",
        "risk",
        "unit",
        "currentValue",
        "alertThreshold",
        "target",
        "frequency",
      ]
      for (const key of labelKeys) {
        expect(
          screen.getByLabelText(`organization.kri.form.${key}`, {
            exact: false,
          })
        ).toBeInTheDocument()
      }
    })
  })

  // Round 12 (fresh accessibility re-score): the Name/Risk fields carried
  // only a visual "*" in their label text, with no `required`/
  // `aria-required` on the input/select itself -- a screen-reader user got
  // no non-visual signal of which fields are mandatory before hitting
  // validation.
  describe("required-field markup (round 12)", () => {
    it("marks the New KRI modal's Name and Risk fields as required", async () => {
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.newKri/i })
      )

      const nameInput = screen.getByLabelText(
        "organization.kri.form.name",
        { exact: false }
      )
      expect(nameInput).toBeRequired()
      expect(nameInput).toHaveAttribute("aria-required", "true")

      const riskSelect = screen.getByLabelText(
        "organization.kri.form.risk",
        { exact: false }
      )
      expect(riskSelect).toBeRequired()
      expect(riskSelect).toHaveAttribute("aria-required", "true")
    })

    // Round 21 (industry-standards finding): the backend's create_kri
    // schema requires a non-empty unit (z.string().min(1), "Unit is
    // required"), but this field was never marked required in the form --
    // a user could submit with it blank and only find out from a raw 400
    // in the network tab. This test previously asserted the buggy
    // behavior (unit NOT required); it now asserts the fix.
    it("marks the New KRI modal's Unit field as required", async () => {
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: /organization\.kri\.newKri/i })
      )

      const unitInput = screen.getByLabelText(
        "organization.kri.form.unit",
        { exact: false }
      )
      expect(unitInput).toBeRequired()
      expect(unitInput).toHaveAttribute("aria-required", "true")
    })

    it("marks the Edit KRI modal's Name field as required", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByTitle("organization.kri.editTooltip")
      )

      const nameInput = screen.getByLabelText(
        "organization.kri.form.name",
        { exact: false }
      )
      expect(nameInput).toBeRequired()
      expect(nameInput).toHaveAttribute("aria-required", "true")
    })

    // Round 21: update_kri's schema also enforces unit min(1) whenever
    // present, and EditKriModal always sends it -- same required-in-form
    // fix as the New KRI modal above.
    it("marks the Edit KRI modal's Unit field as required", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })
      renderPage()

      await userEvent.click(
        screen.getByTitle("organization.kri.editTooltip")
      )

      const unitInput = screen.getByLabelText(
        "organization.kri.form.unit",
        { exact: false }
      )
      expect(unitInput).toBeRequired()
      expect(unitInput).toHaveAttribute("aria-required", "true")
    })
  })

  // aexa-frontend#542: a KRI card's underlying risk was shown by name only,
  // with no way to jump to it.
  describe("underlying-risk link (#542)", () => {
    it("links the risk name to its detail page when a matching risk is found", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ risk_id: "risk-1" })] },
        isLoading: false,
      })
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ id: "risk-1", name: "Fire safety risk" })] },
      })

      renderPage()

      const link = screen.getByRole("link", { name: "Fire safety risk" })
      expect(link).toHaveAttribute("href", "/organization/risks/risk-1")
    })

    it("falls back to the unknown-risk label with no link when risk_id matches nothing", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ risk_id: "risk-does-not-exist" })] },
        isLoading: false,
      })
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ id: "risk-1" })] },
      })

      renderPage()

      expect(
        screen.getByText(/organization\.kri\.unknownRisk/)
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("link", { name: "Fire safety risk" })
      ).not.toBeInTheDocument()
    })

    // Round 9 (accessibility finding): this line is CSS-truncated the same
    // way the KRI name above it is, but had no title fallback -- same
    // defect, same card, left unaddressed when the name's own fallback was
    // added.
    it("exposes the full risk name and frequency via a title attribute when the risk/frequency line is truncated", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ risk_id: "risk-1", frequency: "monthly" })] },
        isLoading: false,
      })
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ id: "risk-1", name: "Fire safety risk" })] },
      })

      renderPage()

      expect(
        screen.getByTitle("Fire safety risk · Monthly")
      ).toBeInTheDocument()
    })

    it("falls back to the unknown-risk label in the title when risk_id matches nothing", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: {
          data: [
            makeKri({ risk_id: "risk-does-not-exist", frequency: "monthly" }),
          ],
        },
        isLoading: false,
      })
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ id: "risk-1" })] },
      })

      renderPage()

      expect(
        screen.getByTitle("organization.kri.unknownRisk · Monthly")
      ).toBeInTheDocument()
    })
  })

  // aexa-frontend#530: the KRI-side half of the Alert<->KRI cross-link.
  describe("related-alerts badge and highlight (#530)", () => {
    it("shows an alert-count badge when alerts reference this KRI", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "kri-1" })] },
        isLoading: false,
      })
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            { id: "a1", kri_id: "kri-1" },
            { id: "a2", kri_id: "kri-1" },
            { id: "a3", kri_id: "kri-other" },
          ],
        },
      })

      renderPage()

      expect(
        screen.getByTitle("organization.kri.relatedAlertsTooltip")
      ).toHaveTextContent("2")
    })

    it("excludes read alerts from the count, so resolving them shrinks the badge", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "kri-1" })] },
        isLoading: false,
      })
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            { id: "a1", kri_id: "kri-1", is_read: false },
            { id: "a2", kri_id: "kri-1", is_read: true },
          ],
        },
      })

      renderPage()

      expect(
        screen.getByTitle("organization.kri.relatedAlertsTooltip")
      ).toHaveTextContent("1")
    })

    it("colors the badge by the highest severity among the KRI's unread alerts", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "kri-1" })] },
        isLoading: false,
      })
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [
            { id: "a1", kri_id: "kri-1", is_read: false, severity: "low" },
            { id: "a2", kri_id: "kri-1", is_read: false, severity: "critical" },
          ],
        },
      })

      renderPage()

      const badge = screen.getByTitle("organization.kri.relatedAlertsTooltip")
      expect(badge.className).toContain("text-red-700")
    })

    it("does not fall back to critical/red styling when no unread alert is actually critical or high", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "kri-1" })] },
        isLoading: false,
      })
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: {
          data: [{ id: "a1", kri_id: "kri-1", is_read: false, severity: "low" }],
        },
      })

      renderPage()

      const badge = screen.getByTitle("organization.kri.relatedAlertsTooltip")
      expect(badge.className).not.toContain("text-red-700")
    })

    it("shows no alert-count badge when no alert references this KRI", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "kri-1" })] },
        isLoading: false,
      })
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: { data: [{ id: "a1", kri_id: "kri-other" }] },
      })

      renderPage()

      expect(
        screen.queryByTitle("organization.kri.relatedAlertsTooltip")
      ).not.toBeInTheDocument()
    })

    it("scrolls to and highlights the KRI card matching ?highlight=", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "kri-1" })] },
        isLoading: false,
      })

      renderPage("/?highlight=kri-1")

      await waitFor(() =>
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
      )
      const card = document.getElementById("kri-kri-1")
      expect(card?.className).toContain("ring-2")
    })

    it("re-triggers the scroll/highlight on a second real navigation to the same ?highlight= id", async () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "kri-1" })] },
        isLoading: false,
      })
      const user = userEvent.setup()

      render(
        <MemoryRouter initialEntries={["/?highlight=kri-1"]}>
          <ReNavigateHarness to="/?highlight=kri-1" />
        </MemoryRouter>
      )

      await waitFor(() =>
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
      )

      await user.click(screen.getByRole("button", { name: "renavigate" }))

      await waitFor(() =>
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2)
      )
    })

    it("does not scroll or highlight anything when no ?highlight= param is present", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ id: "kri-1" })] },
        isLoading: false,
      })

      renderPage("/")

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
      const card = document.getElementById("kri-kri-1")
      expect(card?.className).not.toContain("ring-2")
    })
  })
})
