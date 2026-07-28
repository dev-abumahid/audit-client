import { render, screen, waitFor } from "@testing-library/react"
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
  default: () => null,
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
    // Status appears in both the filter dropdown option and the table badge
    expect(screen.getAllByText("IN_PROGRESS").length).toBeGreaterThan(0)
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
})
