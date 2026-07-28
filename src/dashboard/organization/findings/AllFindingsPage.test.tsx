import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AllFindingsPage from "./AllFindingsPage"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// aexa-frontend#217 -- role hook mocked per-test via this mutable holder,
// same convention as RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
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
    mockRole = "ADMIN"
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
    render(<AllFindingsPage />)

    expect(
      screen.getByText("organization.findings.createTitle")
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
    ).toBe(true)
  })

  it("hides Create Finding, Edit and Delete for a VIEWER", () => {
    mockRole = "VIEWER"
    render(<AllFindingsPage />)

    expect(
      screen.queryByText("organization.findings.createTitle")
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pen"))
    ).toBe(false)
  })

  it("hides write controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    render(<AllFindingsPage />)

    expect(
      screen.queryByText("organization.findings.createTitle")
    ).not.toBeInTheDocument()
  })

  it("clicking Edit opens the modal with the correct editData and does not navigate", async () => {
    render(<AllFindingsPage />)

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
    render(<AllFindingsPage />)

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
    render(<AllFindingsPage />)

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
    render(<AllFindingsPage />)

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

    render(<AllFindingsPage />)

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
    render(<AllFindingsPage />)

    await userEvent.click(screen.getByText("Fix broken railing"))

    expect(mockNavigate).toHaveBeenCalledWith(
      "/organization/finding/finding-1"
    )
  })
})
