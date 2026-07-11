import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import FindingDetails from "./FindingDetails"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return {
    ...mod,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "finding-1" }),
  }
})

const mockUseGetFindingByIdQuery = vi.fn()
const mockDeleteFinding = vi.fn()

vi.mock("@/redux/apis/organization/findings.api", () => ({
  useGetFindingByIdQuery: (...args: unknown[]) =>
    mockUseGetFindingByIdQuery(...args),
  useDeleteFindingByIdMutation: () => [
    mockDeleteFinding,
    { isLoading: false },
  ],
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
      <div data-testid="edit-finding-modal">
        {editData ? `Editing: ${editData.actionTitle}` : "No data"}
      </div>
    ) : null,
}))

vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
}))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)
const mockToastSuccess = vi.mocked(toast.success)

function makeAction(overrides = {}) {
  return {
    id: "finding-1",
    orgAccountId: "org-1",
    inspectionId: "insp-1",
    siteId: "site-1",
    questionId: null,
    actionTitle: "Fix broken railing",
    actionDisc: "Railing on level 2 is loose.",
    priority: "High",
    dueDate: "2099-07-01T00:00:00.000Z",
    status: "TO_DO",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    messages: [],
    site: { id: "site-1", name: "HQ Casablanca" },
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <FindingDetails />
    </MemoryRouter>
  )
}

describe("FindingDetails", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockUseGetFindingByIdQuery.mockReset()
    mockDeleteFinding.mockReset()
    mockToastError.mockReset()
    mockToastSuccess.mockReset()
    mockUseGetFindingByIdQuery.mockReturnValue({
      data: { data: makeAction() },
      isLoading: false,
    })
  })

  it("Edit button opens the modal pre-filled with the finding", async () => {
    renderPage()

    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }))

    expect(screen.getByTestId("edit-finding-modal")).toHaveTextContent(
      "Editing: Fix broken railing"
    )
  })

  it("Delete button opens the confirm modal", async () => {
    renderPage()

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }))

    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeInTheDocument()
  })

  it("confirming delete calls the delete mutation and navigates away on success", async () => {
    mockDeleteFinding.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    renderPage()

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }))
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockDeleteFinding).toHaveBeenCalledWith("finding-1")
    )
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(-1))
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("shows an error toast and does not navigate when delete fails", async () => {
    mockDeleteFinding.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Cannot delete finding" } }),
    })
    renderPage()

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }))
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Cannot delete finding")
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
