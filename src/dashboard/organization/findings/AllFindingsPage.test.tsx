import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import AllFindingsPage from "./AllFindingsPage"

// aexa-frontend#562: the Site column is now a real <Link>, so every
// render() needs a Router context.
const withRouter = { wrapper: MemoryRouter }

// quality-bar-loop round 14: lets the ?status= filter tests below drive
// the initial URL, same convention as KriDashboardPage.test.tsx's
// renderPage(initialPath) -- `withRouter`'s plain MemoryRouter wrapper
// has no way to pass initialEntries through RTL's `wrapper` option.
function renderWithPath(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AllFindingsPage />
    </MemoryRouter>
  )
}

// Controllable `i18n.language` for the locale-formatting test below, while
// every other test in this file keeps relying on the real (uninitialized)
// react-i18next t(), which just echoes the raw key back -- same technique
// as TeamMembersTab.test.tsx.
let mockLanguage: string | undefined = undefined
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return { ...real, i18n: { ...real.i18n, language: mockLanguage } }
    },
  }
})

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// aexa-frontend#217 -- role hook mocked per-test via this mutable holder,
// same convention as RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

// aexa-frontend#270 -- mutable holder, same convention as mockRole above.
let mockAssignedInspectionIds: Set<string> | undefined = new Set()
vi.mock("@/hooks/useMyAssignments", () => ({
  useMyAssignedInspectionIds: () => mockAssignedInspectionIds,
  useMyActiveFindingAssignmentIds: () => new Set(),
}))

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useNavigate: () => mockNavigate }
})

const mockUseGetAllFindingsQuery = vi.fn()
const mockUseGetAllSitesQuery = vi.fn()
const mockDeleteAction = vi.fn()

vi.mock("@/redux/apis/organization/findings.api", () => ({
  useGetAllFindingsQuery: (...args: unknown[]) =>
    mockUseGetAllFindingsQuery(...args),
  useDeleteFindingByIdMutation: () => [mockDeleteAction, { isLoading: false }],
}))

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) => mockUseGetAllSitesQuery(...args),
}))

vi.mock("./CreateNewFindingModal", () => ({
  default: ({
    open,
    editData,
  }: {
    open: boolean
    editData?: { actionTitle: string } | null
  }) =>
    open ? (
      <div data-testid="create-finding-modal">
        {editData ? `Editing: ${editData.actionTitle}` : "Creating"}
      </div>
    ) : null,
}))

vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
}))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

function makeAction(overrides = {}) {
  return {
    id: "finding-1",
    inspectionId: "insp-1",
    actionTitle: "Fix broken railing",
    actionDisc: "Railing on level 2 is loose.",
    priority: "High",
    status: "TO_DO",
    dueDate: "2099-07-01T00:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    site: { id: "site-1", name: "HQ Casablanca" },
    messages: [],
    ...overrides,
  }
}

describe("AllFindingsPage", () => {
  beforeEach(() => {
    mockLanguage = undefined
    mockRole = "ADMIN"
    mockAssignedInspectionIds = new Set()
    mockNavigate.mockReset()
    mockUseGetAllFindingsQuery.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockDeleteAction.mockReset()
    mockToastError.mockReset()
    mockUseGetAllSitesQuery.mockReturnValue({ data: { data: [] } })
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        data: [makeAction()],
        meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
      },
      isLoading: false,
      refetch: vi.fn(),
    })
  })

  it("shows Create Finding, Edit and Delete for an ADMIN", () => {
    mockRole = "ADMIN"
    render(<AllFindingsPage />, withRouter)

    expect(
      screen.getByText("organization.findings.createTitle")
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
    ).toBe(true)
  })

  // Regression (aexa-frontend round-9 audit #469): the per-row Edit/Delete
  // icon buttons had no aria-label/title, so a screen reader announced
  // "button" with no indication of which action it performed.
  it("gives per-row Edit and Delete icon buttons an accessible name", () => {
    render(<AllFindingsPage />, withRouter)

    const editButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-pen"))!
    expect(editButton).toHaveAccessibleName("organization.findings.edit")

    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash-2"))!
    expect(deleteButton).toHaveAccessibleName("organization.findings.delete")
  })

  // aexa-frontend#562: the Site column showed action.site.name as plain
  // text even though action.site.id was already available -- reuses the
  // established ?siteId=&search= pattern (#533/#552). The row itself
  // navigates on click, so this also confirms the link stops that
  // propagation rather than double-navigating.
  it("links the Site column into Sites, scoped to that site, without triggering the row's own navigation", async () => {
    render(<AllFindingsPage />, withRouter)

    const link = screen.getByRole("link", { name: "HQ Casablanca" })
    expect(link).toHaveAttribute(
      "href",
      "/organization/sites?siteId=site-1&search=HQ%20Casablanca"
    )

    await userEvent.click(link)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // Regression (aexa-frontend round-9 audit #469): the site "Filter"
  // dropdown toggle had no aria-expanded/aria-haspopup, so screen-reader
  // users got no indication it was a disclosure control or of its state.
  it("marks the Filter dropdown toggle with aria-haspopup/aria-expanded that tracks open state", async () => {
    render(<AllFindingsPage />, withRouter)

    const filterButton = screen.getByRole("button", {
      name: /organization\.findings\.filter/i,
    })
    expect(filterButton).toHaveAttribute("aria-haspopup", "true")
    expect(filterButton).toHaveAttribute("aria-expanded", "false")

    await userEvent.click(filterButton)
    expect(filterButton).toHaveAttribute("aria-expanded", "true")
  })

  // Regression (aexa-frontend round-9 audit #469): the page h1 was followed
  // directly by h3s (filter popover heading, empty-state heading) with no
  // h2 anywhere on the page. An always-present sr-only h2 now sits between
  // them regardless of which render path (results vs. empty state) is hit.
  it("keeps a valid heading hierarchy: an h2 exists between the page h1 and any h3", () => {
    render(<AllFindingsPage />, withRouter)

    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1)
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(
      0
    )
  })

  // Regression (aexa-frontend round-9 audit #469): the empty-state row's
  // <td colSpan={8}> no longer matched the table's 7 <th> columns.
  it("matches the empty-state row's colSpan to the table's 7 columns", () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPage: 0 } },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<AllFindingsPage />, withRouter)

    const headerCells = screen.getAllByRole("columnheader")
    const emptyCell = screen.getByText(
      "organization.findings.noFindingsYet"
    ).closest("td")!
    expect(emptyCell).toHaveAttribute("colspan", String(headerCells.length))
  })

  // quality-bar-loop round 16 (resilience regression): this query never
  // checked isError -- a genuine fetch failure fell through to `data?.data
  // || []`, rendering the identical empty-state message as "no findings
  // match the current filters."
  it("shows a distinct error message, not the empty state, when the findings query fails", () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    })

    render(<AllFindingsPage />, withRouter)

    expect(
      screen.getByText("organization.findings.loadError")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.findings.noFindingsYet")
    ).not.toBeInTheDocument()
  })

  // quality-bar-loop round 17: STATUS_COLORS/PRIORITY_BADGES had no
  // fallback for a status/priority outside the map -- unlike the label
  // text next to it (which already fell back to the raw value), the badge
  // className lookup returned `undefined`, rendering a styleless badge.
  it("falls back to a neutral badge style for an unrecognized status or priority", () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        data: [makeAction({ status: "UNKNOWN_STATUS", priority: "Urgent" })],
        meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
      },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<AllFindingsPage />, withRouter)

    const statusBadge = screen.getByText("UNKNOWN_STATUS")
    const priorityBadge = screen.getByText("Urgent")
    expect(statusBadge.className).not.toContain("undefined")
    expect(priorityBadge.className).not.toContain("undefined")
  })

  // aexa-frontend round-3 audit bug #3: the due-date month was hardcoded to
  // "en-US" regardless of the active UI language.
  it("formats the due date's month in French when the UI language is French", () => {
    mockLanguage = "fr"
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        data: [makeAction({ dueDate: "2099-07-01T00:00:00.000Z" })],
        meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
      },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<AllFindingsPage />, withRouter)

    const date = new Date("2099-07-01T00:00:00.000Z")
    const expected = `${date.getDate()} ${date.toLocaleDateString("fr-FR", { month: "short" })} ${date.getFullYear()}`
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it("hides Create Finding, Edit and Delete for a VIEWER", () => {
    mockRole = "VIEWER"
    render(<AllFindingsPage />, withRouter)

    expect(
      screen.queryByText("organization.findings.createTitle")
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
    ).toBe(false)
  })

  it("hides write controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    render(<AllFindingsPage />, withRouter)

    expect(
      screen.queryByText("organization.findings.createTitle")
    ).not.toBeInTheDocument()
  })

  // aexa-frontend#270: per-row narrowing on top of the #217 role gate above
  // -- a LEAD_AUDITOR only gets Edit/Delete on findings whose parent
  // inspection ("insp-1", makeAction's default) they're actually assigned
  // to, mirroring org_scope.ts's assertCanWriteToAction.
  it("hides Edit/Delete for an unassigned LEAD_AUDITOR", () => {
    mockRole = "LEAD_AUDITOR"
    mockAssignedInspectionIds = new Set()
    render(<AllFindingsPage />, withRouter)

    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
    ).toBe(false)
  })

  it("shows Edit/Delete for a LEAD_AUDITOR assigned to the finding's parent inspection", () => {
    mockRole = "LEAD_AUDITOR"
    mockAssignedInspectionIds = new Set(["insp-1"])
    render(<AllFindingsPage />, withRouter)

    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
    ).toBe(true)
  })

  it("degrades a LEAD_AUDITOR back to allowed when assignment data is unavailable", () => {
    mockRole = "LEAD_AUDITOR"
    mockAssignedInspectionIds = undefined
    render(<AllFindingsPage />, withRouter)

    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
    ).toBe(true)
  })

  it("clicking Edit opens the modal with the correct editData and does not navigate", async () => {
    render(<AllFindingsPage />, withRouter)

    const editButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-pen"))!
    await userEvent.click(editButton)

    expect(screen.getByTestId("create-finding-modal")).toHaveTextContent(
      "Editing: Fix broken railing"
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("clicking Delete opens the DeleteAlertModal and does not navigate", async () => {
    render(<AllFindingsPage />, withRouter)

    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!
    await userEvent.click(deleteButton)

    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("confirming delete calls the delete mutation with the correct id", async () => {
    mockDeleteAction.mockReturnValue({
      unwrap: () => Promise.resolve({ message: "Deleted" }),
    })
    render(<AllFindingsPage />, withRouter)

    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!
    await userEvent.click(deleteButton)
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockDeleteAction).toHaveBeenCalledWith("finding-1")
    )
  })

  it("shows an error toast when delete fails", async () => {
    mockDeleteAction.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Cannot delete finding" } }),
    })
    render(<AllFindingsPage />, withRouter)

    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!
    await userEvent.click(deleteButton)
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Cannot delete finding")
    )
  })

  // aexa-frontend#265: the delete-path counterpart to #234/#243 (this file's
  // own handleSiteFilter/clearFilters reset page on a filter change, but
  // nothing resets it when a delete alone shrinks totalPages).
  it("aexa-frontend#265: clamps the page back into range after a delete shrinks totalPages", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        data: [makeAction()],
        meta: { page: 1, limit: 20, total: 41, totalPage: 3 },
      },
      isLoading: false,
      refetch: vi.fn(),
    })
    mockDeleteAction.mockReturnValue({
      unwrap: () => Promise.resolve({ message: "Deleted" }),
    })

    render(<AllFindingsPage />, withRouter)

    const nextButton = () =>
      screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-chevron-right"))!

    await userEvent.click(nextButton())
    await userEvent.click(nextButton())
    await waitFor(() =>
      expect(mockUseGetAllFindingsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 3 })
      )
    )

    // Deleting the last finding on page 3 drops total to 21 -> totalPage 2,
    // stranding page 3 out of range.
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        data: [],
        meta: { page: 3, limit: 20, total: 21, totalPage: 2 },
      },
      isLoading: false,
      refetch: vi.fn(),
    })

    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!
    await userEvent.click(deleteButton)
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockUseGetAllFindingsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      )
    )
  })

  it("navigates to the detail page when a row (not the action buttons) is clicked", async () => {
    render(<AllFindingsPage />, withRouter)

    await userEvent.click(screen.getByText("Fix broken railing"))

    expect(mockNavigate).toHaveBeenCalledWith(
      "/organization/finding/finding-1"
    )
  })

  // quality-bar-loop round 14 (industry-standards): the dashboard's
  // "Open Actions" card now links here with ?status=open, meaning TO_DO or
  // IN_PROGRESS (the same two statuses Overview.tsx's own KPI count
  // already uses). This page is normally server-paginated at limit:20;
  // while this filter is active it fetches limit:100 instead (same
  // convention as the KPI's own computation) and filters client-side.
  describe("?status=open filter from the dashboard's Open Actions card (round 14)", () => {
    it("fetches with limit:100 and shows only TO_DO/IN_PROGRESS findings plus a clear-filter link", () => {
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: {
          data: [
            makeAction({ id: "f1", actionTitle: "Open one", status: "TO_DO" }),
            makeAction({
              id: "f2",
              actionTitle: "Also open",
              status: "IN_PROGRESS",
            }),
            makeAction({ id: "f3", actionTitle: "Done one", status: "DONE" }),
          ],
          meta: { page: 1, limit: 100, total: 3, totalPage: 1 },
        },
        isLoading: false,
        refetch: vi.fn(),
      })

      renderWithPath("/?status=open")

      expect(screen.getByText("Open one")).toBeInTheDocument()
      expect(screen.getByText("Also open")).toBeInTheDocument()
      expect(screen.queryByText("Done one")).not.toBeInTheDocument()
      expect(mockUseGetAllFindingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100, page: 1 })
      )
      expect(
        screen.getByText("organization.findings.filteredByOpenStatus")
      ).toBeInTheDocument()
      expect(
        screen.getByRole("link", {
          name: "organization.findings.clearStatusFilter",
        })
      ).toHaveAttribute("href", "/organization/findings")
    })

    it("does not narrow the list, fetches the normal limit:20, and shows no clear-filter link with no ?status= param", () => {
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: {
          data: [
            makeAction({ id: "f1", actionTitle: "Open one", status: "TO_DO" }),
            makeAction({ id: "f3", actionTitle: "Done one", status: "DONE" }),
          ],
          meta: { page: 1, limit: 20, total: 2, totalPage: 1 },
        },
        isLoading: false,
        refetch: vi.fn(),
      })

      render(<AllFindingsPage />, withRouter)

      expect(screen.getByText("Open one")).toBeInTheDocument()
      expect(screen.getByText("Done one")).toBeInTheDocument()
      expect(mockUseGetAllFindingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20 })
      )
      expect(
        screen.queryByText("organization.findings.filteredByOpenStatus")
      ).not.toBeInTheDocument()
    })
  })

  // quality-bar-loop round 32 (Inspections, incidentally): this route was
  // once observed hanging indefinitely on the loading spinner with no way
  // out. Not reproduced since, but `useGetAllFindingsQuery`'s `isLoading`
  // has no timeout escape hatch -- a genuine stalled request leaves the
  // spinner up forever. These tests cover the defensive fix: a "taking
  // longer than expected" retry hint after 10s of continuous loading.
  describe("slow-load retry hint", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("does not show a retry hint while loading normally", () => {
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: vi.fn(),
      })

      render(<AllFindingsPage />, withRouter)

      expect(
        screen.getByText("organization.findings.loadingFindings")
      ).toBeInTheDocument()
      expect(
        screen.queryByText("organization.findings.loadingTakingTooLong")
      ).not.toBeInTheDocument()
    })

    it("shows a retry hint once loading has continued for 10+ seconds", () => {
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: vi.fn(),
      })

      render(<AllFindingsPage />, withRouter)

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(
        screen.getByText("organization.findings.loadingTakingTooLong")
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", {
          name: "organization.findings.retryLoad",
        })
      ).toBeInTheDocument()
    })

    it("calls refetch when the retry button is clicked", () => {
      const mockRefetch = vi.fn()
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: mockRefetch,
      })

      render(<AllFindingsPage />, withRouter)

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      act(() => {
        screen
          .getByRole("button", { name: "organization.findings.retryLoad" })
          .click()
      })

      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    it("clears the retry hint once loading finishes", () => {
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: vi.fn(),
      })

      const { rerender } = render(<AllFindingsPage />, withRouter)

      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(
        screen.getByText("organization.findings.loadingTakingTooLong")
      ).toBeInTheDocument()

      mockUseGetAllFindingsQuery.mockReturnValue({
        data: {
          data: [makeAction()],
          meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
        },
        isLoading: false,
        refetch: vi.fn(),
      })
      rerender(<AllFindingsPage />)

      expect(
        screen.queryByText("organization.findings.loadingTakingTooLong")
      ).not.toBeInTheDocument()
    })

    // Found by review: the previous test only proved the hint disappears
    // once `isLoading` goes false -- true regardless of whether the
    // internal `loadingTooLong` flag was actually reset, since the whole
    // block is unreachable outside the `isLoading` branch either way. The
    // real risk this timer-reset logic guards against is a *new* load
    // cycle starting with a stale `loadingTooLong=true` still set, which
    // would flash the hint immediately instead of after another 10s.
    it("does not immediately re-show the retry hint when a new load cycle starts after a completed one", () => {
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: vi.fn(),
      })
      const { rerender } = render(<AllFindingsPage />, withRouter)

      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(
        screen.getByText("organization.findings.loadingTakingTooLong")
      ).toBeInTheDocument()

      // Loading finishes -- the pending `setTimeout(..., 0)` reset needs to
      // actually run before the next load cycle starts.
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: {
          data: [makeAction()],
          meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
        },
        isLoading: false,
        refetch: vi.fn(),
      })
      rerender(<AllFindingsPage />)
      act(() => {
        vi.advanceTimersByTime(0)
      })

      // A new load cycle starts (e.g. a filter/search change) -- the hint
      // must not reappear immediately just because `loadingTooLong` was
      // left stale from the previous cycle.
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: vi.fn(),
      })
      rerender(<AllFindingsPage />)

      expect(
        screen.queryByText("organization.findings.loadingTakingTooLong")
      ).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(
        screen.getByText("organization.findings.loadingTakingTooLong")
      ).toBeInTheDocument()
    })
  })

  // quality-bar-loop-derived fix: this file's raw <button> elements (Create
  // Finding, Filter toggle, site-filter items, Clear filters) had no
  // explicit type, defaulting to the implicit type="submit" -- harmless
  // only because this page's markup doesn't currently sit inside a <form>,
  // but a real footgun if it ever does. Scoped to just these raw buttons
  // (not a full sweep) since this file also renders shadcn <Button>s (the
  // per-row Edit/Delete controls) with their own separate, pre-existing
  // type gap outside this fix's scope.
  it("gives every raw <button> an explicit type=\"button\"", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site-1", name: "HQ Casablanca" }] },
    })
    render(<AllFindingsPage />, withRouter)

    expect(
      screen.getByText("organization.findings.createTitle").closest("button")!
        .type
    ).toBe("button")

    const filterButton = screen.getByRole("button", {
      name: /organization\.findings\.filter/i,
    }) as HTMLButtonElement
    expect(filterButton.type).toBe("button")

    await userEvent.click(filterButton)

    expect(
      screen.getByText("organization.findings.allSites").closest("button")!
        .type
    ).toBe("button")
    // "HQ Casablanca" also appears as the table row's site link -- the
    // filter dropdown's own copy is the one inside a <button>.
    const siteFilterButton = screen
      .getAllByText("HQ Casablanca")
      .map((el) => el.closest("button"))
      .find((btn): btn is HTMLButtonElement => btn !== null)!
    expect(siteFilterButton.type).toBe("button")

    await userEvent.click(siteFilterButton)
    await userEvent.click(filterButton)

    expect(
      screen.getByText("organization.findings.clearFilters").closest("button")!
        .type
    ).toBe("button")
  })
})
