import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        FREQUENCY_TRANSLATIONS[key] ?? (opts?.defaultValue as string) ?? key,
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
const mockUseGetKriReadingsQuery = vi.fn()

vi.mock("@/redux/apis/organization/kri.api", () => ({
  useGetAllKriQuery: (...args: unknown[]) => mockUseGetAllKriQuery(...args),
  useCreateNewKriMutation: () => [mockCreateKri],
  useSubmitKriValueMutation: () => [mockSubmitKriValue],
  useGetKriReadingsQuery: (...args: unknown[]) =>
    mockUseGetKriReadingsQuery(...args),
}))

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
}))

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
    mockCreateKri.mockReset()
    mockSubmitKriValue.mockReset()
    mockUseGetKriReadingsQuery.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockLanguage = "en"
    mockFormatLocaleDate.mockClear()

    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk()] },
    })
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

    render(<KriDashboardPage />)

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

  it("hides New KRI and update-value controls for a VIEWER but keeps the trend button", () => {
    mockRole = "VIEWER"
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    render(<KriDashboardPage />)

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

  it("hides write controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    render(<KriDashboardPage />)

    expect(
      screen.queryByText("organization.kri.newKri")
    ).not.toBeInTheDocument()
  })

  it("shows a loading state", () => {
    mockUseGetAllKriQuery.mockReturnValue({ data: undefined, isLoading: true })
    render(<KriDashboardPage />)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows an error state when the KRI list fails to load", () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
    })
    render(<KriDashboardPage />)
    expect(screen.getByText("organization.kri.loadError")).toBeInTheDocument()
  })

  it("shows the empty state when there are no KRIs", () => {
    render(<KriDashboardPage />)
    expect(screen.getByText("organization.kri.noKris")).toBeInTheDocument()
  })

  it("renders a KRI with its real risk name and status", () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri({ status: "ALERT" })] },
      isLoading: false,
    })

    render(<KriDashboardPage />)

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

    render(<KriDashboardPage />)

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

    render(<KriDashboardPage />)

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

    render(<KriDashboardPage />)

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

    render(<KriDashboardPage />)
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.newKri/i }))

    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.namePlaceholder"), "New KRI")
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

    render(<KriDashboardPage />)
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

    render(<KriDashboardPage />)
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

    render(<KriDashboardPage />)
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

    render(<KriDashboardPage />)
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
    render(<KriDashboardPage />)
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.newKri/i }))

    await userEvent.type(screen.getByPlaceholderText("organization.kri.form.namePlaceholder"), "Bad KRI")
    const [riskSelect] = screen.getAllByRole("combobox")
    await userEvent.selectOptions(riskSelect, "risk-1")
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.createKri/i }))

    expect(mockToastError).toHaveBeenCalledWith(
      "organization.kri.toast.thresholdMustDiffer"
    )
    expect(mockCreateKri).not.toHaveBeenCalled()
  })

  it("submits an updated current_value via the pencil button", async () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })
    mockSubmitKriValue.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<KriDashboardPage />)
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

  it("rejects an emptied value instead of silently submitting 0", async () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [makeKri()] },
      isLoading: false,
    })

    render(<KriDashboardPage />)
    await userEvent.click(screen.getByTitle("organization.kri.updateValueTooltip"))

    const input = screen.getByDisplayValue("50")
    await userEvent.clear(input)
    await userEvent.click(screen.getByRole("button", { name: /organization\.kri\.save/i }))

    expect(mockToastError).toHaveBeenCalledWith("organization.kri.toast.enterValidNumber")
    expect(mockSubmitKriValue).not.toHaveBeenCalled()
  })

  // aexa-server#242 / aexa-frontend#211
  describe("trend history", () => {
    it("skips the readings query until the trend modal is opened", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri()] },
        isLoading: false,
      })

      render(<KriDashboardPage />)

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

      render(<KriDashboardPage />)
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

      render(<KriDashboardPage />)
      await userEvent.click(screen.getByTitle("organization.kri.trend.viewTooltip"))

      expect(
        screen.getByText("organization.kri.trend.empty")
      ).toBeInTheDocument()
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

      const { container } = render(<KriDashboardPage />)
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

      render(<KriDashboardPage />)
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

      render(<KriDashboardPage />)
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

      render(<KriDashboardPage />)
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

  describe("overdue badge", () => {
    it("shows the overdue badge when the server reports overdue", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ overdue: true })] },
        isLoading: false,
      })

      render(<KriDashboardPage />)

      expect(
        screen.getByText("organization.kri.overdueLabel")
      ).toBeInTheDocument()
    })

    it("does not show the overdue badge when overdue is false", () => {
      mockUseGetAllKriQuery.mockReturnValue({
        data: { data: [makeKri({ overdue: false })] },
        isLoading: false,
      })

      render(<KriDashboardPage />)

      expect(
        screen.queryByText("organization.kri.overdueLabel")
      ).not.toBeInTheDocument()
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
      render(<KriDashboardPage />)

      await userEvent.click(
        screen.getByTitle("organization.kri.updateValueTooltip")
      )
      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-modal", "true")
      expect(dialog).toHaveAccessibleName("organization.kri.updateValueTitle")

      await userEvent.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("marks the New KRI modal as a labeled dialog and closes it on Escape", async () => {
      render(<KriDashboardPage />)

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
      render(<KriDashboardPage />)

      await userEvent.click(
        screen.getByTitle("organization.kri.trend.viewTooltip")
      )
      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-modal", "true")

      await userEvent.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("does not steal focus from the name field while typing in the New KRI modal", async () => {
      render(<KriDashboardPage />)

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
  })
})
