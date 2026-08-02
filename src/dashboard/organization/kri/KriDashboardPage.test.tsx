import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import KriDashboardPage from "./KriDashboardPage"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

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
})
