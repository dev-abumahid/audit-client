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
// Mutable per-test, same convention as RiskRegisterPage.test.tsx's
// mockIsRiskDeleting -- lets the double-submission-guard test below flip
// this to true without a static mock.
let mockIsNoteDeleting = false

vi.mock("@/redux/apis/organization/note.api", () => ({
  useSaveRawNoteMutation: () => [mockUploadRawNote],
  useExtractNoteFromFileMutation: () => [mockExtractNoteFromFile],
  useUpdateNoteMutation: () => [mockUpdateNote],
  useDeleteNoteByIdMutation: () => [
    mockDeleteNote,
    { isLoading: mockIsNoteDeleting },
  ],
  useGetNoteByInspectionIdQuery: (...args: unknown[]) =>
    mockUseGetNoteByInspectionIdQuery(...args),
}))

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useSplitInspectionNoteMutation: () => [mockSplitInspectionNote],
}))

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
    mockIsNoteDeleting = false
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      refetch: mockRefetch,
    })
  })

  it("shows the upload-method chooser when no note exists yet", () => {
    renderModal()

    expect(
      screen.getByRole("heading", {
        name: "organization.inspection.uploadNotes",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.inspection.notesByText")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.inspection.extractNoteFromFile")
    ).toBeInTheDocument()
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): the shared
  // Button's default height (h-7) is well under the 44px touch-target
  // guideline, same bug class fixed on 9+ pages this session.
  it("gives the footer Cancel/Upload buttons a 44px touch target", () => {
    renderModal()

    expect(
      screen.getByRole("button", { name: "organization.inspection.cancel" })
        .className
    ).toMatch(/\bh-11\b/)
    expect(
      screen.getByRole("button", {
        name: "organization.inspection.uploadNotes",
      }).className
    ).toMatch(/\bh-11\b/)
  })

  it('reveals the text field after choosing "Notes by Text"', async () => {
    renderModal()

    await userEvent.click(
      screen.getByText("organization.inspection.notesByText")
    )

    expect(
      screen.getByLabelText("organization.inspection.writeDetailedNote")
    ).toBeInTheDocument()
  })

  it("submits raw text and calls uploadRawNote", async () => {
    mockUploadRawNote.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, message: "Note saved" }),
    })

    renderModal({ inspectionId: "insp-42" })
    await userEvent.click(
      screen.getByText("organization.inspection.notesByText")
    )
    await userEvent.type(
      screen.getByLabelText("organization.inspection.writeDetailedNote"),
      "Fire extinguisher checked"
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.uploadNotes",
      })
    )

    await waitFor(() => expect(mockUploadRawNote).toHaveBeenCalled())
    expect(mockUploadRawNote.mock.calls[0][0]).toMatchObject({
      title: "organization.inspection.inspectionNoteTitle",
      extracted_text: "Fire extinguisher checked",
      inspectionId: "insp-42",
    })
  })

  it("disables the upload button until a mode is chosen", () => {
    renderModal()

    expect(
      screen.getByRole("button", {
        name: "organization.inspection.uploadNotes",
      })
    ).toBeDisabled()
  })

  it("keeps the upload button disabled when text mode is chosen but no text is entered", async () => {
    renderModal()

    await userEvent.click(
      screen.getByText("organization.inspection.notesByText")
    )

    expect(
      screen.getByRole("button", {
        name: "organization.inspection.uploadNotes",
      })
    ).toBeDisabled()
  })

  it("enables the upload button once text is entered in text mode", async () => {
    renderModal()

    await userEvent.click(
      screen.getByText("organization.inspection.notesByText")
    )
    await userEvent.type(
      screen.getByLabelText("organization.inspection.writeDetailedNote"),
      "Some content"
    )

    expect(
      screen.getByRole("button", {
        name: "organization.inspection.uploadNotes",
      })
    ).not.toBeDisabled()
  })

  it("keeps the upload button disabled when file mode is chosen but no file is selected", async () => {
    renderModal()

    await userEvent.click(
      screen.getByText("organization.inspection.extractNoteFromFile")
    )

    expect(
      screen.getByRole("button", {
        name: "organization.inspection.uploadNotes",
      })
    ).toBeDisabled()
  })

  it("enables the upload button once a file is selected in file mode", async () => {
    renderModal()

    await userEvent.click(
      screen.getByText("organization.inspection.extractNoteFromFile")
    )
    // Radix Dialog portals its content to document.body rather than the RTL
    // render container, so query the document directly (same pattern as
    // InspectionNote.test.tsx's file-input tests).
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"]'
    )!
    const file = new File(["note"], "note.pdf", { type: "application/pdf" })
    await userEvent.upload(input, file)

    expect(
      screen.getByRole("button", {
        name: "organization.inspection.uploadNotes",
      })
    ).not.toBeDisabled()
  })

  // quality-bar-loop (Inspections, round 7, accessibility finding): this
  // file input used `className="hidden"` (display:none), removing it from
  // the tab order entirely -- a keyboard-only user couldn't upload a note
  // file at all (WCAG 2.1.1). `sr-only` keeps it visually hidden but
  // focusable.
  it("keeps the file upload input focusable (not display:none-hidden)", async () => {
    renderModal()

    await userEvent.click(
      screen.getByText("organization.inspection.extractNoteFromFile")
    )
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"]'
    )!

    expect(input.className).toMatch(/\bsr-only\b/)
    expect(input.className).not.toMatch(/\bhidden\b/)
  })

  it("shows the update form when a note already exists", () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { id: "note-1", extracted_text: "Existing note content" } },
      refetch: mockRefetch,
    })

    renderModal()

    expect(
      screen.getByRole("heading", {
        name: "organization.inspection.updateNote",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.inspection.noteContent")
    ).toHaveValue("Existing note content")
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
    const textarea = screen.getByLabelText(
      "organization.inspection.noteContent"
    )
    await userEvent.clear(textarea)
    await userEvent.type(textarea, "Updated text")
    await userEvent.click(
      screen.getByRole("button", { name: "organization.inspection.updateNote" })
    )

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
    await userEvent.click(
      screen.getByRole("button", { name: "organization.inspection.deleteNote" })
    )
    // Radix scroll-locks the body (pointer-events: none) and marks background siblings
    // aria-hidden while its own dialog is open. The mocked DeleteAlertModal isn't wrapped in
    // its own portal, so userEvent's pointer-events/visibility checks reject a real click here —
    // fireEvent bypasses those checks, which is fine since we're not testing Radix itself.
    fireEvent.click(
      screen.getByRole("button", { name: /confirm delete/i, hidden: true })
    )

    await waitFor(() => expect(mockDeleteNote).toHaveBeenCalledWith("note-1"))
  })

  // Same discarded-isLoading double-submission bug fixed for
  // RiskRegisterPage/aexa-frontend#620 -- useDeleteNoteByIdMutation's
  // isLoading was previously discarded, so the Delete confirmation button
  // never disabled while a request was already in flight.
  it("disables the delete confirmation button while a delete is already in flight", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { id: "note-1", extracted_text: "Some text" } },
      refetch: mockRefetch,
    })
    mockIsNoteDeleting = true

    renderModal()
    await userEvent.click(
      screen.getByRole("button", { name: "organization.inspection.deleteNote" })
    )

    expect(
      screen.getByRole("button", { name: /confirm delete/i, hidden: true })
    ).toBeDisabled()
  })

  it("shows an error toast when uploading raw text fails", async () => {
    mockUploadRawNote.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Server unavailable" } }),
    })

    renderModal()
    await userEvent.click(
      screen.getByText("organization.inspection.notesByText")
    )
    await userEvent.type(
      screen.getByLabelText("organization.inspection.writeDetailedNote"),
      "Some note"
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.uploadNotes",
      })
    )

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
    const textarea = screen.getByLabelText(
      "organization.inspection.noteContent"
    )
    await userEvent.type(textarea, "!")
    await userEvent.click(
      screen.getByRole("button", { name: "organization.inspection.updateNote" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.inspection.noteUpdateFailedToast"
      )
    )
  })

  it("shows an error toast (with fallback message) when deleting a note fails", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { id: "note-1", extracted_text: "Some text" } },
      refetch: mockRefetch,
    })
    mockDeleteNote.mockReturnValue({ unwrap: () => Promise.reject({}) })

    renderModal()
    await userEvent.click(
      screen.getByRole("button", { name: "organization.inspection.deleteNote" })
    )
    fireEvent.click(
      screen.getByRole("button", { name: /confirm delete/i, hidden: true })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "organization.inspection.noteDeleteFailedToast"
      )
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
    await userEvent.click(
      screen.getByRole("button", { name: "organization.inspection.splitNote" })
    )

    await waitFor(() =>
      expect(mockSplitInspectionNote).toHaveBeenCalledWith("insp-77")
    )
  })

  it("shows an error toast, keeps the dialog open, and re-enables the button when splitting a note rejects (unhandled rejection)", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { id: "note-1", extracted_text: "Some text" } },
      refetch: mockRefetch,
    })
    mockSplitInspectionNote.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Note is too short to split" } }),
    })

    renderModal({ inspectionId: "insp-77" })
    await userEvent.click(
      screen.getByRole("button", { name: "organization.inspection.splitNote" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Note is too short to split")
    )
    // Dialog should stay open (Update Note heading still present) and the
    // split button should be usable again, not stuck disabled/"Splitting..."
    expect(
      screen.getByRole("heading", {
        name: "organization.inspection.updateNote",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "organization.inspection.splitNote" })
    ).not.toBeDisabled()
  })
})
