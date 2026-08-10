import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { MemoryRouter } from "react-router"
import InspectionTable from "./InspectionTable"

// ── react-router navigate ─────────────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useNavigate: () => mockNavigate }
})

// ── sonner ────────────────────────────────────────────────────────────────────
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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

// ── role gating (aexa-frontend#242) — mocked per-test via this mutable
// holder, same convention as RiskRegisterPage.test.tsx/CompliancePage.test.tsx ──
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

// ── assignment gating (aexa-frontend#270) — mutable holder, same convention
// as mockRole above. `undefined` means "assignment data unavailable" (the
// same meaning useMyAssignedInspectionIds gives it), so tests can exercise
// the graceful-degradation path explicitly.
let mockAssignedInspectionIds: Set<string> | undefined = new Set()
vi.mock("@/hooks/useMyAssignments", () => ({
  useMyAssignedInspectionIds: () => mockAssignedInspectionIds,
  useMyActiveFindingAssignmentIds: () => new Set(),
}))

// ── RTK Query inspection API ──────────────────────────────────────────────────
const mockUseGetAllInspectionQuery = vi.fn()
const mockDeleteInspectionTrigger = vi.fn()
// Mutable per-test, same convention as RiskRegisterPage.test.tsx's
// mockIsRiskDeleting -- lets the double-submission-guard test below flip
// this to true without a static mock.
let mockIsInspectionDeleting = false

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useGetAllInspectionQuery: (...args: unknown[]) =>
    mockUseGetAllInspectionQuery(...args),
  useDeleteInspectionMutation: () => [
    mockDeleteInspectionTrigger,
    { isLoading: mockIsInspectionDeleting },
  ],
}))

// ── RTK Query sites API ───────────────────────────────────────────────────────
const mockUseGetAllSitesQuery = vi.fn(
  (): { data: { data: { id: string; name: string }[] } } => ({
    data: { data: [] },
  })
)
vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: () => mockUseGetAllSitesQuery(),
}))

// ── StartInspectionModal — avoid pulling in its own RTK deps ──────────────────
vi.mock("./StartInspectionModal", () => ({
  default: () => null,
}))

// ── DeleteAlertModal ──────────────────────────────────────────────────────────
vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({
    open,
    onConfirm,
    loading,
  }: {
    open: boolean
    onConfirm: () => void
    loading?: boolean
  }) =>
    open ? (
      <button onClick={onConfirm} disabled={loading}>
        Confirm delete
      </button>
    ) : null,
}))

// ── UI primitives — bypass the duplicate-export bug in button.tsx ─────────────
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

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode
    value?: string
    onValueChange?: (v: string) => void
    disabled?: boolean
  }) => (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({
    className,
    children,
  }: {
    className?: string
    children: React.ReactNode
  }) => (
    <div data-testid="select-trigger" className={className}>
      {children}
    </div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <>{placeholder}</>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) => <option value={value}>{children}</option>,
}))

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => (
    <table>{children}</table>
  ),
  TableHeader: ({ children }: { children: React.ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: { children: React.ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children }: { children: React.ReactNode }) => (
    <tr>{children}</tr>
  ),
  TableHead: ({ children }: { children: React.ReactNode }) => (
    <th>{children}</th>
  ),
  TableCell: ({
    children,
    colSpan,
    className,
  }: {
    children: React.ReactNode
    colSpan?: number
    className?: string
  }) => (
    <td colSpan={colSpan} className={className}>
      {children}
    </td>
  ),
}))

// ─────────────────────────────────────────────────────────────────────────────

function makeInspection(overrides = {}) {
  return {
    id: "insp-1",
    status: "IN_PROGRESS",
    createdAt: "2026-06-21T10:00:00.000Z",
    updatedAt: "2026-06-21T10:00:00.000Z",
    template: { id: "t-1", templateName: "Fire Safety Audit" },
    site: { id: "s-1", name: "HQ Casablanca" },
    inspector: { id: "p-1", fullName: "Youssef Benali" },
    ...overrides,
  }
}

function renderTable() {
  return render(
    <MemoryRouter>
      <InspectionTable />
    </MemoryRouter>
  )
}

// quality-bar-loop round 14: lets the ?status=active filter tests below
// drive the initial URL, same convention as KriDashboardPage.test.tsx's
// renderPage(initialPath).
function renderTableWithPath(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <InspectionTable />
    </MemoryRouter>
  )
}

describe("InspectionTable", () => {
  beforeEach(() => {
    mockLanguage = undefined
    mockNavigate.mockReset()
    mockDeleteInspectionTrigger.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockUseGetAllSitesQuery.mockReturnValue({ data: { data: [] } })
    mockRole = "ADMIN"
    mockAssignedInspectionIds = new Set()
    mockIsInspectionDeleting = false
  })

  it("renders the inspection table with data", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [makeInspection()],
        meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
      },
      isLoading: false,
    })

    renderTable()

    await waitFor(() =>
      expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    )
    expect(screen.getByText("HQ Casablanca")).toBeInTheDocument()
    expect(screen.getByText("Youssef Benali")).toBeInTheDocument()
    // Bug-fix batch: the status badge used to render the raw enum value
    // ("IN_PROGRESS") instead of the humanized translation key shared with
    // the status filter dropdown.
    expect(
      screen.getAllByText("organization.inspection.statusInProgress").length
    ).toBeGreaterThan(0)
    expect(screen.queryByText("IN_PROGRESS")).not.toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 14, visual polish): guards the
  // status->severity refactor (getInspectionStatusSeverity, replacing this
  // file's own STATUS_BADGE Record) against a color regression.
  it("colors the status badge amber for IN_PROGRESS", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [makeInspection()],
        meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
      },
      isLoading: false,
    })

    renderTable()

    const badge = await waitFor(() => {
      const el = screen
        .getAllByText("organization.inspection.statusInProgress")
        .find((e) => e.tagName === "SPAN")
      if (!el) throw new Error("status badge span not found")
      return el
    })
    expect(badge.className).toMatch(/text-amber-800/)
  })

  // quality-bar-loop round 2 (mobile + accessibility, round-1 findings):
  // row Eye/Edit/Delete buttons were 30x24px with zero accessible name
  // (confirmed live: ariaLabel null, empty text) -- the single
  // highest-traffic control on the page.
  it("gives the row Eye/Edit/Delete buttons a 44px touch target and a distinct accessible name each", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [makeInspection()],
        meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
      },
      isLoading: false,
    })

    renderTable()

    await waitFor(() =>
      expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    )

    const viewButton = screen.getByRole("button", {
      name: "organization.inspection.viewButtonLabel",
    })
    const editButton = screen.getByRole("button", {
      name: "organization.inspection.editButtonLabel",
    })
    const deleteButton = screen.getByRole("button", {
      name: "organization.inspection.deleteButtonLabel",
    })

    for (const button of [viewButton, editButton, deleteButton]) {
      expect(button.className).toMatch(/\bh-11\b/)
      expect(button.className).toMatch(/\bw-11\b/)
    }
    expect(viewButton.getAttribute("aria-label")).not.toBe(
      editButton.getAttribute("aria-label")
    )
    expect(editButton.getAttribute("aria-label")).not.toBe(
      deleteButton.getAttribute("aria-label")
    )
  })

  it("gives the Start New button and search input a 44px touch target", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPage: 0 } },
      isLoading: false,
    })

    renderTable()

    expect(
      screen.getByRole("button", {
        name: /organization\.inspection\.startNew/i,
      }).className
    ).toMatch(/\bh-11\b/)
    expect(
      screen.getByPlaceholderText(
        "organization.inspection.searchPlaceholder"
      ).className
    ).toMatch(/\bh-11\b/)
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): both filter
  // SelectTriggers measured 28px tall live despite a plain `h-11` className
  // -- SelectTrigger sizes itself via a data-attribute-scoped Tailwind
  // variant (`data-[size=default]:h-7`), which tailwind-merge does not
  // reliably override with an unscoped className the way it does for plain
  // cva size variants (Button/Input). Fixed with the `!h-11` important
  // modifier. This test was added after the bug was only caught by live
  // browser measurement -- the SelectTrigger mock previously returned
  // `null`, so no unit test could see the className at all.
  it("gives the status and site filter dropdowns a 44px touch target", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPage: 0 } },
      isLoading: false,
    })

    renderTable()

    const triggers = screen.getAllByTestId("select-trigger")
    expect(triggers).toHaveLength(2)
    for (const trigger of triggers) {
      expect(trigger.className).toMatch(/!h-11\b/)
    }
  })

  // aexa-frontend#563: the Site column showed item.site.name as plain text
  // even though item.site.id was already available -- reuses the
  // established ?siteId=&search= pattern (#533/#552).
  it("links the Site column into Sites, scoped to that site", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [makeInspection()],
        meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
      },
      isLoading: false,
    })

    renderTable()

    await waitFor(() =>
      expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    )

    const link = screen.getByRole("link", { name: "HQ Casablanca" })
    expect(link).toHaveAttribute(
      "href",
      "/organization/sites?siteId=s-1&search=HQ%20Casablanca"
    )
  })

  // aexa-frontend#564: the Template column showed item.template.templateName
  // as plain text even though item.template.id was already available --
  // same route TemplatesPage.tsx already links to.
  it("links the Template column to its report page", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [makeInspection()],
        meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
      },
      isLoading: false,
    })

    renderTable()

    await waitFor(() =>
      expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    )

    const link = screen.getByRole("link", { name: "Fire Safety Audit" })
    expect(link).toHaveAttribute(
      "href",
      "/organization/audit/template/report/t-1"
    )
  })

  // aexa-frontend round-3 audit bug #3: item.updatedAt used to be formatted
  // with no locale argument at all, i.e. whatever locale the visiting
  // browser happens to be in, rather than the app's active UI language.
  it("formats the updatedAt date in French when the UI language is French", async () => {
    mockLanguage = "fr"
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [makeInspection({ updatedAt: "2026-06-21T10:00:00.000Z" })],
        meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
      },
      isLoading: false,
    })

    renderTable()

    const expected = new Date("2026-06-21T10:00:00.000Z").toLocaleDateString(
      "fr-FR"
    )
    await waitFor(() =>
      expect(screen.getByText(expected)).toBeInTheDocument()
    )
  })

  it("aexa-frontend#234: resets to page 1 when the status filter changes", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [makeInspection()],
        meta: { page: 1, limit: 10, total: 25, totalPage: 3 },
      },
      isLoading: false,
    })

    renderTable()
    await waitFor(() =>
      expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    )

    // Page to page 2.
    await userEvent.click(screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-chevron-right"))!)
    await waitFor(() =>
      expect(mockUseGetAllInspectionQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      )
    )

    // Applying a status filter must reset back to page 1, not stay on the
    // now-out-of-range page 2 of a differently-sized filtered set.
    const statusSelect = screen.getAllByRole("combobox")[0]
    await userEvent.selectOptions(statusSelect, "DRAFT")

    await waitFor(() =>
      expect(mockUseGetAllInspectionQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, status: "DRAFT" })
      )
    )
  })

  // quality-bar-loop round 14 (industry-standards): the dashboard's
  // "Active Inspections" card now links here with ?status=active, meaning
  // DRAFT or IN_PROGRESS (the same two statuses Overview.tsx's own KPI
  // count already uses). The status dropdown/API only support one exact
  // value at a time with no combined option, so while this filter is
  // active the page fetches every status at limit:100 instead of the
  // normal paginated limit:10 and filters client-side.
  describe("?status=active filter from the dashboard's Active Inspections card (round 14)", () => {
    it("fetches all statuses at limit:100 and shows only DRAFT/IN_PROGRESS rows plus a clear-filter link", () => {
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [
            makeInspection({
              id: "i1",
              status: "DRAFT",
              template: { id: "t1", templateName: "Draft Audit" },
            }),
            makeInspection({
              id: "i2",
              status: "IN_PROGRESS",
              template: { id: "t2", templateName: "In Progress Audit" },
            }),
            makeInspection({
              id: "i3",
              status: "COMPLETED",
              template: { id: "t3", templateName: "Completed Audit" },
            }),
          ],
          meta: { page: 1, limit: 100, total: 3, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTableWithPath("/?status=active")

      expect(screen.getByText("Draft Audit")).toBeInTheDocument()
      expect(screen.getByText("In Progress Audit")).toBeInTheDocument()
      expect(screen.queryByText("Completed Audit")).not.toBeInTheDocument()
      expect(mockUseGetAllInspectionQuery).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100, page: 1, status: "" })
      )
      expect(
        screen.getByText("organization.inspection.filteredByActiveStatus")
      ).toBeInTheDocument()
      expect(
        screen.getByRole("link", {
          name: "organization.inspection.clearStatusFilter",
        })
      ).toHaveAttribute("href", "/organization/audit/inspections")
    })

    // Round-1 review of quality-bar-loop round 14: this dropdown's own
    // value has zero effect on results while ?status=active is applied
    // (the query's status is force-overridden regardless), so leaving it
    // enabled let a user pick e.g. "Completed" and see the selection
    // change with no effect on the still-DRAFT/IN_PROGRESS-only results --
    // a silent no-op. It's disabled while the URL filter is active.
    it("disables the status dropdown while ?status=active is applied, so it can't silently no-op", () => {
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection({ status: "DRAFT" })],
          meta: { page: 1, limit: 100, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTableWithPath("/?status=active")

      expect(screen.getAllByRole("combobox")[0]).toBeDisabled()
    })

    it("does not narrow the list or show a clear-filter link with no ?status= param", () => {
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [
            makeInspection({
              id: "i1",
              status: "DRAFT",
              template: { id: "t1", templateName: "Draft Audit" },
            }),
            makeInspection({
              id: "i3",
              status: "COMPLETED",
              template: { id: "t3", templateName: "Completed Audit" },
            }),
          ],
          meta: { page: 1, limit: 10, total: 2, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      expect(screen.getByText("Draft Audit")).toBeInTheDocument()
      expect(screen.getByText("Completed Audit")).toBeInTheDocument()
      expect(
        screen.queryByText("organization.inspection.filteredByActiveStatus")
      ).not.toBeInTheDocument()
    })
  })

  it("aexa-frontend#234: resets to page 1 when the site filter changes", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [makeInspection()],
        meta: { page: 1, limit: 10, total: 25, totalPage: 3 },
      },
      isLoading: false,
    })
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "s-1", name: "HQ Casablanca" }] },
    })

    renderTable()
    await waitFor(() =>
      expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    )

    await userEvent.click(screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-chevron-right"))!)
    await waitFor(() =>
      expect(mockUseGetAllInspectionQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      )
    )

    const siteSelect = screen.getAllByRole("combobox")[1]
    await userEvent.selectOptions(siteSelect, "s-1")

    await waitFor(() =>
      expect(mockUseGetAllInspectionQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, siteId: "s-1" })
      )
    )
  })

  it("shows loading state", () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    renderTable()

    // i18n isn't initialized in the test environment, so t() echoes the raw
    // key back (see RiskRegisterPage.test.tsx for the same convention).
    expect(
      screen.getByText("organization.inspection.loading")
    ).toBeInTheDocument()
  })

  it("shows empty state when there are no inspections", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPage: 1 },
      },
      isLoading: false,
    })

    renderTable()

    await waitFor(() =>
      expect(
        screen.getByText("organization.inspection.empty")
      ).toBeInTheDocument()
    )
  })

  // quality-bar-loop round 16 (resilience regression): this query never
  // checked isError -- a genuine fetch failure fell through to `data?.data
  // || []`, rendering the identical empty-state message as "no
  // inspections match this filter."
  it("shows a distinct error message, not the empty state, when the inspections query fails", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })

    renderTable()

    await waitFor(() =>
      expect(
        screen.getByText("organization.inspection.listLoadError")
      ).toBeInTheDocument()
    )
    expect(
      screen.queryByText("organization.inspection.empty")
    ).not.toBeInTheDocument()
  })

  // aexa-frontend#242: Inspection had zero role gating, unlike every sibling
  // entity (Audit/Templates/Reports/Risk/Sites/Findings/KRI/Compliance),
  // already gated via useMyOrgRole()/canWriteOrgResource(role) per #217.
  describe("role gating (#242)", () => {
    it("shows Start New/Edit/Delete for ADMIN", async () => {
      mockRole = "ADMIN"
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection()],
          meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      await waitFor(() =>
        expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
      )
      expect(
        screen.getByText("organization.inspection.startNew")
      ).toBeInTheDocument()
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
      ).toBe(true)
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
      ).toBe(true)
    })

    it("hides Start New/Edit/Delete for a VIEWER", async () => {
      mockRole = "VIEWER"
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection()],
          meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      await waitFor(() =>
        expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
      )
      expect(
        screen.queryByText("organization.inspection.startNew")
      ).not.toBeInTheDocument()
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
      ).toBe(false)
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
      ).toBe(false)
      // View report stays visible for every role.
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-eye"))
      ).toBe(true)
    })

    it("hides Start New/Edit/Delete for a LIGHT_USER", async () => {
      mockRole = "LIGHT_USER"
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection()],
          meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      await waitFor(() =>
        expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
      )
      expect(
        screen.queryByText("organization.inspection.startNew")
      ).not.toBeInTheDocument()
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
      ).toBe(false)
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
      ).toBe(false)
    })
  })

  // aexa-frontend#276: create_inspection_into_db is ADMIN-only server-side
  // (inspection.service.ts), so the page-level "Start New" affordance must
  // be gated on the exact role rather than the broader canWrite (#242) used
  // by every other list page on this repo -- a LEAD_AUDITOR previously saw
  // the button and got a 403 on click.
  describe("Start New gating (#276)", () => {
    it("shows Start New for ADMIN", async () => {
      mockRole = "ADMIN"
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection()],
          meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      await waitFor(() =>
        expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
      )
      expect(
        screen.getByText("organization.inspection.startNew")
      ).toBeInTheDocument()
    })

    it("hides Start New for a LEAD_AUDITOR even though they can write other org resources", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection()],
          meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      await waitFor(() =>
        expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
      )
      expect(
        screen.queryByText("organization.inspection.startNew")
      ).not.toBeInTheDocument()
    })
  })

  // aexa-frontend#270: per-row narrowing on top of the #242 role gate above —
  // a LEAD_AUDITOR only gets Edit/Delete on rows they're actually assigned
  // to (mirrors org_scope.ts's assertCanWriteToInspection).
  describe("assignment gating (#270)", () => {
    it("hides Edit/Delete for a LEAD_AUDITOR with no assignment on this inspection", async () => {
      mockRole = "LEAD_AUDITOR"
      mockAssignedInspectionIds = new Set()
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection({ id: "insp-1" })],
          meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      await waitFor(() =>
        expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
      )
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
      ).toBe(false)
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
      ).toBe(false)
    })

    it("shows Edit/Delete for a LEAD_AUDITOR with an active assignment on this inspection", async () => {
      mockRole = "LEAD_AUDITOR"
      mockAssignedInspectionIds = new Set(["insp-1"])
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection({ id: "insp-1" })],
          meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      await waitFor(() =>
        expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
      )
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
      ).toBe(true)
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
      ).toBe(true)
    })

    it("does not narrow a LEAD_AUDITOR's row assigned on a DIFFERENT inspection", async () => {
      mockRole = "LEAD_AUDITOR"
      mockAssignedInspectionIds = new Set(["some-other-inspection"])
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection({ id: "insp-1" })],
          meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      await waitFor(() =>
        expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
      )
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
      ).toBe(false)
    })

    it("degrades to the pre-#270 role-only behavior when assignment data is unavailable", async () => {
      mockRole = "LEAD_AUDITOR"
      mockAssignedInspectionIds = undefined
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection({ id: "insp-1" })],
          meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      await waitFor(() =>
        expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
      )
      // Never breaks the page, and never denies more than the pre-#270
      // role-only gate did.
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
      ).toBe(true)
    })

    it("never grants an ADMIN's row-level access based on assignment state", async () => {
      mockRole = "ADMIN"
      mockAssignedInspectionIds = new Set()
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection({ id: "insp-1" })],
          meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        },
        isLoading: false,
      })

      renderTable()

      await waitFor(() =>
        expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
      )
      expect(
        screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
      ).toBe(true)
    })
  })

  describe("aexa-frontend#243: debounced search query", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("does not fire the query with the new search term immediately on keystroke", async () => {
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection()],
          meta: { page: 1, limit: 10, total: 25, totalPage: 3 },
        },
        isLoading: false,
      })

      renderTable()

      const searchInput = screen.getByPlaceholderText(
        "organization.inspection.searchPlaceholder"
      )

      act(() => {
        fireEvent.change(searchInput, { target: { value: "x" } })
      })

      // Immediately after the keystroke, the query must still be called with
      // the previous (empty) searchTerm -- not "x" -- since the debounce
      // hasn't elapsed yet.
      expect(mockUseGetAllInspectionQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchTerm: "" })
      )

      // Advance partway through the debounce window -- still should not have
      // fired with the new term.
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(mockUseGetAllInspectionQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchTerm: "" })
      )
    })

    it("commits the debounced search term and page reset together in the same query call", async () => {
      mockUseGetAllInspectionQuery.mockReturnValue({
        data: {
          data: [makeInspection()],
          meta: { page: 1, limit: 10, total: 25, totalPage: 3 },
        },
        isLoading: false,
      })

      renderTable()

      // Page to page 2 first, mirroring the #234 scenario: a deep page with
      // an active result set.
      act(() => {
        fireEvent.click(
          screen
            .getAllByRole("button")
            .find((b) => b.querySelector("svg.lucide-chevron-right"))!
        )
      })
      expect(mockUseGetAllInspectionQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      )

      const searchInput = screen.getByPlaceholderText(
        "organization.inspection.searchPlaceholder"
      )
      act(() => {
        fireEvent.change(searchInput, { target: { value: "fire" } })
      })

      // While still within the debounce window, the query must not have been
      // called with searchTerm "fire" paired with the stale page: 2 -- that
      // out-of-range combination is exactly the bug being fixed.
      expect(mockUseGetAllInspectionQuery).not.toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: "fire", page: 2 })
      )

      // Once the debounce fires, both the new search term and the page reset
      // must land in the same call.
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(mockUseGetAllInspectionQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchTerm: "fire", page: 1 })
      )
    })
  })

  // aexa-frontend#265: the delete-path counterpart to #234/#243 above. Those
  // fixed page state going stale when a FILTER change shrinks totalPages;
  // this covers a delete alone shrinking totalPages with no filter touched.
  it("aexa-frontend#265: clamps the page back into range after a delete shrinks totalPages", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [makeInspection()],
        meta: { page: 1, limit: 10, total: 25, totalPage: 3 },
      },
      isLoading: false,
    })
    mockDeleteInspectionTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    renderTable()
    await waitFor(() =>
      expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    )

    const nextButton = () =>
      screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-chevron-right"))!

    await userEvent.click(nextButton())
    await userEvent.click(nextButton())
    await waitFor(() =>
      expect(mockUseGetAllInspectionQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 3 })
      )
    )

    // Deleting the last inspection on page 3 drops total to 20 -> totalPage 2,
    // stranding page 3 out of range.
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [],
        meta: { page: 3, limit: 10, total: 20, totalPage: 2 },
      },
      isLoading: false,
    })

    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!
    await userEvent.click(deleteButton)
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockUseGetAllInspectionQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      )
    )
  })

  // Same discarded-isLoading double-submission bug fixed for
  // RiskRegisterPage/aexa-frontend#620 -- useDeleteInspectionMutation's
  // isLoading was previously discarded, so the Delete confirmation button
  // never disabled while a request was already in flight.
  it("disables the delete confirmation button while a delete is already in flight", async () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: { data: [makeInspection()] },
      isLoading: false,
    })
    mockIsInspectionDeleting = true

    renderTable()
    await waitFor(() =>
      expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    )

    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!
    await userEvent.click(deleteButton)

    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeDisabled()
  })
})
