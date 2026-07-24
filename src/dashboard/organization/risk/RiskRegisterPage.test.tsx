import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import RiskRegisterPage from "./RiskRegisterPage"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

const mockUseGetAllRisksQuery = vi.fn()
const mockUseGetAllSitesQuery = vi.fn()
const mockCreateNewRisk = vi.fn()
const mockUpdateRisk = vi.fn()
const mockDeleteRisk = vi.fn()

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
  useCreateNewRiskMutation: () => [mockCreateNewRisk, { isLoading: false }],
  useUpdateRiskMutation: () => [mockUpdateRisk, { isLoading: false }],
  useDeleteRiskMutation: () => [mockDeleteRisk],
}))

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) => mockUseGetAllSitesQuery(...args),
}))

vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
}))

// The approval column's controls (badge + role-gated actions) are covered by
// RiskApprovalControls.test.tsx. Stub it here so this page test stays focused
// on the register CRUD and doesn't need the approval api / role hook wired.
vi.mock("./RiskApprovalControls", () => ({
  default: ({ risk }: { risk: { id: string } }) => (
    <span data-testid={`approval-controls-${risk.id}`} />
  ),
}))

function makeRisk(overrides = {}) {
  return {
    id: "risk-1",
    name: "Supply chain disruption",
    description: "Critical supplier dependency",
    category: "supply_chain",
    inherent_score: 8,
    residual_score: 5,
    pagerank_score: 3,
    financial_impact_min: 100000,
    financial_impact_max: 500000,
    probability: 40,
    velocity: "high",
    trend: "worsening",
    status: "open",
    ai_generated: false,
    is_edited: false,
    site_id: "site-1",
    site: { id: "site-1", name: "HQ Casablanca" },
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  }
}

function makeSite(overrides = {}) {
  return { id: "site-1", name: "HQ Casablanca", ...overrides }
}

describe("RiskRegisterPage", () => {
  beforeEach(() => {
    mockUseGetAllRisksQuery.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockCreateNewRisk.mockReset()
    mockUpdateRisk.mockReset()
    mockDeleteRisk.mockReset()
    mockToastError.mockReset()
    mockUseGetAllSitesQuery.mockReturnValue({ data: { data: [makeSite()] } })
  })

  it("renders risk rows with name, site, category and score", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })

    render(<RiskRegisterPage />)

    expect(screen.getByText("Supply chain disruption")).toBeInTheDocument()
    // "HQ Casablanca" also appears as a site-filter option, so there are two matches
    expect(screen.getAllByText("HQ Casablanca").length).toBeGreaterThanOrEqual(
      1
    )
    expect(screen.getByText("supply_chain")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument() // residual_score badge
  })

  it("shows empty state when there are no risks", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })

    const { container } = render(<RiskRegisterPage />)

    expect(container.querySelector("tbody")?.children.length).toBe(0)
  })

  it("shows fallback site label when risk has no site", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ site: undefined, site_id: "" })] },
    })

    render(<RiskRegisterPage />)

    // i18n isn't initialized in the test environment, so t() echoes the raw
    // key back (see RiskMatrixPage.test.tsx for the same convention).
    expect(
      screen.getByText("🏢 organization.riskRegister.groupFallback")
    ).toBeInTheDocument()
  })

  it('opens the create modal when "Add New Risk" is clicked', async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })

    render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )

    expect(
      screen.getByText("organization.riskRegister.addNewRisk", {
        selector: "h2",
      })
    ).toBeInTheDocument()
  })

  it("shows validation errors when submitting with required fields empty", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })

    render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.riskRegister.addRisk" })
    )

    await waitFor(() => {
      expect(
        screen.getByText("organization.riskRegister.siteRequired")
      ).toBeInTheDocument()
      expect(
        screen.getByText("organization.riskRegister.riskNameRequired")
      ).toBeInTheDocument()
      expect(
        screen.getByText("organization.riskRegister.statusRequired")
      ).toBeInTheDocument()
    })
    expect(mockCreateNewRisk).not.toHaveBeenCalled()
  })

  it("submits the create form and calls createNewRisk with filled data", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, message: "Risk created" }),
    })

    const { container } = render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )

    // Form inputs aren't wired to <label for>, so query by the react-hook-form `name` attribute
    await userEvent.selectOptions(
      container.querySelector('[name="site_id"]')!,
      "site-1"
    )
    await userEvent.type(container.querySelector('[name="name"]')!, "New risk")
    await userEvent.selectOptions(
      container.querySelector('[name="status"]')!,
      "open"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.riskRegister.addRisk" })
    )

    await waitFor(() => expect(mockCreateNewRisk).toHaveBeenCalled())
    const submitted = mockCreateNewRisk.mock.calls[0][0]
    expect(submitted).toMatchObject({
      site_id: "site-1",
      name: "New risk",
      status: "open",
    })
  })

  it("pre-fills the edit form with existing risk data", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })

    const { container } = render(<RiskRegisterPage />)
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"))
    await userEvent.click(editButtons[0])

    expect(
      screen.getByText("organization.riskRegister.editRisk")
    ).toBeInTheDocument()
    expect(container.querySelector('[name="name"]')).toHaveValue(
      "Supply chain disruption"
    )
  })

  it("opens delete confirmation and calls deleteRisk on confirm", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })
    mockDeleteRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<RiskRegisterPage />)
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-trash2"))
    await userEvent.click(deleteButtons[0])
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() => expect(mockDeleteRisk).toHaveBeenCalledWith("risk-1"))
  })

  it("shows an error toast and keeps the confirmation open when delete fails", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })
    mockDeleteRisk.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { message: "Risk is referenced by an action" },
        }),
    })

    render(<RiskRegisterPage />)
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-trash2"))
    await userEvent.click(deleteButtons[0])
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Risk is referenced by an action"
      )
    )
    // The mocked DeleteAlertModal only renders while `open` is still true
    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeInTheDocument()
  })

  it("shows an error toast and keeps the modal open when the create response indicates failure", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
    mockCreateNewRisk.mockReturnValue({
      // manage_response.ts (aexa-server) always sends { success, message,
      // data, meta } — never an `error` key — so `message` carries the
      // failure reason here, not a nested `error.message`.
      unwrap: () =>
        Promise.resolve({
          success: false,
          message: "Name already exists",
        }),
    })

    const { container } = render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )
    await userEvent.selectOptions(
      container.querySelector('[name="site_id"]')!,
      "site-1"
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "Duplicate risk"
    )
    await userEvent.selectOptions(
      container.querySelector('[name="status"]')!,
      "open"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.riskRegister.addRisk" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Name already exists")
    )
    expect(
      screen.getByText("organization.riskRegister.addNewRisk", {
        selector: "h2",
      })
    ).toBeInTheDocument()
  })

  it("shows an error toast and keeps the modal open when the create request rejects (unhandled rejection)", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { message: "Server unavailable" },
        }),
    })

    const { container } = render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )
    await userEvent.selectOptions(
      container.querySelector('[name="site_id"]')!,
      "site-1"
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "Risk that fails to save"
    )
    await userEvent.selectOptions(
      container.querySelector('[name="status"]')!,
      "open"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.riskRegister.addRisk" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server unavailable")
    )
    // Modal should stay open on failure, not call setShowModal(false)
    expect(
      screen.getByText("organization.riskRegister.addNewRisk", {
        selector: "h2",
      })
    ).toBeInTheDocument()
  })

  it("filters risks by search term via the query hook", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })

    render(<RiskRegisterPage />)
    await userEvent.type(
      screen.getByPlaceholderText("organization.riskRegister.searchPlaceholder"),
      "flood"
    )

    await waitFor(() =>
      expect(mockUseGetAllRisksQuery).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: "flood" })
      )
    )
  })
})
