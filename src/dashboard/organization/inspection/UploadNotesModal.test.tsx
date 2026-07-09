import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import UploadNotesModal from "./UploadNotesModal"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

const mockUploadRawNote = vi.fn()
const mockExtractNoteFromFile = vi.fn()
const mockUpdateNote = vi.fn()
const mockSplitInspectionNote = vi.fn()
const mockDeleteNote = vi.fn()
const mockUseGetNoteByInspectionIdQuery = vi.fn()
const mockRefetch = vi.fn()

vi.mock("@/redux/apis/organization/note.api", () => ({
  useSaveRawNoteMutation: () => [mockUploadRawNote],
  useExtractNoteFromFileMutation: () => [mockExtractNoteFromFile],
  useUpdateNoteMutation: () => [mockUpdateNote],
  useDeleteNoteByIdMutation: () => [mockDeleteNote],
  useGetNoteByInspectionIdQuery: (...args: unknown[]) =>
    mockUseGetNoteByInspectionIdQuery(...args),
}))

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useSplitInspectionNoteMutation: () => [mockSplitInspectionNote],
}))

vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
}))

function renderModal(
  overrides: Partial<{ open: boolean; inspectionId: string }> = {}
) {
  const setOpen = vi.fn()
  const utils = render(
    <UploadNotesModal
      open={overrides.open ?? true}
      setOpen={setOpen}
      inspectionId={overrides.inspectionId ?? "insp-1"}
    />
  )
  return { ...utils, setOpen }
}

describe("UploadNotesModal", () => {
  beforeEach(() => {
    mockUploadRawNote.mockReset()
    mockExtractNoteFromFile.mockReset()
    mockUpdateNote.mockReset()
    mockSplitInspectionNote.mockReset()
    mockDeleteNote.mockReset()
    mockUseGetNoteByInspectionIdQuery.mockReset()
    mockRefetch.mockReset()
    mockToastError.mockReset()
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      refetch: mockRefetch,
    })
  })

  it("shows the upload-method chooser when no note exists yet", () => {
    renderModal()

    expect(
      screen.getByRole("heading", { name: "Upload Notes" })
    ).toBeInTheDocument()
    expect(screen.getByText("Notes by Text")).toBeInTheDocument()
    expect(screen.getByText("Extract note from file")).toBeInTheDocument()
  })

  it('reveals the text field after choosing "Notes by Text"', async () => {
    renderModal()

    await userEvent.click(screen.getByText("Notes by Text"))

    expect(screen.getByLabelText("Write Detailed Note")).toBeInTheDocument()
  })

  it("submits raw text and calls uploadRawNote", async () => {
    mockUploadRawNote.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, message: "Note saved" }),
    })

    renderModal({ inspectionId: "insp-42" })
    await userEvent.click(screen.getByText("Notes by Text"))
    await userEvent.type(
      screen.getByLabelText("Write Detailed Note"),
      "Fire extinguisher checked"
    )
    await userEvent.click(screen.getByRole("button", { name: /upload notes/i }))

    await waitFor(() => expect(mockUploadRawNote).toHaveBeenCalled())
    expect(mockUploadRawNote.mock.calls[0][0]).toMatchObject({
      extracted_text: "Fire extinguisher checked",
      inspectionId: "insp-42",
    })
  })

  it("disables the upload button until a mode is chosen", () => {
    renderModal()

    expect(screen.getByRole("button", { name: /upload notes/i })).toBeDisabled()
  })

  it("shows the update form when a note already exists", () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { id: "note-1", extracted_text: "Existing note content" } },
      refetch: mockRefetch,
    })

    renderModal()

    expect(
      screen.getByRole("heading", { name: "Update Note" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Note Content")).toHaveValue(
      "Existing note content"
    )
  })

  it("submits an update and calls updateNote with the edited text", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { id: "note-1", extracted_text: "Old text" } },
      refetch: mockRefetch,
    })
    mockUpdateNote.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    renderModal()
    const textarea = screen.getByLabelText("Note Content")
    await userEvent.clear(textarea)
    await userEvent.type(textarea, "Updated text")
    await userEvent.click(screen.getByRole("button", { name: /update note/i }))

    await waitFor(() =>
      expect(mockUpdateNote).toHaveBeenCalledWith({
        id: "note-1",
        body: { extracted_text: "Updated text" },
      })
    )
  })

  it("opens delete confirmation and calls deleteNote on confirm", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { id: "note-1", extracted_text: "Some text" } },
      refetch: mockRefetch,
    })
    mockDeleteNote.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    renderModal()
    await userEvent.click(screen.getByRole("button", { name: /delete note/i }))
    // Radix scroll-locks the body (pointer-events: none) and marks background siblings
    // aria-hidden while its own dialog is open. The mocked DeleteAlertModal isn't wrapped in
    // its own portal, so userEvent's pointer-events/visibility checks reject a real click here —
    // fireEvent bypasses those checks, which is fine since we're not testing Radix itself.
    fireEvent.click(
      screen.getByRole("button", { name: /confirm delete/i, hidden: true })
    )

    await waitFor(() => expect(mockDeleteNote).toHaveBeenCalledWith("note-1"))
  })

  it("shows an error toast when uploading raw text fails", async () => {
    mockUploadRawNote.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Server unavailable" } }),
    })

    renderModal()
    await userEvent.click(screen.getByText("Notes by Text"))
    await userEvent.type(
      screen.getByLabelText("Write Detailed Note"),
      "Some note"
    )
    await userEvent.click(screen.getByRole("button", { name: /upload notes/i }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server unavailable")
    )
  })

  it("shows an error toast (with fallback message) when updating a note fails", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { id: "note-1", extracted_text: "Old text" } },
      refetch: mockRefetch,
    })
    mockUpdateNote.mockReturnValue({ unwrap: () => Promise.reject({}) })

    renderModal()
    const textarea = screen.getByLabelText("Note Content")
    await userEvent.type(textarea, "!")
    await userEvent.click(screen.getByRole("button", { name: /update note/i }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to update note")
    )
  })

  it("shows an error toast (with fallback message) when deleting a note fails", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { id: "note-1", extracted_text: "Some text" } },
      refetch: mockRefetch,
    })
    mockDeleteNote.mockReturnValue({ unwrap: () => Promise.reject({}) })

    renderModal()
    await userEvent.click(screen.getByRole("button", { name: /delete note/i }))
    fireEvent.click(
      screen.getByRole("button", { name: /confirm delete/i, hidden: true })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to delete note")
    )
  })

  it('calls splitInspectionNote when "Split Note" is clicked', async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { id: "note-1", extracted_text: "Some text" } },
      refetch: mockRefetch,
    })
    mockSplitInspectionNote.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, message: "Split done" }),
    })

    renderModal({ inspectionId: "insp-77" })
    await userEvent.click(screen.getByRole("button", { name: /split note/i }))

    await waitFor(() =>
      expect(mockSplitInspectionNote).toHaveBeenCalledWith("insp-77")
    )
  })
})
