import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { MemoryRouter } from "react-router"
import SitesEntities from "./SitesEntities"

// aexa-frontend#533: the search box is now pre-fillable from a ?search=
// param and the highlight effect reads ?siteId=, so this needs a Router
// context -- same convention as InspectionTable.test.tsx's renderTable().
function renderPage(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SitesEntities />
    </MemoryRouter>
  )
}

// jsdom doesn't implement scrollIntoView at all (unlike window.scrollTo,
// which it stubs with a console warning) -- same fix as
// KriDashboardPage.test.tsx's #530 highlight tests.
Element.prototype.scrollIntoView = vi.fn()

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)
const mockToastSuccess = vi.mocked(toast.success)

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
const mockFetchSiteById = vi.fn()
const mockUseGetAllRisksQuery = vi.fn()
const mockDeleteRisk = vi.fn()
const mockCreateNewRisk = vi.fn()
const mockAnalyzeSiteRisks = vi.fn()

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) => mockUseGetAllSitesQuery(...args),
  useLazyGetSiteByIdQuery: () => [mockFetchSiteById],
  useCreateNewSiteMutation: () => [mockCreateNewSite, { isLoading: false }],
  useUpdateSiteMutation: () => [mockUpdateSite, { isLoading: false }],
  useDeleteSiteMutation: () => [mockDeleteSite, { isLoading: false }],
}))

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
  useDeleteRiskMutation: () => [mockDeleteRisk, { isLoading: false }],
  useCreateNewRiskMutation: () => [mockCreateNewRisk, { isLoading: false }],
}))

vi.mock("@/redux/apis/organization/ai.api", () => ({
  useAnalyzeSiteRisksMutation: () => [mockAnalyzeSiteRisks, { isLoading: false }],
}))

vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
}))

// Radix DropdownMenu needs pointer-capture APIs jsdom doesn't implement, same
// reason InspectionTable.test.tsx swaps out its Select. Content is rendered
// unconditionally (no open/closed simulation) so Edit/Delete are directly
// queryable per row without needing to click the trigger first.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    variant?: string
  }) => (
    <button onClick={onClick} data-variant={variant}>
      {children}
    </button>
  ),
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
    mockFetchSiteById.mockReset()
    mockUseGetAllRisksQuery.mockReset()
    mockDeleteRisk.mockReset()
    mockCreateNewRisk.mockReset()
    mockAnalyzeSiteRisks.mockReset()
    mockToastError.mockReset()
    mockToastSuccess.mockReset()
    ;(Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear()
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
    // Edit opens a per-site detail fetch (aexa-frontend#401); default to a
    // never-resolving promise so tests that don't care about it aren't
    // affected, individual tests override with a resolved/rejected value.
    mockFetchSiteById.mockReturnValue({ unwrap: () => new Promise(() => {}) })
  })

  it("shows New Site, Add Risk, Edit and Delete for an ADMIN, plus the read-only Analyze button", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    renderPage()

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

  // Regression (aexa-frontend round-9 audit #470): Edit/Delete/expand-collapse
  // controls, the search input, and the create/edit modal's close button had
  // zero aria-labels, so screen-reader users only got a bare icon with no
  // accessible name.
  it("gives Edit, Delete, expand/collapse and the search input accessible names", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    renderPage()

    expect(
      screen.getByRole("textbox", {
        name: "organization.site&entities.searchSitesLabel",
      })
    ).toBeInTheDocument()

    // Edit/Delete are now behind a "more actions" dropdown trigger (round-2
    // audit: consolidated from two always-visible icon buttons into a menu).
    const moreActionsButton = screen.getAllByRole("button").find((b) =>
      b.querySelector("svg.lucide-ellipsis-vertical")
    )!
    expect(moreActionsButton).toHaveAccessibleName(
      "organization.site&entities.moreActionsLabel"
    )
    // quality-bar-loop round 5 (mobile) bumped padding to p-3.5 for a real
    // 44px touch target, but round 6 (visual-polish) found this visibly
    // overshot its ~32px-tall row neighbors -- reverted the visible size to
    // p-2 (32x32px) and extended the invisible clickable area to 44px via
    // a `before:` hit-slop pseudo-element instead (asserted below).
    expect(moreActionsButton).toHaveClass("p-2")
    expect(moreActionsButton).toHaveClass("before:-inset-1.5")
    // Round-1 review of PR #613: the kebab's before:-inset-1.5 (6px) and
    // the chevron's before:-inset-1 (4px) hit-slops extend toward each
    // other across the row's gap -- 6+4=10px would overlap a gap-2 (8px)
    // gap, letting a tap in that ~2px sliver hit the wrong button. Asserts
    // the row uses gap-3 (12px), which fits both hit-slops without
    // overlapping (verified live via getBoundingClientRect() math).
    // This file's DropdownMenu mock (above) wraps its children in an
    // unstyled <div>, one level deeper than the real Radix component
    // renders -- skip that mock-only wrapper to reach the real row div.
    expect(moreActionsButton.parentElement?.parentElement).toHaveClass(
      "gap-3"
    )

    const editButton = screen.getAllByRole("button").find((b) =>
      b.querySelector("svg.lucide-pencil")
    )!
    expect(editButton).toHaveTextContent("organization.site&entities.editAction")

    const deleteButton = screen.getAllByRole("button").find((b) =>
      b.querySelector("svg.lucide-trash-2")
    )!
    expect(deleteButton).toHaveTextContent(
      "organization.site&entities.deleteAction"
    )

    const expandButton = screen.getAllByRole("button").find((b) =>
      b.querySelector("svg.lucide-chevron-down")
    )!
    expect(expandButton).toHaveAttribute("aria-expanded", "false")
    expect(expandButton).toHaveAccessibleName(
      "organization.site&entities.expandSiteLabel"
    )
    // quality-bar-loop round 5/6: see the "more actions" trigger's comment
    // above -- same hit-slop fix, visible size back to p-2 (36x36px).
    expect(expandButton).toHaveClass("p-2")
    expect(expandButton).toHaveClass("before:-inset-1")

    await userEvent.click(expandButton)
    expect(expandButton).toHaveAttribute("aria-expanded", "true")
    expect(expandButton).toHaveAccessibleName(
      "organization.site&entities.collapseSiteLabel"
    )
  })

  // type=button sweep finding: 7 non-submit buttons had no explicit type,
  // defaulting to type="submit" -- a real footgun since this file also
  // renders two real <form>s (Add Risk, and the site create/edit modal),
  // whose own Cancel/Submit buttons already declared their type correctly.
  // Scoped to just these 7 (not a full sweep) since this file also renders
  // shadcn <Button> components (a separate, pre-existing gap, out of
  // scope here).
  it("gives every non-submit non-shadcn button an explicit type=\"button\"", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    renderPage()

    // New Site trigger.
    expect(
      screen
        .getByRole("button", { name: "organization.site&entities.newSite" })
        .getAttribute("type")
    ).toBe("button")

    // Analyze AI.
    expect(
      screen
        .getByRole("button", { name: /organization.site&entities.analyzeAi/i })
        .getAttribute("type")
    ).toBe("button")

    // "More actions" kebab trigger.
    const moreActionsButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-ellipsis-vertical"))!
    expect(moreActionsButton.getAttribute("type")).toBe("button")

    // Expand/collapse chevron.
    const expandButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-chevron-down"))!
    expect(expandButton.getAttribute("type")).toBe("button")

    // "Add Risk" trigger (opens the risk form).
    expect(
      screen
        .getByRole("button", { name: "organization.site&entities.addRisk" })
        .getAttribute("type")
    ).toBe("button")

    // Site create/edit modal's close button.
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.newSite" })
    )
    expect(
      screen
        .getByRole("button", {
          name: "organization.site&entities.closeModalLabel",
        })
        .getAttribute("type")
    ).toBe("button")
  })

  it("gives the AI-suggestions 'Import selected' button an explicit type=\"button\"", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockAnalyzeSiteRisks.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: [makeSuggestion()] }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.analyzeAi/i,
      })
    )
    await waitFor(() =>
      expect(screen.getByText("Supplier concentration")).toBeInTheDocument()
    )

    expect(
      screen
        .getByRole("button", {
          name: /organization\.site&entities\.importSelected/i,
        })
        .getAttribute("type")
    ).toBe("button")
  })

  it("gives the create/edit modal's close button an accessible name", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.newSite" })
    )

    expect(
      screen.getByRole("button", {
        name: "organization.site&entities.closeModalLabel",
      })
    ).toBeInTheDocument()
  })

  // quality-bar-loop round 14 (mobile findings, open since round 1)
  describe("mobile findings (round 14)", () => {
    it("makes the search box responsive (w-full sm:w-80) instead of a fixed 320px width", () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        isLoading: false,
        isFetching: false,
        data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
        error: undefined,
      })

      renderPage()
      const search = screen.getByLabelText(
        "organization.site&entities.searchSitesLabel"
      )
      expect(search.parentElement).toHaveClass("w-full")
      expect(search.parentElement).toHaveClass("sm:w-80")
      expect(search.parentElement).not.toHaveClass("w-80")
    })

    it("gives the Create/Edit Site modal a scroll safety net (max-h-[90vh] overflow-y-auto)", async () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        isLoading: false,
        isFetching: false,
        data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
        error: undefined,
      })

      renderPage()
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.site&entities.newSite",
        })
      )

      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveClass("max-h-[90vh]")
      expect(dialog).toHaveClass("overflow-y-auto")
    })

    it("gives the Create/Edit Site modal's close button a 44px hit-slop without growing its visible size", async () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        isLoading: false,
        isFetching: false,
        data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
        error: undefined,
      })

      renderPage()
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.site&entities.newSite",
        })
      )

      const closeButton = screen.getByRole("button", {
        name: "organization.site&entities.closeModalLabel",
      })
      expect(closeButton).toHaveClass("before:-inset-2.5")
      expect(closeButton.querySelector("svg")).toHaveClass("h-6")
      expect(closeButton.querySelector("svg")).toHaveClass("w-6")
    })
  })

  it("hides New Site, Add Risk, Edit and Delete for a VIEWER but keeps Analyze", () => {
    mockRole = "VIEWER"
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    renderPage()

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

    renderPage()

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

    const { container } = renderPage()

    expect(
      container.querySelector("svg.lucide-loader-circle")
    ).toBeInTheDocument()
  })

  // quality-bar-loop round 15 (visual-polish finding, open since round
  // 1): the summary tiles used a smaller scale (h-9 icon box, p-4,
  // text-xl value, text-xs label) than the shared MetricCard component
  // (h-10, p-5, text-2xl, text-sm).
  it("scales the summary tiles to match MetricCard's icon/padding/typography", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 3 } },
      error: undefined,
    })

    renderPage()
    const totalSitesValue = screen.getByText("3")
    const tile = totalSitesValue.closest(".rounded-xl")!
    expect(tile).toHaveClass("p-5")
    expect(totalSitesValue).toHaveClass("text-2xl")
    expect(
      screen.getByText("organization.site&entities.summary.totalSites")
    ).toHaveClass("text-sm")
    expect(tile.querySelector(".h-10.w-10")).toBeInTheDocument()
  })

  it("shows an error state when the sites query fails", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: undefined,
      error: { status: 500 },
    })

    renderPage()

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

  // quality-bar-loop round 16 (industry-standards finding, open since
  // round 1): this whole-page error state had no retry button -- the
  // user's only recourse was a full page reload/re-navigation, unlike
  // every other error state in the app.
  it("retries the sites query when the error state's retry button is clicked", async () => {
    const mockRefetch = vi.fn()
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: undefined,
      error: { status: 500 },
      refetch: mockRefetch,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.site&entities.retryLoadingSites",
      })
    )

    expect(mockRefetch).toHaveBeenCalled()
  })

  // quality-bar-loop round 1 (resilience): the org-wide risk query never
  // checked isError -- a genuine fetch failure fell through to
  // `allRisksData?.data ?? []`, rendering the summary tiles identically to
  // a genuinely risk-free org (0 for all three risk-derived tiles) with no
  // indication anything failed.
  it("shows a dash instead of a false zero on the risk summary tiles when the org-wide risk query fails", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockReturnValue({ data: undefined, isError: true })

    renderPage()

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  // quality-bar-loop round 1 (resilience): the per-site expanded-panel risk
  // query never checked isError either -- a fetch failure rendered a blank
  // body under the "Confirmed risks" heading (not even the "no risks"
  // empty-state message, since `riskData?.data.length === 0` is `false`
  // when `riskData` is `undefined`), indistinguishable from a slow-loading
  // or broken panel with zero feedback.
  it("shows a distinct error message, not the empty state, when a site's own risk query fails", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockImplementation((args: { siteId?: string }) =>
      args?.siteId
        ? { data: undefined, isError: true }
        : { data: { data: [] }, isError: false }
    )

    renderPage()
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)

    expect(
      screen.getByText("organization.site&entities.riskLoadFailed")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.site&entities.noConfirmedRisks")
    ).not.toBeInTheDocument()
  })

  // quality-bar-loop round 13 (visual-polish finding, open since round
  // 1): the expanded panel's wrapper had text-center, but only the
  // heading opted back out with text-start -- loading/error/empty text
  // visibly centered under a left-aligned heading. Now explicitly
  // left-aligned.
  it("left-aligns the empty-risks state text to match the left-aligned heading, not centered", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [] },
      isError: false,
      isLoading: false,
    })

    renderPage()
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)

    const emptyState = screen.getByText(
      "organization.site&entities.noConfirmedRisks"
    )
    expect(emptyState).toHaveClass("text-start")
    expect(emptyState.parentElement).not.toHaveClass("text-center")
  })

  // getRiskSeverityLevel silently maps a missing/malformed residual_score
  // to 0 ("low"), so filtering the critical-risks tile straight off its
  // result would silently exclude a risk whose real severity is unknown
  // from the count -- worse than the other consumers of
  // getRiskSeverityLevel, since this doesn't just mis-color a badge, it
  // hides a risk that might genuinely be critical from a headline stat.
  it("excludes a risk with a malformed residual_score from the critical-risks count and flags it with a '+' lower-bound hint", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockImplementation((args: { siteId?: string }) =>
      args?.siteId
        ? { data: { data: [] }, isError: false }
        : {
            data: {
              data: [
                { id: "r1", residual_score: 90, ai_generated: false },
                { id: "r2", residual_score: "", ai_generated: false },
              ],
              meta: { total: 2 },
            },
            isError: false,
          }
    )

    renderPage()

    const criticalTile = screen
      .getByText("organization.site&entities.summary.criticalRisks")
      .previousElementSibling as HTMLElement
    expect(criticalTile).toHaveTextContent("1+")
    expect(criticalTile).toHaveAttribute(
      "title",
      "organization.site&entities.summary.unscoredHint"
    )
  })

  it("does not show the unscored '+' hint when every risk has a valid residual_score", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockImplementation((args: { siteId?: string }) =>
      args?.siteId
        ? { data: { data: [] }, isError: false }
        : {
            data: {
              data: [{ id: "r1", residual_score: 90, ai_generated: false }],
              meta: { total: 1 },
            },
            isError: false,
          }
    )

    renderPage()

    const criticalTile = screen
      .getByText("organization.site&entities.summary.criticalRisks")
      .previousElementSibling as HTMLElement
    expect(criticalTile).toHaveTextContent("1")
    expect(criticalTile).not.toHaveTextContent("1+")
    expect(criticalTile).not.toHaveAttribute("title")
  })

  it("renders site rows with name, location and country", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    renderPage()

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

    renderPage()

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

    renderPage()

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

    renderPage()

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

    renderPage()

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

    renderPage()

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

    renderPage()
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

  // quality-bar-loop round 17 (accessibility finding, fresh audit): every
  // label in this form was a plain sibling <label> with no htmlFor, and
  // its input/select/textarea had no id -- 7 controls here with no
  // programmatic name at all (WCAG 1.3.1/4.1.2). getByLabelText only
  // succeeds when a real label/control association exists (via htmlFor/
  // id, aria-labelledby, or wrapping), so this exercises the actual fix,
  // not just a visual proximity check.
  it("programmatically associates every Create/Edit Site field with its label", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    for (const label of [
      /organization\.site&entities\.siteName/,
      "organization.site&entities.siteLocationLabel",
      "organization.site&entities.siteCountryLabel",
      "organization.site&entities.siteType",
      /organization\.site&entities\.activity(?!Required)/,
      "organization.site&entities.revenueLabel",
      "organization.site&entities.employees",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  // quality-bar-loop round 18 (accessibility finding, fresh audit):
  // required fields had no native required/aria-required -- validation
  // was JS-only, surfaced after submit rather than announced up front to
  // assistive tech.
  it("marks the Site Name field as aria-required", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    expect(
      screen.getByLabelText(/organization\.site&entities\.siteName/)
    ).toHaveAttribute("aria-required", "true")
  })

  // Regression (round 12 audit, aexa-frontend#498): RHF's `required` rule
  // only checks truthiness, so a whitespace-only name used to pass it and
  // silently fail an `if (!values.name.trim()) return` guard in handleSave
  // -- Save appeared to do nothing, with no visible error. A `validate` rule
  // now catches this and renders the same inline error as the empty-name
  // case.
  it("shows a visible error for a whitespace-only site name instead of silently failing", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    await userEvent.type(
      screen.getByPlaceholderText(
        "organization.site&entities.exampleSitePlaceholder"
      ),
      "   "
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(
        screen.getByText("organization.site&entities.nameRequired")
      ).toBeInTheDocument()
    )
    expect(mockCreateNewSite).not.toHaveBeenCalled()
  })

  // aexa-frontend#917: a site with no primary activity 400s out of
  // aexa-ai's /risk_analysis endpoint the moment someone clicks "Analyze
  // AI" (site_primary_activity is required server-side), but nothing
  // upstream previously enforced that a site actually has one. Activity is
  // now required at creation, same pattern as the Site Name field above.
  it("marks the Activity field as aria-required and blocks submit when empty", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    const { container } = renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    expect(
      screen.getByLabelText(/organization\.site&entities\.activity(?!Required)/)
    ).toHaveAttribute("aria-required", "true")

    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "New Factory"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(
        screen.getByText("organization.site&entities.activityRequired")
      ).toBeInTheDocument()
    )
    expect(mockCreateNewSite).not.toHaveBeenCalled()
  })

  // aexa-frontend#917 review round 1: making Activity required could have
  // hard-blocked editing ANY other field on a pre-existing site that
  // already had a blank activity (created before this validation existed),
  // until the user also backfilled Activity. That's a bigger UX change than
  // this fix intends -- aexa-server has its own guard that turns Analyze AI
  // into a clear error for exactly this case (aexa-server#337), so the
  // frontend only needs to stop *new* blank activities, not retroactively
  // block edits on old ones.
  it("does not require Activity when editing an existing site whose activity was already blank", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: {
        data: [makeSite({ activity: "" })],
        meta: { page: 1, limit: 10, total: 1 },
      },
      error: undefined,
    })
    mockFetchSiteById.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, data: makeSite({ activity: "" }) }),
    })
    mockUpdateSite.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    renderPage()
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"))
    await userEvent.click(editButtons[0])

    expect(
      screen.getByLabelText(/organization\.site&entities\.activity(?!Required)/)
    ).toHaveAttribute("aria-required", "false")

    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.update" })
    )

    await waitFor(() => expect(mockUpdateSite).toHaveBeenCalled())
    expect(
      screen.queryByText("organization.site&entities.activityRequired")
    ).not.toBeInTheDocument()
  })

  it("still requires Activity when editing a site that already had one", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: {
        data: [makeSite({ activity: "Finance" })],
        meta: { page: 1, limit: 10, total: 1 },
      },
      error: undefined,
    })
    mockFetchSiteById.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: makeSite({ activity: "Finance" }),
        }),
    })

    const { container } = renderPage()
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"))
    await userEvent.click(editButtons[0])

    const activityField = screen.getByLabelText(
      /organization\.site&entities\.activity(?!Required)/
    )
    expect(activityField).toHaveAttribute("aria-required", "true")

    await userEvent.clear(activityField)
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.update" })
    )

    await waitFor(() =>
      expect(
        screen.getByText("organization.site&entities.activityRequired")
      ).toBeInTheDocument()
    )
    expect(mockUpdateSite).not.toHaveBeenCalled()
    // Sanity: the field really was cleared, not left at its prefilled value.
    expect(container.querySelector('[name="activity"]')).toHaveValue("")
  })

  it("shows a visible error for a whitespace-only activity instead of silently failing", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    const { container } = renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "New Factory"
    )
    await userEvent.type(
      screen.getByLabelText(/organization\.site&entities\.activity(?!Required)/),
      "   "
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(
        screen.getByText("organization.site&entities.activityRequired")
      ).toBeInTheDocument()
    )
    expect(mockCreateNewSite).not.toHaveBeenCalled()
  })

  // Regression (round 14 audit, aexa-frontend#514): the Create/Edit Site
  // modal was a plain div with no role="dialog", no aria-modal and no
  // Escape handling, unlike every sibling modal in this codebase.
  it("marks the Create/Edit Site modal as a labeled dialog and closes it on Escape", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAccessibleName(
      "organization.site&entities.addNewSiteTitle"
    )

    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  // quality-bar-loop round 13 (visual-polish finding, open since round
  // 1): this overlay used a flat bg-black/70 with no blur, diverging
  // from RiskRegisterPage.tsx's established frosted-glass treatment for
  // the same kind of full-screen modal overlay.
  it("gives the Create/Edit Site modal overlay the same frosted-glass treatment as RiskRegisterPage's modals", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    const overlay = screen.getByRole("dialog").parentElement!
    expect(overlay).toHaveClass("bg-black/40")
    expect(overlay).toHaveClass("backdrop-blur-sm")
    expect(overlay).not.toHaveClass("bg-black/70")
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

    renderPage()
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

  // Regression: the country combobox's <input> never declared an explicit
  // type, so Radix's PopoverTrigger (asChild) filled in its own default of
  // type="button" -- silently turning it into a non-editable, centered-text
  // button-style input (browsers don't support typing into type="button"
  // inputs at all). Reported as the field "feeling weird" to click into.
  it("renders the country field as a real editable text input, not a button", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    const countryInput = screen.getByRole("combobox", {
      name: "organization.site&entities.siteCountryLabel",
    })
    expect(countryInput).toHaveAttribute("type", "text")

    await userEvent.click(countryInput)
    await userEvent.type(countryInput, "Fra")
    expect(countryInput).toHaveValue("Fra")
    expect(
      await screen.findByRole("option", { name: "France" })
    ).toBeInTheDocument()
  })

  // Regression: reopening a field that already holds a complete value (e.g.
  // after selecting "Greece") filtered the suggestion list down to just that
  // one matching entry, making it impossible to browse other countries
  // without first deleting the text.
  it("shows the full country list on reopen, not filtered to the current value", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    const countryInput = screen.getByRole("combobox", {
      name: "organization.site&entities.siteCountryLabel",
    })
    await userEvent.click(countryInput)
    await userEvent.type(countryInput, "Greece")
    await userEvent.click(await screen.findByRole("option", { name: "Greece" }))
    expect(countryInput).toHaveValue("Greece")

    // Close it, then reopen the already-filled field. fireEvent.focus (not
    // userEvent.click) here -- jsdom doesn't reliably simulate a real
    // browser's click-focuses-text-input behavior through Radix's Slot
    // composition, verified working via a real click in a live browser
    // during manual testing; the component's onFocus handler (what's
    // actually under test) is exercised identically either way.
    await userEvent.click(
      screen.getByRole("textbox", {
        name: /organization\.site&entities\.siteName/i,
      })
    )
    fireEvent.focus(countryInput)

    expect(
      await screen.findByRole("option", { name: "Afghanistan" })
    ).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "France" })).toBeInTheDocument()
  })

  // General coverage for explicit close-on-blur, added alongside the fixes
  // above -- NOT a regression test for the specific bug that motivated it.
  // That bug (Radix's own outside-interaction dismiss not reliably closing
  // a Popover nested inside a Dialog) was confirmed live in a real browser,
  // via git-stash A/B against the committed code, but doesn't reproduce in
  // jsdom: this same test passes against the pre-fix component too (jsdom's
  // simulated dismissable-layer/pointerdown handling differs from real
  // Chromium here). Kept anyway as basic coverage that closing works at
  // all, with this noted rather than silently claimed as regression-proof.
  it("closes the country suggestion list when focus moves to another field", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )

    const countryInput = screen.getByRole("combobox", {
      name: "organization.site&entities.siteCountryLabel",
    })
    // fireEvent.focus (not userEvent.click) to open -- see comment on the
    // equivalent reopen step in the previous test.
    fireEvent.focus(countryInput)
    expect(
      await screen.findByRole("option", { name: "Afghanistan" })
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("textbox", {
        name: /organization\.site&entities\.siteName/i,
      })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "Afghanistan" })
      ).not.toBeInTheDocument()
    )
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

    const { container } = renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "New Factory"
    )
    await userEvent.type(
      container.querySelector('[name="activity"]')!,
      "Manufacturing"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() => expect(mockCreateNewSite).toHaveBeenCalled())
    expect(mockCreateNewSite.mock.calls[0][0]).toMatchObject({
      name: "New Factory",
      activity: "Manufacturing",
    })
  })

  // quality-bar-loop round 12 (UX finding, open since round 1 -- round 9
  // fixed this same pattern for handleConfirmDelete but missed this
  // handler): a non-throwing success: false response fell through
  // silently -- no toast, modal stayed open with no indication anything
  // went wrong.
  it("shows an error toast when creating a site resolves with success: false", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })
    mockCreateNewSite.mockReturnValue({
      unwrap: () => Promise.resolve({ success: false }),
    })

    const { container } = renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "New Factory"
    )
    await userEvent.type(
      container.querySelector('[name="activity"]')!,
      "Manufacturing"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.site&entities.saveSiteFailed"
      )
    )
  })

  it("pre-fills the edit form with existing site data", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockFetchSiteById.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: makeSite() }),
    })

    const { container } = renderPage()
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

  // Regression (aexa-frontend#401): GET /site's list select omits
  // site_type, so the list row's fallback used to silently show
  // "Production" for every site regardless of its real stored type. Edit
  // now fetches the single-site detail (which does return site_type) and
  // overwrites the form once it resolves.
  it("corrects the Site Type once the single-site detail fetch resolves with the real value", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: {
        // List row has no site_type, matching the real GET /site select.
        data: [makeSite({ site_type: undefined })],
        meta: { page: 1, limit: 10, total: 1 },
      },
      error: undefined,
    })
    mockFetchSiteById.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: makeSite({ site_type: "warehouse" }),
        }),
    })

    const { container } = renderPage()
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"))
    await userEvent.click(editButtons[0])

    expect(mockFetchSiteById).toHaveBeenCalledWith("site-1")
    await waitFor(() =>
      expect(container.querySelector('[name="site_type"]')).toHaveValue(
        "warehouse"
      )
    )
  })

  it("keeps the list-row prefill and shows a toast when the single-site detail fetch fails", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockFetchSiteById.mockReturnValue({
      unwrap: () => Promise.reject(new Error("network down")),
    })

    const { container } = renderPage()
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"))
    await userEvent.click(editButtons[0])

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.site&entities.loadSiteDetailFailed"
      )
    )
    expect(container.querySelector('[name="name"]')).toHaveValue(
      "HQ Casablanca"
    )
  })

  // Regression (aexa-frontend#401, review round 1): a 200 response with
  // success: false is still a failed detail fetch and must not be treated
  // as if the real site_type had loaded.
  it("shows a toast and keeps the list-row prefill when the detail fetch resolves with success: false", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockFetchSiteById.mockReturnValue({
      unwrap: () => Promise.resolve({ success: false, data: null }),
    })

    const { container } = renderPage()
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"))
    await userEvent.click(editButtons[0])

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.site&entities.loadSiteDetailFailed"
      )
    )
    expect(container.querySelector('[name="name"]')).toHaveValue(
      "HQ Casablanca"
    )
  })

  // Regression (aexa-frontend#401, review round 1): openEdit had no guard
  // analogous to latestAnalysisRequestRef (see the AI-analysis race test
  // below), so a slow detail fetch for a site the user has moved away from
  // could silently overwrite the form now showing a different site.
  it("does not let a slow edit-detail fetch for one site overwrite the edit form already showing another site", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: {
        data: [
          makeSite({ id: "site-1", name: "HQ Casablanca", site_type: undefined }),
          makeSite({ id: "site-2", name: "Lyon Plant", site_type: undefined }),
        ],
        meta: { page: 1, limit: 10, total: 2 },
      },
      error: undefined,
    })

    let resolveSiteOne: (value: unknown) => void = () => {}
    const siteOnePromise = new Promise((resolve) => {
      resolveSiteOne = resolve
    })
    mockFetchSiteById.mockImplementationOnce(() => ({
      unwrap: () => siteOnePromise,
    }))
    mockFetchSiteById.mockImplementationOnce(() => ({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: makeSite({ id: "site-2", name: "Lyon Plant", site_type: "warehouse" }),
        }),
    }))

    const { container } = renderPage()
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"))

    // Start editing site 1 (slow, not yet resolved) then switch to site 2
    // before it finishes.
    await userEvent.click(editButtons[0])
    await userEvent.click(editButtons[1])

    await waitFor(() =>
      expect(container.querySelector('[name="site_type"]')).toHaveValue(
        "warehouse"
      )
    )
    expect(container.querySelector('[name="name"]')).toHaveValue(
      "Lyon Plant"
    )

    // Site 1's request finally resolves after the user has moved on to site
    // 2 -- its data must not clobber the form now showing site 2.
    resolveSiteOne({
      success: true,
      data: makeSite({ id: "site-1", name: "HQ Casablanca", site_type: "headquarters" }),
    })
    await waitFor(() => Promise.resolve())

    expect(container.querySelector('[name="name"]')).toHaveValue(
      "Lyon Plant"
    )
    expect(container.querySelector('[name="site_type"]')).toHaveValue(
      "warehouse"
    )
  })

  // Regression (aexa-frontend#401, review round 1): openCreate didn't
  // invalidate a still-in-flight openEdit fetch, so switching from Edit to
  // "New Site" before the fetch resolved could silently populate the blank
  // create form with the previous site's data.
  it("does not let a slow edit-detail fetch populate the New Site form after switching away from Edit", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    let resolveFetch: (value: unknown) => void = () => {}
    mockFetchSiteById.mockReturnValue({
      unwrap: () => new Promise((resolve) => (resolveFetch = resolve)),
    })

    const { container } = renderPage()
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"))
    await userEvent.click(editButtons[0])

    // Switch to "New Site" before the edit fetch resolves.
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )
    expect(container.querySelector('[name="name"]')).toHaveValue("")

    resolveFetch({
      success: true,
      data: makeSite({ name: "Should Not Appear" }),
    })
    await waitFor(() => Promise.resolve())

    expect(container.querySelector('[name="name"]')).toHaveValue("")
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

    renderPage()
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-trash2"))
    await userEvent.click(deleteButtons[0])
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() => expect(mockDeleteSite).toHaveBeenCalledWith("site-1"))
  })

  // quality-bar-loop round 9 (resilience finding, open since round 1):
  // a non-throwing `success: false` response fell through silently --
  // no toast, modal stayed open with no indication anything went wrong.
  it("shows an error toast when site deletion resolves with success: false", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockDeleteSite.mockReturnValue({
      unwrap: () => Promise.resolve({ success: false }),
    })

    renderPage()
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
  })

  // quality-bar-loop round 9 (resilience finding, open since round 1):
  // isLoading was never destructured from this query -- while it was
  // in-flight, the expanded panel rendered nothing at all (not even a
  // false "0"), since riskData?.data.length === 0 is false when
  // riskData is undefined.
  it("shows a loading spinner, not a blank panel, while a site's risks are still loading", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockImplementation(
      (args: { siteId?: string }) =>
        args.siteId
          ? { data: undefined, isError: false, isLoading: true }
          : { data: { data: [] }, isError: false, isLoading: false }
    )

    renderPage()
    const expandButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-chevron-down"))!
    await userEvent.click(expandButton)

    expect(document.querySelector("svg.animate-spin")).toBeInTheDocument()
    expect(
      screen.queryByText("organization.site&entities.noConfirmedRisks")
    ).not.toBeInTheDocument()
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

    renderPage()
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
    // quality-bar-loop round 12 (visual-polish finding, open since round
    // 1): the bespoke ai_generated/manual badge was replaced with the
    // shared SourceBadge component (common.sourceBadge.manual/ai), the
    // same one AuditPage.tsx/CompliancePage.tsx already render through.
    // Scoped to the confirmed-risk row (not the site-level SourceBadge
    // rendered elsewhere on the same page, which also matches this same
    // text) by finding the badge that's actually a descendant of the
    // ref's own row container.
    const riskRefRow = screen
      .getByText("RSK-2026-0142")
      .closest(".border-accent\\/30") as HTMLElement
    const manualBadge = within(riskRefRow).getByText(
      "common.sourceBadge.manual"
    )
    expect(manualBadge).toBeInTheDocument()
    // Regression (audit round 4 / #344): the ref/name row used gap-16
    // (a much larger gap than sibling rows in this file); confirmed risks
    // now use gap-2, matching the badge row directly below it.
    expect(screen.getByText("RSK-2026-0142").parentElement).toHaveClass(
      "gap-2"
    )
    // SourceBadge's own manual variant: bg-muted/text-muted-foreground,
    // matching its established coloring everywhere else it's used.
    expect(manualBadge).toHaveClass("bg-muted")
    expect(manualBadge).toHaveClass("text-muted-foreground")
    // quality-bar-loop round 5 (mobile) first fixed this row's Delete
    // button (size="sm" = h-6, 24px tall) with a plain h-11 override, but
    // round 6 (visual-polish) found a 44px-tall button next to this row's
    // ~24px badges reads as an uneven baseline -- reverted to the visible
    // "sm" height and extended the invisible clickable area via a
    // `before:` hit-slop pseudo-element instead.
    const riskDeleteButton = screen.getByRole("button", {
      name: /organization\.site&entities\.deleteButton/i,
    })
    expect(riskDeleteButton).not.toHaveClass("h-11")
    // Round 7 found the initial `before:-inset-2.5` (uniform on all 4
    // sides) both overlapped the adjacent badge horizontally (this button
    // is already 71px wide, well over 44px, so it never needed a
    // horizontal hit-slop) and measured only 42px tall in the real
    // browser, not 44 -- shadcn's Button includes its own 1px
    // `border-transparent`, which eats into an absolutely-positioned
    // `before:`'s reach since its containing block is the padding box
    // (border-box minus border-width). `inset-x-0` drops the horizontal
    // extension entirely. `-inset-y-[11px]` (10px + 1px border
    // compensation) still measured 1px short at the exact edge via live
    // `elementFromPoint` sampling (sub-pixel rounding `getComputedStyle`
    // alone didn't surface) -- `-inset-y-[12px]` adds a small safety
    // margin and measures a clean ≥44px real hit area.
    expect(riskDeleteButton).toHaveClass("before:inset-x-0")
    expect(riskDeleteButton).toHaveClass("before:-inset-y-[12px]")
    expect(riskDeleteButton).not.toHaveClass("before:-inset-2.5")
  })

  // getRiskSeverityLevel silently maps a missing/malformed residual_score
  // to 0 ("low"), which would otherwise render a confident low-severity
  // badge (and a "NaN" label) on a confirmed-risk row for a risk that was
  // never actually scored -- same treatment RiskMatrixPage got for this
  // bug class (#636).
  it("flags a confirmed risk with a malformed residual_score as unscored instead of a confident severity badge", async () => {
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
            residual_score: null,
            ai_generated: false,
          },
        ],
      },
    })

    renderPage()
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)

    expect(
      screen.getByText("organization.riskMatrix.unscoredRiskBadge")
    ).toBeInTheDocument()
    expect(screen.queryByText("NaN")).not.toBeInTheDocument()
  })

  // Regression: the name link and description sit in a `flex-col
  // items-start` wrapper, which sizes each child to its own content width
  // instead of stretching it to the wrapper's available width. `truncate`'s
  // overflow:hidden has nothing to clip against without `w-full`, so long
  // text grew past the card's edge instead of being ellipsized (live-
  // verified: a real description spilled off the right edge of a mobile
  // card). `w-full` alongside `truncate` is required for the clip to work.
  it("constrains the confirmed-risk name and description to the row's width so truncate can actually clip long text", async () => {
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
            name: "A very long risk name that would otherwise force the row to grow past its own container",
            description:
              "A very long description that would otherwise force the row to grow past its own container instead of being clipped",
            residual_score: 12,
            ai_generated: false,
          },
        ],
      },
    })

    renderPage()
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)

    const nameLink = screen.getByText(/A very long risk name/)
    const description = screen.getByText(/A very long description/)
    expect(nameLink).toHaveClass("truncate")
    expect(nameLink).toHaveClass("w-full")
    expect(description).toHaveClass("truncate")
    expect(description).toHaveClass("w-full")
    // Round-1 review of PR #611: `w-full` alone is inert here -- a
    // percentage width resolves against the wrapper's own box, and without
    // `flex-1` forcing that wrapper's flex-basis to 0, the wrapper still
    // sizes to its long-text content (flex-basis: auto = max-content), so
    // `w-full` would compute against an already-too-wide box. `flex-1` is
    // the class actually doing the work; assert it directly so a future
    // change that keeps `w-full`/`truncate` but drops `flex-1` fails here
    // instead of silently reintroducing the spill.
    expect(nameLink.parentElement).toHaveClass("flex-1")
  })

  // aexa-frontend#551: a confirmed risk's name was plain text even though
  // risk.id was already the list key -- same gap #548/#549/#550 fixed
  // elsewhere in the cross-linking sweep.
  it("links a confirmed risk's name to its detail page", async () => {
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

    renderPage()
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)

    const link = screen.getByRole("link", { name: "Flooding" })
    expect(link).toHaveAttribute("href", "/organization/risks/risk-99")
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

    const { container } = renderPage()
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

  // quality-bar-loop round 17 (accessibility finding, fresh audit): every
  // label in this form was a plain sibling <label> with no htmlFor, and
  // its input/select/textarea had no id -- 4 controls here with no
  // programmatic name at all (WCAG 1.3.1/4.1.2).
  it("programmatically associates every manual risk form field with its label", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.addRisk/i,
      })
    )

    for (const label of [
      /organization\.site&entities\.riskNameLabel/,
      /organization\.site&entities\.statusLabel/,
      "organization.site&entities.categoryLabel",
      "organization.site&entities.descriptionLabel",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  // quality-bar-loop round 18 (accessibility finding, fresh audit):
  // required fields had no native required/aria-required.
  it("marks the Risk Name and Status fields as aria-required", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.addRisk/i,
      })
    )

    expect(
      screen.getByLabelText(/organization\.site&entities\.riskNameLabel/)
    ).toHaveAttribute("aria-required", "true")
    expect(
      screen.getByLabelText(/organization\.site&entities\.statusLabel/)
    ).toHaveAttribute("aria-required", "true")
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

    renderPage()
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

    const { container } = renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.newSite/i,
      })
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "New Factory"
    )
    await userEvent.type(
      container.querySelector('[name="activity"]')!,
      "Manufacturing"
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

    renderPage()
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

    renderPage()
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)

    expect(
      screen.queryByRole("button", { name: /delete/i })
    ).not.toBeInTheDocument()
  })

  // quality-bar-loop round 3 (industry-standards/UX, flagged independently
  // by both axes across 2 rounds): risk deletion used to fire straight from
  // the button's onClick with zero confirmation -- unlike site deletion,
  // which already routes through DeleteAlertModal. Confirms the button now
  // only opens the modal, the mutation doesn't fire until confirmed, and a
  // successful confirm shows the success toast and closes the modal.
  it("requires confirming through DeleteAlertModal before a risk is actually deleted", async () => {
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
      unwrap: () => Promise.resolve({ success: true }),
    })

    renderPage()
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.site&entities\.deleteButton/i,
      })
    )

    // The mutation must not fire just from clicking the row's Delete button.
    expect(mockDeleteRisk).not.toHaveBeenCalled()
    const confirmButton = screen.getByText("Confirm delete")

    await userEvent.click(confirmButton)

    expect(mockDeleteRisk).toHaveBeenCalledWith("risk-99")
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "organization.site&entities.riskDeletedSuccess"
      )
    )
    expect(screen.queryByText("Confirm delete")).not.toBeInTheDocument()
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

    renderPage()
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.site&entities\.deleteButton/i,
      })
    )
    // quality-bar-loop round 3: risk deletion now requires confirming
    // through DeleteAlertModal, same as site deletion -- the row's own
    // Delete button only opens the modal.
    await userEvent.click(screen.getByText("Confirm delete"))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.site&entities.deleteRiskFailed"
      )
    )
  })

  // Regression (aexa-frontend#399): error?.data?.message used to be
  // preferred over the translated fallback, leaking the backend's
  // always-English message into a non-English UI even when a correct
  // translation existed. t() is mocked to return the raw key in this file,
  // so asserting the key (not the raw backend message) proves the
  // translated fallback now takes precedence.
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

    const { container } = renderPage()
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
    expect(mockToastError).not.toHaveBeenCalledWith("Server unavailable")
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

    renderPage()
    const [expandButton] = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-chevron-down"))
    await userEvent.click(expandButton)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.site&entities\.deleteButton/i,
      })
    )
    await userEvent.click(screen.getByText("Confirm delete"))

    // Regression (aexa-frontend#399): translated fallback now takes
    // precedence over the raw (always-English) backend message.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.site&entities.deleteRiskFailed"
      )
    )
    expect(mockToastError).not.toHaveBeenCalledWith("Risk is locked")
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

    const { container } = renderPage()
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

  // Regression (#425): riskForm.formState was never read anywhere in the
  // component, so an incomplete Add Risk submission failed completely
  // silently -- no inline error, no toast. Assert the inline errors now
  // render (matching the existing siteForm.formState.errors.name pattern)
  // and that the API is never called for the invalid submission.
  it("shows inline validation errors and does not call the API when submitting the manual risk form with required fields empty", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.addRisk/i,
      })
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(
        screen.getByText("organization.site&entities.riskNameRequired")
      ).toBeInTheDocument()
    )
    expect(
      screen.getByText("organization.site&entities.riskStatusRequired")
    ).toBeInTheDocument()
    expect(mockCreateNewRisk).not.toHaveBeenCalled()
  })

  // quality-bar-loop round 11 (UX finding, open since round 1): the risk
  // name field's `required` rule only checked truthiness, so a
  // whitespace-only name passed it -- unlike the site-name field's own
  // fix for the identical bug (aexa-frontend#425/PR #455).
  it("shows an inline error for a whitespace-only risk name instead of silently calling the API", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.addRisk/i,
      })
    )
    await userEvent.type(
      screen.getByPlaceholderText(
        "organization.site&entities.enterRiskNamePlaceholder"
      ),
      "   "
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.site&entities.add" })
    )

    await waitFor(() =>
      expect(
        screen.getByText("organization.site&entities.riskNameRequired")
      ).toBeInTheDocument()
    )
    expect(mockCreateNewRisk).not.toHaveBeenCalled()
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

    renderPage()
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

    renderPage()
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

  // quality-bar-loop round 15 (visual-polish finding, open since round
  // 1): this metadata (category, description, and the inherent/
  // residual/probability/velocity/trend row) was text-[10px], below the
  // app's text-xs (12px) type-scale floor used everywhere else.
  it("renders the AI-suggestion metadata at text-xs, not below the app's type-scale floor", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockAnalyzeSiteRisks.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: [makeSuggestion()] }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.analyzeAi/i,
      })
    )

    await waitFor(() =>
      expect(screen.getByText("Supplier concentration")).toBeInTheDocument()
    )

    expect(screen.getByText("Operational")).toHaveClass("text-xs")
    expect(
      screen.getByText("Single supplier for a critical part")
    ).toHaveClass("text-xs")
    expect(
      screen
        .getByText(/organization\.site&entities\.inherentLabel/)
        .closest("div")
    ).toHaveClass("text-xs")
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

    renderPage()
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

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.analyzeAi/i,
      })
    )

    // Regression (aexa-frontend#399): translated fallback now takes
    // precedence over the raw (always-English) backend message.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.site&entities.aiRiskAnalysisFailed"
      )
    )
    expect(mockToastError).not.toHaveBeenCalledWith("AI service unavailable")
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

    renderPage()
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
      // Regression (aexa-frontend#398): inherent/residual scores are on a
      // 0-100 scale (see src/utils/riskScoring.ts), not 1-10 -- High/Medium
      // map to 70/50 so they land in the matching severity band (>75 is
      // "critical", not "high" -- 80 would have overshot into that band).
      inherent_score: 70,
      residual_score: 50,
      probability: 60,
    })
    // financial_impact_min/max are free text on the AI response ("€500K",
    // "€2M") and don't reliably parse to the Risk model's Int fields — must
    // never be forwarded, not even as unparsed strings.
    expect(payload).not.toHaveProperty("financial_impact_min")
    expect(payload).not.toHaveProperty("financial_impact_max")
  })

  // quality-bar-loop round 11 (UX finding, open since round 1):
  // handleImportSuggestions used to evict every ATTEMPTED suggestion from
  // the list, not just the ones that actually succeeded -- a failed
  // import (still shown as an error toast) silently vanished from the
  // list too, with no way to retry it short of re-running AI analysis.
  it("keeps a suggestion whose import fails visible in the list, while removing the one that succeeded", async () => {
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
            makeSuggestion({ risk_id: "sugg-ok", title: "Succeeds fine" }),
            makeSuggestion({ risk_id: "sugg-fail", title: "Fails to import" }),
          ],
        }),
    })
    mockCreateNewRisk
      .mockReturnValueOnce({ unwrap: () => Promise.resolve({ success: true }) })
      .mockReturnValueOnce({ unwrap: () => Promise.reject(new Error("boom")) })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization.site&entities.analyzeAi/i,
      })
    )
    await waitFor(() =>
      expect(screen.getByText("Succeeds fine")).toBeInTheDocument()
    )

    const checkboxes = screen.getAllByRole("checkbox")
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[1])
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.site&entities\.importSelected/i,
      })
    )

    await waitFor(() => expect(mockCreateNewRisk).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.queryByText("Succeeds fine")).not.toBeInTheDocument()
    )
    expect(screen.getByText("Fails to import")).toBeInTheDocument()
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

    renderPage()
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

    renderPage()
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

    renderPage()
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

    renderPage()

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

    renderPage()

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

    renderPage()
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

  // aexa-frontend#533: FindingDetails.tsx links here with ?siteId=&search=
  // since SitesEntities has no per-site route -- the search param narrows
  // the (paginated) list down to the target regardless of which page it
  // originally lived on, then siteId picks the exact match to auto-expand
  // and highlight.
  describe("site highlight via ?siteId=&search= (#533)", () => {
    it("pre-fills the search box from ?search= on mount", () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        isLoading: false,
        isFetching: false,
        data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
        error: undefined,
      })

      renderPage("/?siteId=site-1&search=HQ%20Casablanca")

      expect(
        screen.getByRole("textbox", {
          name: "organization.site&entities.searchSitesLabel",
        })
      ).toHaveValue("HQ Casablanca")
    })

    it("auto-expands and scrolls to the site matching ?siteId=", async () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        isLoading: false,
        isFetching: false,
        data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
        error: undefined,
      })

      renderPage("/?siteId=site-1&search=HQ%20Casablanca")

      await waitFor(() =>
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
      )
      const card = document.getElementById("site-site-1")
      expect(card?.className).toContain("ring-2")
    })

    it("does not scroll or highlight anything when no ?siteId= param is present", () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        isLoading: false,
        isFetching: false,
        data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
        error: undefined,
      })

      renderPage("/")

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
      const card = document.getElementById("site-site-1")
      expect(card?.className).not.toContain("ring-2")
    })

    it("does not crash or highlight anything when ?siteId= matches no site in the narrowed list", () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        isLoading: false,
        isFetching: false,
        data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
        error: undefined,
      })

      expect(() =>
        renderPage("/?siteId=site-does-not-exist&search=nope")
      ).not.toThrow()
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    })
  })
})
