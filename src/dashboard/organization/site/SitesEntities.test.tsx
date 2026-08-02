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

// aexa-frontend#217 -- role hook mocked per-test via this mutable holder,
// same convention as RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
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
    mockRole = "ADMIN"
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

  it("shows New Site, Add Risk, Edit and Delete for an ADMIN, plus the read-only Analyze button", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(
      screen.getByText("organization.site&entities.newSite")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.addRisk")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.analyzeAi")
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pencil"))
    ).toBe(true)
  })

  it("hides New Site, Add Risk, Edit and Delete for a VIEWER but keeps Analyze", () => {
    mockRole = "VIEWER"
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(
      screen.queryByText("organization.site&entities.newSite")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("organization.site&entities.addRisk")
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.analyzeAi")
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pencil"))
    ).toBe(false)
  })

  it("hides write controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(
      screen.queryByText("organization.site&entities.newSite")
    ).not.toBeInTheDocument()
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

    // Regression (audit round 3): this state used to be hardcoded English
    // ("Error loading sites"/"Please try again later"), bypassing t()
    // entirely. t() is mocked to return the raw key in this file, so
    // asserting the key (not the old hardcoded string) proves it now goes
    // through translation.
    expect(
      screen.getByText("organization.site&entities.errorLoadingSitesTitle")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "organization.site&entities.errorLoadingSitesDescription"
      )
    ).toBeInTheDocument()
    expect(screen.queryByText("Error loading sites")).not.toBeInTheDocument()
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
    expect(
      screen.getByText(
        /organization\.site&entities\.siteLocationLabel: Casablanca/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /organization\.site&entities\.siteCountryLabel: Morocco/
      )
    ).toBeInTheDocument()
  })

  // Bug-fix batch: the subtitle used to unconditionally render
  // "Location:  • Country: " with dangling empty values when a site had no
  // location/country, and duplicated the country a second time.
  it("omits Location/Country segments that are empty instead of showing dangling colons", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: {
        data: [makeSite({ location: "", country: "", activity: "" })],
        meta: { page: 1, limit: 10, total: 1 },
      },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(
      screen.queryByText(/organization\.site&entities\.siteLocationLabel/)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/organization\.site&entities\.siteCountryLabel/)
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.noAdditionalDetails")
    ).toBeInTheDocument()
  })

  it("does not duplicate the country when only country is present", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: {
        data: [makeSite({ location: "", activity: "" })],
        meta: { page: 1, limit: 10, total: 1 },
      },
      error: undefined,
    })

    render(<SitesEntities />)

    const countryMatches = screen.getAllByText(/Morocco/)
    expect(countryMatches).toHaveLength(1)
  })

  it("shows only the activity when location and country are both empty", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: {
        data: [makeSite({ location: "", country: "" })],
        meta: { page: 1, limit: 10, total: 1 },
      },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(screen.getByText("Finance")).toBeInTheDocument()
    expect(
      screen.queryByText("organization.site&entities.noAdditionalDetails")
    ).not.toBeInTheDocument()
  })

  // Regression (issue #361): SourceBadge's isEdited prop was fed
  // site.updatedAt (always truthy once a site's been saved once), which
  // looked like real data but was actually dead -- aiGenerated was
  // hardcoded false, and SourceBadge only branches on isEdited when
  // aiGenerated is true. Site/SiteSummary has no ai_generated/is_edited
  // fields at all (unlike compliance obligations), so sites always render
  // the plain manual badge regardless of updatedAt.
  it("always shows the manual source badge for a site, even when it has been updated", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: {
        data: [makeSite({ updatedAt: "2026-07-15T10:00:00.000Z" })],
        meta: { page: 1, limit: 10, total: 1 },
      },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(screen.getByText("common.sourceBadge.manual")).toBeInTheDocument()
    expect(
      screen.queryByText("common.sourceBadge.modifiedAi")
    ).not.toBeInTheDocument()
    expect(screen.queryByText("common.sourceBadge.ai")).not.toBeInTheDocument()
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

    // Regression (audit round 3): the modal title and this validation
    // message used to be hardcoded English, bypassing t(). t() is mocked to
    // return the raw key in this file.
    expect(
      screen.getByText("organization.site&entities.addNewSiteTitle")
    ).toBeInTheDocument()
    expect(screen.queryByText("Add New Site")).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(
        screen.getByText("organization.site&entities.nameRequired")
      ).toBeInTheDocument()
    )
    expect(screen.queryByText("Name is required")).not.toBeInTheDocument()
    expect(mockCreateNewSite).not.toHaveBeenCalled()
  })

  // Regression (audit round 3): the Location, Country and Revenue field
  // labels in this modal were hardcoded English, bypassing t() (unlike the
  // other fields in the same form, e.g. Site Name/Site Type, which already
  // went through it).
  it("renders the site modal's Location, Country and Revenue labels through t(), not hardcoded English", async () => {
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

    expect(
      screen.getByText("organization.site&entities.siteLocationLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.siteCountryLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.revenueLabel")
    ).toBeInTheDocument()
    expect(screen.queryByText("Location")).not.toBeInTheDocument()
    expect(screen.queryByText("Country")).not.toBeInTheDocument()
    expect(screen.queryByText("Revenue")).not.toBeInTheDocument()
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

    expect(
      screen.getByText("organization.site&entities.editSiteTitle")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Edit Site Information")
    ).not.toBeInTheDocument()
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
            ref: "RSK-2026-0142",
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
    // Regression (audit round 4 / #343): this row used to fabricate an
    // "RS-{id-fragment}" label instead of showing the real risk.ref -- assert
    // the real ref renders, and that no fabricated "RS-" label appears.
    expect(screen.getByText("RSK-2026-0142")).toBeInTheDocument()
    expect(screen.queryByText(/^RS-/)).not.toBeInTheDocument()
    // Regression (audit round 3): "✅ Confirmed risks (in the register)" was
    // hardcoded English apart from the emoji.
    expect(
      screen.getByText(
        /organization\.site&entities\.confirmedRisksHeading/
      )
    ).toBeInTheDocument()
    // Regression (audit round 3): the ai_generated/manual badge text
    // ("🤖 AI" / "👤 Manual") was hardcoded English apart from the emoji.
    expect(
      screen.getByText(/organization\.site&entities\.manualBadge/)
    ).toBeInTheDocument()
    // Regression (audit round 4 / #344): the ref/name row used gap-16
    // (a much larger gap than sibling rows in this file); confirmed risks
    // now use gap-2, matching the badge row directly below it.
    expect(screen.getByText("RSK-2026-0142").parentElement).toHaveClass(
      "gap-2"
    )
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

  // Regression (audit round 3): the manual risk form's "Risk Name *",
  // "Status *", "Category" and "Description" labels, plus the Open/In
  // Progress/Completed/Closed status options, were hardcoded English.
  it("renders the manual risk form's field labels and status options through t(), not hardcoded English", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    render(<SitesEntities />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.addRisk/i,
      })
    )

    expect(
      screen.getByText("organization.site&entities.riskNameLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.statusLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.categoryLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.descriptionLabel")
    ).toBeInTheDocument()
    expect(screen.queryByText("Risk Name")).not.toBeInTheDocument()
    expect(screen.queryByText("Status")).not.toBeInTheDocument()
    expect(screen.queryByText("Category")).not.toBeInTheDocument()
    expect(screen.queryByText("Description")).not.toBeInTheDocument()

    expect(
      screen.getByText("organization.site&entities.statusOpen")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.statusInProgress")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.statusCompleted")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.statusClosed")
    ).toBeInTheDocument()
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
    expect(
      screen.getByText("organization.site&entities.addNewSiteTitle")
    ).toBeInTheDocument()
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

  it("hides the confirmed-risk Delete button for a VIEWER", async () => {
    mockRole = "VIEWER"
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

    render(<SitesEntities />)
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)

    expect(
      screen.queryByRole("button", { name: /delete/i })
    ).not.toBeInTheDocument()
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

  // Regression (audit round 3): the AI-suggested-risks panel heading, the
  // "Import selected (n)" button, and the Inherent/Residual/Probability/
  // Velocity/Trend/Suggested owner detail labels were all hardcoded English,
  // bypassing t(). t() is mocked to return the raw key in this file (with no
  // interpolation), so asserting the keys -- not the old hardcoded strings
  // -- proves the panel now goes through translation.
  it("renders the AI-suggested-risks panel heading and detail labels through t(), not hardcoded English", async () => {
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

    expect(
      screen.getByText(
        "organization.site&entities.aiSuggestedRisksHeading"
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.site&entities.importSelected")
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/AI-suggested risks — review before importing/)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/^Import selected/)).not.toBeInTheDocument()

    for (const key of [
      "inherentLabel",
      "residualLabel",
      "probabilityLabel",
      "velocityLabel",
      "trendLabel",
      "suggestedOwnerLabel",
    ]) {
      expect(
        screen.getByText(
          new RegExp(`organization\\.site&entities\\.${key}`)
        )
      ).toBeInTheDocument()
    }
  })

  it("hides the Import selected button for a VIEWER even with suggestions shown", async () => {
    mockRole = "VIEWER"
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
    expect(screen.queryByText(/Import selected/i)).not.toBeInTheDocument()
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
      screen.getByRole("button", { name: /organization\.site&entities\.importSelected/i })
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
      screen.getByRole("button", { name: /organization\.site&entities\.importSelected/i })
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
      screen.getByRole("button", { name: /organization\.site&entities\.importSelected/i })
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

  // Regression (audit round 3): the pagination summary ("Showing X-Y of Z")
  // was a hardcoded English template string, bypassing t(). t() is mocked
  // to return the raw key with no interpolation in this file, so asserting
  // the key (not the old hardcoded text) proves it now goes through
  // translation.
  it("renders the pagination summary through t(), not a hardcoded 'Showing X-Y of Z' string", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 25 } },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(
      screen.getByText("organization.site&entities.showingRange")
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Showing /)).not.toBeInTheDocument()
  })

  // aexa-frontend#265: the delete-path counterpart to #234/#243 (this file's
  // own debouncedSearch effect resets page on a search change, but nothing
  // resets it when a delete alone shrinks totalPages).
  it("aexa-frontend#265: clamps the page back into range after deleting the last site on the last page", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 25 } },
      error: undefined,
    })
    mockDeleteSite.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<SitesEntities />)

    const nextButton = () =>
      screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-chevron-right"))!

    // totalPages = ceil(25/10) = 3 -- page to the last page.
    await userEvent.click(nextButton())
    await userEvent.click(nextButton())
    await waitFor(() =>
      expect(mockUseGetAllSitesQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 3 })
      )
    )

    // Deleting the last site on page 3 drops total to 15 -> totalPages 2,
    // stranding page 3 out of range.
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 3, limit: 10, total: 15 } },
      error: undefined,
    })

    const deleteButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-trash2"))
    await userEvent.click(deleteButtons[0])
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockUseGetAllSitesQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      )
    )
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
      screen.getByRole("button", { name: /organization\.site&entities\.importSelected/i })
    )

    await waitFor(() =>
      expect(
        screen.queryByText("Supplier concentration")
      ).not.toBeInTheDocument()
    )
    expect(screen.getByText("Flood exposure")).toBeInTheDocument()
  })
})
