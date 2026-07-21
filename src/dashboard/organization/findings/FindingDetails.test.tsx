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
const mockUpdateFinding = vi.fn()
const mockUploadAttachment = vi.fn()

vi.mock("@/redux/apis/organization/findings.api", () => ({
  useGetFindingByIdQuery: (...args: unknown[]) =>
    mockUseGetFindingByIdQuery(...args),
  useDeleteFindingByIdMutation: () => [
    mockDeleteFinding,
    { isLoading: false },
  ],
  useUpdateFindingByIdMutation: () => [mockUpdateFinding, { isLoading: false }],
  useUploadFindingAttachmentMutation: () => [
    mockUploadAttachment,
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
    attachments: [],
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
    mockUpdateFinding.mockReset()
    mockUploadAttachment.mockReset()
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

  it("renders actionDisc as literal text and does not execute injected HTML (XSS regression, #107)", async () => {
    const payload = "<img src=x onerror=alert(1)>"
    mockUseGetFindingByIdQuery.mockReturnValue({
      data: { data: makeAction({ actionDisc: payload }) },
      isLoading: false,
    })

    const { container } = renderPage()

    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText(payload)).toBeInTheDocument()
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

  describe("attachments", () => {
    async function openFilesTab() {
      await userEvent.click(
        screen.getByRole("button", { name: /attachments/i })
      )
    }

    it("shows the empty state when there are no attachments", async () => {
      renderPage()
      await openFilesTab()

      expect(screen.getByText("No attachments")).toBeInTheDocument()
    })

    it("renders existing attachments split into images and files", async () => {
      mockUseGetFindingByIdQuery.mockReturnValue({
        data: {
          data: makeAction({
            attachments: [
              "https://cdn.example.com/photo.png",
              "https://cdn.example.com/report.pdf",
            ],
          }),
        },
        isLoading: false,
      })
      renderPage()
      await openFilesTab()

      expect(screen.getByText("report.pdf")).toBeInTheDocument()
      expect(screen.getByAltText("attachment-0")).toBeInTheDocument()
    })

    it("uploads a file, persists the URL onto the finding, and shows a success toast", async () => {
      mockUploadAttachment.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ data: { url: "https://cdn.example.com/new.png" } }),
      })
      mockUpdateFinding.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })
      renderPage()
      await openFilesTab()

      const file = new File(["x"], "new.png", { type: "image/png" })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() => expect(mockUploadAttachment).toHaveBeenCalled())
      await waitFor(() =>
        expect(mockUpdateFinding).toHaveBeenCalledWith({
          id: "finding-1",
          body: { attachments: ["https://cdn.example.com/new.png"] },
        })
      )
      expect(mockToastSuccess).toHaveBeenCalledWith("Attachment uploaded")
    })

    it("appends the new URL to existing attachments rather than replacing them", async () => {
      mockUseGetFindingByIdQuery.mockReturnValue({
        data: {
          data: makeAction({
            attachments: ["https://cdn.example.com/existing.png"],
          }),
        },
        isLoading: false,
      })
      mockUploadAttachment.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ data: { url: "https://cdn.example.com/new.png" } }),
      })
      mockUpdateFinding.mockReturnValue({ unwrap: () => Promise.resolve({}) })
      renderPage()
      await openFilesTab()

      const file = new File(["x"], "new.png", { type: "image/png" })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() =>
        expect(mockUpdateFinding).toHaveBeenCalledWith({
          id: "finding-1",
          body: {
            attachments: [
              "https://cdn.example.com/existing.png",
              "https://cdn.example.com/new.png",
            ],
          },
        })
      )
    })

    it("shows an error toast when the upload itself fails", async () => {
      mockUploadAttachment.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: "File too large" } }),
      })
      renderPage()
      await openFilesTab()

      const file = new File(["x"], "new.png", { type: "image/png" })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("File too large")
      )
      expect(mockUpdateFinding).not.toHaveBeenCalled()
    })

    it("shows an error toast and does not lose the attachment when persisting the URL fails", async () => {
      mockUploadAttachment.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ data: { url: "https://cdn.example.com/new.png" } }),
      })
      mockUpdateFinding.mockReturnValue({
        unwrap: () => Promise.reject({ data: { message: "Save failed" } }),
      })
      renderPage()
      await openFilesTab()

      const file = new File(["x"], "new.png", { type: "image/png" })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("Save failed")
      )
    })

    it("shows a partial-success message (not the generic upload-failed toast) when the file uploads but persisting it to the finding then fails (#123)", async () => {
      mockUploadAttachment.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ data: { url: "https://cdn.example.com/new.png" } }),
      })
      mockUpdateFinding.mockReturnValue({
        unwrap: () => Promise.reject({ data: {} }),
      })
      renderPage()
      await openFilesTab()

      const file = new File(["x"], "new.png", { type: "image/png" })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() => expect(mockUpdateFinding).toHaveBeenCalled())
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          "File uploaded, but failed to attach it to the finding. Please try uploading it again."
        )
      )
      // The file itself genuinely uploaded -- the generic "Failed to upload
      // attachment" full-failure message must not fire, and neither must the
      // success toast (only attaching the URL to the finding failed).
      expect(mockToastError).not.toHaveBeenCalledWith(
        "Failed to upload attachment"
      )
      expect(mockToastSuccess).not.toHaveBeenCalled()
    })

    it("removes an attachment by filtering it out of the array", async () => {
      mockUseGetFindingByIdQuery.mockReturnValue({
        data: {
          data: makeAction({
            attachments: [
              "https://cdn.example.com/keep.png",
              "https://cdn.example.com/remove.png",
            ],
          }),
        },
        isLoading: false,
      })
      mockUpdateFinding.mockReturnValue({ unwrap: () => Promise.resolve({}) })
      renderPage()
      await openFilesTab()

      const removeButtons = screen.getAllByTitle("Remove")
      await userEvent.click(removeButtons[0])

      await waitFor(() =>
        expect(mockUpdateFinding).toHaveBeenCalledWith({
          id: "finding-1",
          body: { attachments: ["https://cdn.example.com/remove.png"] },
        })
      )
      expect(mockToastSuccess).toHaveBeenCalledWith("Attachment removed")
    })

    it("blocks a second remove while one is still in flight, preventing a lost-update race", async () => {
      mockUseGetFindingByIdQuery.mockReturnValue({
        data: {
          data: makeAction({
            attachments: [
              "https://cdn.example.com/a.png",
              "https://cdn.example.com/b.png",
            ],
          }),
        },
        isLoading: false,
      })
      let resolveFirstRemove: (value: unknown) => void = () => {}
      const firstRemovePromise = new Promise((resolve) => {
        resolveFirstRemove = resolve
      })
      mockUpdateFinding.mockReturnValueOnce({
        unwrap: () => firstRemovePromise,
      })
      renderPage()
      await openFilesTab()

      const removeButtons = screen.getAllByTitle("Remove")
      await userEvent.click(removeButtons[0])

      // Second attachment's remove button must be disabled while the first
      // removal is still pending — both handlers build their PATCH body
      // from the same render's `action.attachments` closure, so allowing a
      // second remove to start here would race and could silently undo the
      // first removal (whichever PATCH resolves last wins).
      expect(screen.getAllByTitle("Remove")[1]).toBeDisabled()
      await userEvent.click(screen.getAllByTitle("Remove")[1])
      expect(mockUpdateFinding).toHaveBeenCalledTimes(1)

      resolveFirstRemove({})
      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
    })
  })
})
