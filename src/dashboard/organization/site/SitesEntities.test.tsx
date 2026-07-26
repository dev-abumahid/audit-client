import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import SitesEntities from "./SitesEntities"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const mockUseGetAllSitesQuery = vi.fn()
const mockCreateNewSite = vi.fn()
const mockUpdateSite = vi.fn()
const mockDeleteSite = vi.fn()
const mockUseGetAllRisksQuery = vi.fn()
const mockDeleteRisk = vi.fn()
const mockCreateNewRisk = vi.fn()
const mockAnalyzeSiteRisks = vi.fn()

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) => mockUseGetAllSitesQuery(...args),
  useCreateNewSiteMutation: () => [mockCreateNewSite, { isLoading: false }],
  useUpdateSiteMutation: () => [mockUpdateSite, { isLoading: false }],
  useDeleteSiteMutation: () => [mockDeleteSite, { isLoading: false }],
}))

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
  useDeleteRiskMutation: () => [mockDeleteRisk],
  useCreateNewRiskMutation: () => [mockCreateNewRisk, { isLoading: false }],
}))

vi.mock("@/redux/apis/organization/ai.api", () => ({
  useAnalyzeSiteRisksMutation: () => [mockAnalyzeSiteRisks, { isLoading: false }],
}))

vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    ...rest
  }: React.ComponentProps<"button"> & { variant?: string; size?: string }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...rest}
    >
      {children}
    </button>
  ),
  buttonVariants: () => "",
}))

function makeSite(overrides = {}) {
  return {
    id: "site-1",
    name: "HQ Casablanca",
    location: "Casablanca",
    country: "Morocco",
    activity: "Finance",
    revenue: 1000000,
    employees_count: 250,
    site_type: "production",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  }
}

describe("SitesEntities", () => {
  beforeEach(() => {
    mockUseGetAllSitesQuery.mockReset()
    mockCreateNewSite.mockReset()
    mockUpdateSite.mockReset()
    mockDeleteSite.mockReset()
    mockUseGetAllRisksQuery.mockReset()
    mockDeleteRisk.mockReset()
    mockCreateNewRisk.mockReset()
    mockAnalyzeSiteRisks.mockReset()
    mockToastError.mockReset()
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
  })

  it("shows a loading spinner while sites are loading", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: true,
      isFetching: true,
      data: undefined,
      error: undefined,
    })

    const { container } = render(<SitesEntities />)

    expect(
      container.querySelector("svg.lucide-loader-circle")
    ).toBeInTheDocument()
  })

  it("shows an error state when the sites query fails", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: undefined,
      error: { status: 500 },
    })

    render(<SitesEntities />)

    expect(screen.getByText("Error loading sites")).toBeInTheDocument()
  })

  it("renders site rows with name, location and country", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(screen.getByText("HQ Casablanca")).toBeInTheDocument()
    expect(screen.getByText(/Location: Casablanca/)).toBeInTheDocument()
  })

  it("shows empty state when there are no sites", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(
      screen.getByText("organization.site&entities.noSite")
    ).toBeInTheDocument()
  })

  it("opens the create-site modal and validates the required name field", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    expect(screen.getByText("Add New Site")).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(screen.getByText("Name is required")).toBeInTheDocument()
    )
    expect(mockCreateNewSite).not.toHaveBeenCalled()
  })

  it("submits the create-site form with the entered name", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })
    mockCreateNewSite.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    const { container } = render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "New Factory"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() => expect(mockCreateNewSite).toHaveBeenCalled())
    expect(mockCreateNewSite.mock.calls[0][0]).toMatchObject({
      name: "New Factory",
    })
  })

  it("pre-fills the edit form with existing site data", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    const { container } = render(<SitesEntities />)
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"))
    await userEvent.click(editButtons[0])

    expect(screen.getByText("Edit Site Information")).toBeInTheDocument()
    expect(container.querySelector('[name="name"]')).toHaveValue(
      "HQ Casablanca"
    )
  })

  it("opens delete confirmation and calls deleteSite on confirm", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockDeleteSite.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<SitesEntities />)
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-trash2"))
    await userEvent.click(deleteButtons[0])
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() => expect(mockDeleteSite).toHaveBeenCalledWith("site-1"))
  })

  it("expands a site to show its confirmed risks", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          {
            id: "risk-99",
            name: "Flooding",
            description: "Seasonal flood risk",
            residual_score: 12,
            ai_generated: false,
          },
        ],
      },
    })

    render(<SitesEntities />)
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)

    expect(screen.getByText("Flooding")).toBeInTheDocument()
  })

  it("opens the manual risk form and submits it for the site", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    const { container } = render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.addRisk/i,
      })
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "Power outage"
    )
    // The status <select> resets to "" in RHF state even though the browser displays
    // the first option ("Open") — must explicitly choose a value or required validation fails silently.
    await userEvent.selectOptions(
      container.querySelector('[name="status"]')!,
      "open"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() => expect(mockCreateNewRisk).toHaveBeenCalled())
    expect(mockCreateNewRisk.mock.calls[0][0]).toMatchObject({
      name: "Power outage",
      site_id: "site-1",
    })
  })

  it("shows an error toast and keeps the form open when saving a site fails", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })
    mockCreateNewSite.mockReturnValue({
      unwrap: () => Promise.reject(new Error("network down")),
    })

    const { container } = render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "New Factory"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.site&entities.saveSiteFailed"
      )
    )
    expect(screen.getByText("Add New Site")).toBeInTheDocument()
  })

  it("shows an error toast and keeps the confirmation open when deleting a site fails", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockDeleteSite.mockReturnValue({
      unwrap: () => Promise.reject(new Error("locked")),
    })

    render(<SitesEntities />)
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-trash2"))
    await userEvent.click(deleteButtons[0])
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.site&entities.deleteSiteFailed"
      )
    )
    // The mocked DeleteAlertModal only renders while `open` is still true
    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeInTheDocument()
  })

  it("shows an error toast when the risk-delete response indicates failure", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          {
            id: "risk-99",
            name: "Flooding",
            residual_score: 12,
            ai_generated: false,
          },
        ],
      },
    })
    mockDeleteRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: false }),
    })

    render(<SitesEntities />)
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)
    await userEvent.click(screen.getByRole("button", { name: /delete/i }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.site&entities.deleteRiskFailed"
      )
    )
  })

  it("shows an error toast and keeps the manual risk form open when creating a risk rejects (unhandled rejection)", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Server unavailable" } }),
    })

    const { container } = render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.addRisk/i,
      })
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "Power outage"
    )
    await userEvent.selectOptions(
      container.querySelector('[name="status"]')!,
      "open"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server unavailable")
    )
    // The manual risk form should still be showing so the user can retry
    expect(
      screen.getByText("organization.site&entities.addRiskTitle")
    ).toBeInTheDocument()
  })

  it("shows an error toast when deleting a risk rejects (unhandled rejection)", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          {
            id: "risk-99",
            name: "Flooding",
            residual_score: 12,
            ai_generated: false,
          },
        ],
      },
    })
    mockDeleteRisk.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Risk is locked" } }),
    })

    render(<SitesEntities />)
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)
    await userEvent.click(screen.getByRole("button", { name: /delete/i }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Risk is locked")
    )
  })

  it("shows an error toast when the manual-risk-create response indicates failure", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: false }),
    })

    const { container } = render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.addRisk/i,
      })
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "Power outage"
    )
    await userEvent.selectOptions(
      container.querySelector('[name="status"]')!,
      "open"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.site&entities.createRiskFailed"
      )
    )
  })

  function makeSuggestion(overrides = {}) {
    return {
      risk_id: "sugg-1",
      title: "Supplier concentration",
      description: "Single supplier for a critical part",
      category: "Operational",
      site: "HQ Casablanca",
      inherent_risk_score: "High",
      residual_risk_score: "Medium",
      Probability: 0.6,
      minimum_Impact: "€500K",
      maximum_impact: "€2M",
      Velocity: "fast",
      Trend: "increasing",
      Responsable: "Supply Chain Manager",
      score: 14,
      ...overrides,
    }
  }

  it("runs AI analysis and renders the returned suggestions", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockAnalyzeSiteRisks.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: [makeSuggestion()] }),
    })

    render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.analyzeAi/i,
      })
    )

    await waitFor(() =>
      expect(screen.getByText("Supplier concentration")).toBeInTheDocument()
    )
    expect(mockAnalyzeSiteRisks).toHaveBeenCalledWith("site-1")
  })

  it("shows an error toast and no suggestions panel when AI analysis fails", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockAnalyzeSiteRisks.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "AI service unavailable" } }),
    })

    render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.analyzeAi/i,
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("AI service unavailable")
    )
    expect(screen.queryByText(/review before importing/i)).toBeNull()
  })

  it("imports a selected suggestion into the register with the mapped payload", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockAnalyzeSiteRisks.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: [makeSuggestion()] }),
    })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.analyzeAi/i,
      })
    )
    await waitFor(() =>
      expect(screen.getByText("Supplier concentration")).toBeInTheDocument()
    )

    await userEvent.click(screen.getByRole("checkbox"))
    await userEvent.click(
      screen.getByRole("button", { name: /import selected/i })
    )

    await waitFor(() => expect(mockCreateNewRisk).toHaveBeenCalled())
    const payload = mockCreateNewRisk.mock.calls[0][0]
    expect(payload).toMatchObject({
      name: "Supplier concentration",
      description: "Single supplier for a critical part",
      category: "operational",
      site_id: "site-1",
      status: "open",
      ai_generated: true,
      source_info: "AI Suggested",
      velocity: "fast",
      trend: "increasing",
      inherent_score: 8,
      residual_score: 5,
      probability: 60,
    })
    // financial_impact_min/max are free text on the AI response ("€500K",
    // "€2M") and don't reliably parse to the Risk model's Int fields — must
    // never be forwarded, not even as unparsed strings.
    expect(payload).not.toHaveProperty("financial_impact_min")
    expect(payload).not.toHaveProperty("financial_impact_max")
  })

  it("falls back to the raw AI category string when it doesn't match a known category", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockAnalyzeSiteRisks.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: [makeSuggestion({ category: "Something Unrecognized" })],
        }),
    })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.analyzeAi/i,
      })
    )
    await waitFor(() =>
      expect(screen.getByText("Supplier concentration")).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole("checkbox"))
    await userEvent.click(
      screen.getByRole("button", { name: /import selected/i })
    )

    await waitFor(() => expect(mockCreateNewRisk).toHaveBeenCalled())
    expect(mockCreateNewRisk.mock.calls[0][0]).toMatchObject({
      category: "Something Unrecognized",
    })
  })

  // Regression test for the labelKey refactor (aexa-frontend#199): matching
  // now resolves each category's label from en.json rather than a hardcoded
  // string, so this exercises the actual label-substring match path (not
  // just the trivial key === normalized case every category also satisfies
  // when the AI happens to return the exact key) — "Cybersecurity" only
  // matches "cyber" through its English label, per the code's own comment.
  it("matches an AI category to a known category by label, not just by exact key", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockAnalyzeSiteRisks.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: [makeSuggestion({ category: "Cybersecurity" })],
        }),
    })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.analyzeAi/i,
      })
    )
    await waitFor(() =>
      expect(screen.getByText("Supplier concentration")).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole("checkbox"))
    await userEvent.click(
      screen.getByRole("button", { name: /import selected/i })
    )

    await waitFor(() => expect(mockCreateNewRisk).toHaveBeenCalled())
    expect(mockCreateNewRisk.mock.calls[0][0]).toMatchObject({
      category: "cyber",
    })
  })

  it("does not let a slow analysis for one site overwrite the suggestions already shown for another", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: {
        data: [
          makeSite({ id: "site-1", name: "HQ Casablanca" }),
          makeSite({ id: "site-2", name: "Lyon Plant" }),
        ],
        meta: { page: 1, limit: 10, total: 2 },
      },
      error: undefined,
    })

    let resolveSiteOne: (value: unknown) => void = () => {}
    const siteOnePromise = new Promise((resolve) => {
      resolveSiteOne = resolve
    })
    mockAnalyzeSiteRisks.mockImplementationOnce(() => ({
      unwrap: () => siteOnePromise,
    }))
    mockAnalyzeSiteRisks.mockImplementationOnce(() => ({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: [makeSuggestion({ risk_id: "sugg-2", title: "Flood exposure" })],
        }),
    }))

    render(<SitesEntities />)
    const analyzeButtons = screen.getAllByRole("button", {
      name: /organization.site&entities.analyzeAi/i,
    })

    // Start analyzing site 1 (slow, not yet resolved) then switch to site 2
    // before it finishes.
    await userEvent.click(analyzeButtons[0])
    await userEvent.click(analyzeButtons[1])

    await waitFor(() =>
      expect(screen.getByText("Flood exposure")).toBeInTheDocument()
    )

    // Site 1's request finally resolves after the user has moved on — its
    // suggestions must not appear under site 2's now-current panel.
    resolveSiteOne({
      success: true,
      data: [makeSuggestion({ risk_id: "sugg-1", title: "Supplier concentration" })],
    })

    await waitFor(() => Promise.resolve())
    expect(screen.queryByText("Supplier concentration")).not.toBeInTheDocument()
    expect(screen.getByText("Flood exposure")).toBeInTheDocument()
  })

  it("removes an imported suggestion from the panel but keeps unselected ones", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockAnalyzeSiteRisks.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: [
            makeSuggestion({ risk_id: "sugg-1", title: "Supplier concentration" }),
            makeSuggestion({ risk_id: "sugg-2", title: "Flood exposure" }),
          ],
        }),
    })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.analyzeAi/i,
      })
    )
    await waitFor(() =>
      expect(screen.getByText("Supplier concentration")).toBeInTheDocument()
    )

    const [firstCheckbox] = screen.getAllByRole("checkbox")
    await userEvent.click(firstCheckbox)
    await userEvent.click(
      screen.getByRole("button", { name: /import selected/i })
    )

    await waitFor(() =>
      expect(
        screen.queryByText("Supplier concentration")
      ).not.toBeInTheDocument()
    )
    expect(screen.getByText("Flood exposure")).toBeInTheDocument()
  })
})
