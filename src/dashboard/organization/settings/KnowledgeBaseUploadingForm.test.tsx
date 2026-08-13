import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import KnowledgeBaseUploadingForm from "./KnowledgeBaseUploadingForm"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)
const mockToastInfo = vi.mocked(toast.info)

const mockUseGetAllFilesFromPineconeQuery = vi.fn()
const mockUseCheckUploadFileStatusQuery = vi.fn()
const mockUploadDocument = vi.fn()
const mockDeleteDocument = vi.fn()

vi.mock("@/redux/apis/organization/knowledgeBase.api", () => ({
  useGetAllFilesFromPineconeQuery: (...args: unknown[]) =>
    mockUseGetAllFilesFromPineconeQuery(...args),
  useCheckUploadFileStatusQuery: (...args: unknown[]) =>
    mockUseCheckUploadFileStatusQuery(...args),
  useUploadPdfIntoPineconeMutation: () => [mockUploadDocument],
  useDeleteFileFromPineconeMutation: () => [mockDeleteDocument],
}))

function makeDoc(overrides = {}) {
  return {
    id: "doc-1",
    fileName: "policy.pdf",
    fileSize: "2048",
    fileId: "file-1",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

function uploadFile(name = "new.pdf") {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement
  const file = new File(["%PDF"], name, { type: "application/pdf" })
  return userEvent.upload(input, file)
}

describe("KnowledgeBaseUploadingForm", () => {
  beforeEach(() => {
    mockUseGetAllFilesFromPineconeQuery.mockReset()
    mockUseCheckUploadFileStatusQuery.mockReset()
    mockUploadDocument.mockReset()
    mockDeleteDocument.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockToastInfo.mockReset()

    mockUseGetAllFilesFromPineconeQuery.mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      refetch: vi.fn(),
    })
    // Default: no status yet for any fileId (no poller is mounted until an
    // upload starts, so this only matters once one is).
    mockUseCheckUploadFileStatusQuery.mockReturnValue({ data: undefined })
  })

  it("shows the empty state when there are no documents", () => {
    render(<KnowledgeBaseUploadingForm />)
    expect(screen.getByText("organization.knowledgeBase.noDocuments")).toBeInTheDocument()
  })

  // aexa-frontend#464 -- this heading used to be an <h1>, which duplicated
  // OrgSettingPage's own page-level <h1> whenever the Knowledge tab was
  // active (both render at once, since tabs are in-page state, not routes).
  it("renders its heading as an h2, not a duplicate h1", () => {
    render(<KnowledgeBaseUploadingForm />)
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "organization.knowledgeBase.heading",
      })
    ).toBeInTheDocument()
  })

  it("renders existing documents", () => {
    mockUseGetAllFilesFromPineconeQuery.mockReturnValue({
      data: { data: [makeDoc()], meta: { total: 1 } },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<KnowledgeBaseUploadingForm />)
    expect(screen.getByText("policy.pdf")).toBeInTheDocument()
  })

  it("starts polling status after a successful upload that returns a fileId", async () => {
    mockUploadDocument.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: { fileId: "file-new" },
        }),
    })

    render(<KnowledgeBaseUploadingForm />)
    await uploadFile()

    await waitFor(() =>
      expect(mockToastInfo).toHaveBeenCalledWith("organization.knowledgeBase.queued")
    )
    // A poller instance mounts for this fileId with no `skip` option (it's
    // only rendered while tracked, unlike the old single-scalar version).
    await waitFor(() =>
      expect(mockUseCheckUploadFileStatusQuery).toHaveBeenCalledWith(
        "file-new",
        expect.objectContaining({ pollingInterval: 2000 })
      )
    )
  })

  it('shows a success toast and stops polling when status becomes "completed"', async () => {
    mockUploadDocument.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, data: { fileId: "file-1" } }),
    })
    mockUseCheckUploadFileStatusQuery.mockReturnValue({
      data: { data: { status: "completed", message: "done" } },
    })

    render(<KnowledgeBaseUploadingForm />)
    await uploadFile()

    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "organization.knowledgeBase.processingDone"
      )
    )
  })

  it('shows an error toast when status becomes "failed"', async () => {
    mockUploadDocument.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, data: { fileId: "file-1" } }),
    })
    mockUseCheckUploadFileStatusQuery.mockReturnValue({
      data: { data: { status: "failed", message: "embedding failed" } },
    })

    render(<KnowledgeBaseUploadingForm />)
    await uploadFile()

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("embedding failed")
    )
  })

  it("disables delete and shows a Processing badge on a document while its upload is still being polled", async () => {
    mockUseGetAllFilesFromPineconeQuery.mockReturnValue({
      data: { data: [makeDoc({ fileId: "file-1" })], meta: { total: 1 } },
      isLoading: false,
      refetch: vi.fn(),
    })
    mockUploadDocument.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, data: { fileId: "file-1" } }),
    })
    // Still in flight — no terminal status yet.
    mockUseCheckUploadFileStatusQuery.mockReturnValue({
      data: { data: { status: "processing", message: "Embedding..." } },
    })

    render(<KnowledgeBaseUploadingForm />)
    await uploadFile()

    await waitFor(() => expect(screen.getByTitle("organization.knowledgeBase.delete")).toBeDisabled())
    expect(screen.getByText("organization.knowledgeBase.processing")).toBeInTheDocument()
  })

  it("tracks two concurrent uploads independently — the first's completion isn't dropped by starting a second", async () => {
    mockUseGetAllFilesFromPineconeQuery.mockReturnValue({
      data: {
        data: [
          makeDoc({ id: "doc-1", fileId: "file-1", fileName: "a.pdf" }),
          makeDoc({ id: "doc-2", fileId: "file-2", fileName: "b.pdf" }),
        ],
        meta: { total: 2 },
      },
      isLoading: false,
      refetch: vi.fn(),
    })
    mockUploadDocument
      .mockReturnValueOnce({
        unwrap: () =>
          Promise.resolve({ success: true, data: { fileId: "file-1" } }),
      })
      .mockReturnValueOnce({
        unwrap: () =>
          Promise.resolve({ success: true, data: { fileId: "file-2" } }),
      })
    // Each poller instance is called with its own fileId — respond
    // differently per id so both are tracked independently.
    mockUseCheckUploadFileStatusQuery.mockImplementation((fileId: string) => {
      if (fileId === "file-1") {
        return { data: { data: { status: "processing" } } }
      }
      if (fileId === "file-2") {
        return { data: { data: { status: "processing" } } }
      }
      return { data: undefined }
    })

    render(<KnowledgeBaseUploadingForm />)
    await uploadFile("a.pdf")
    await uploadFile("b.pdf")

    await waitFor(() => {
      const deleteButtons = screen.getAllByTitle("organization.knowledgeBase.delete")
      expect(deleteButtons[0]).toBeDisabled()
      expect(deleteButtons[1]).toBeDisabled()
    })
    // Both docs still show as processing — neither upload's tracking was
    // silently overwritten by the other starting.
    expect(screen.getAllByText("organization.knowledgeBase.processing")).toHaveLength(2)
  })

  it("shows an error toast for a non-PDF file without calling the upload mutation", async () => {
    render(<KnowledgeBaseUploadingForm />)
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["hi"], "notes.txt", { type: "text/plain" })
    // userEvent.upload respects the input's `accept` filter and silently
    // no-ops for a mismatched file type — fireEvent bypasses that so the
    // component's own type check is what's actually being tested here.
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.knowledgeBase.uploadPdfOnly"
      )
    )
    expect(mockUploadDocument).not.toHaveBeenCalled()
  })

  // Regression (aexa-frontend#492): the drag-and-drop dropzone was a plain
  // <div> with only onClick/onDrag handlers -- no role="button", no
  // tabIndex, no onKeyDown -- so a keyboard-only user could never reach or
  // trigger it (the real <input type="file"> it delegates to is
  // className="hidden", removed from the tab order).
  describe("dropzone keyboard operability (#492)", () => {
    it("exposes the dropzone as a focusable button", () => {
      render(<KnowledgeBaseUploadingForm />)

      const dropzone = screen.getByRole("button", {
        name: "organization.knowledgeBase.dropHint",
      })
      expect(dropzone).toHaveAttribute("tabIndex", "0")
    })

    it("opens the file picker on Enter", async () => {
      render(<KnowledgeBaseUploadingForm />)
      const dropzone = screen.getByRole("button", {
        name: "organization.knowledgeBase.dropHint",
      })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      const clickSpy = vi.spyOn(input, "click")

      dropzone.focus()
      await userEvent.keyboard("{Enter}")

      expect(clickSpy).toHaveBeenCalled()
    })

    it("opens the file picker on Space", async () => {
      render(<KnowledgeBaseUploadingForm />)
      const dropzone = screen.getByRole("button", {
        name: "organization.knowledgeBase.dropHint",
      })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      const clickSpy = vi.spyOn(input, "click")

      dropzone.focus()
      await userEvent.keyboard(" ")

      expect(clickSpy).toHaveBeenCalled()
    })
  })

  // Raw <button>s default to type="submit" per HTML spec, which is a latent
  // bug if this form ever ends up inside a <form>. The only real <button>
  // element rendered here is the per-document delete button (the dropzone
  // is a role="button" <div>, not a <button>).
  it("gives every button an explicit type", () => {
    mockUseGetAllFilesFromPineconeQuery.mockReturnValue({
      data: { data: [makeDoc()], meta: { total: 1 } },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<KnowledgeBaseUploadingForm />)

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })
})
