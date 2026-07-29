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

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useGetAllInspectionQuery: (...args: unknown[]) =>
    mockUseGetAllInspectionQuery(...args),
  useDeleteInspectionMutation: () => [mockDeleteInspectionTrigger],
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
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
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
  }: {
    children: React.ReactNode
    value?: string
    onValueChange?: (v: string) => void
  }) => (
    <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
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

describe("InspectionTable", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockDeleteInspectionTrigger.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockUseGetAllSitesQuery.mockReturnValue({ data: { data: [] } })
    mockRole = "ADMIN"
    mockAssignedInspectionIds = new Set()
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
})
