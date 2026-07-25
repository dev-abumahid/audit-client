import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import KriDashboardPage from "./KriDashboardPage"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockUseGetAllKriQuery = vi.fn()
const mockUseGetAllRisksQuery = vi.fn()
const mockCreateKri = vi.fn()
const mockSubmitKriValue = vi.fn()

vi.mock("@/redux/apis/organization/kri.api", () => ({
  useGetAllKriQuery: (...args: unknown[]) => mockUseGetAllKriQuery(...args),
  useCreateNewKriMutation: () => [mockCreateKri],
  useSubmitKriValueMutation: () => [mockSubmitKriValue],
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
    ...overrides,
  }
}

function makeRisk(overrides = {}) {
  return { id: "risk-1", name: "Fire safety risk", ...overrides }
}

describe("KriDashboardPage", () => {
  beforeEach(() => {
    mockUseGetAllKriQuery.mockReset()
    mockUseGetAllRisksQuery.mockReset()
    mockCreateKri.mockReset()
    mockSubmitKriValue.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()

    mockUseGetAllKriQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk()] },
    })
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
    expect(screen.getByText("ALERT")).toBeInTheDocument()
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
    // badges, so scope to the summary row specifically.
    expect(screen.getByText("organization.kri.status.alert").previousSibling).toHaveTextContent("1")
    expect(screen.getByText("organization.kri.status.warning").previousSibling).toHaveTextContent("1")
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
})
