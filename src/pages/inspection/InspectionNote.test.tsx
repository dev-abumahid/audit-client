import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import InspectionNote from "./InspectionNote"

// Controllable `i18n.language` for the locale-formatting test below, while
// every other test keeps relying on the real (uninitialized) react-i18next
// t(), which just echoes the raw key back -- same technique as
// InspectionReport.test.tsx.
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

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return {
    ...mod,
    useParams: () => ({ id: "insp-1" }),
    useNavigate: () => mockNavigate,
  }
})

const mockUseGetNoteByInspectionIdQuery = vi.fn()
const mockExtractNoteFromFile = vi.fn()
const mockSplitInspectionNote = vi.fn()

vi.mock("@/redux/apis/organization/note.api", () => ({
  useGetNoteByInspectionIdQuery: (...args: unknown[]) =>
    mockUseGetNoteByInspectionIdQuery(...args),
  useExtractNoteFromFileMutation: () => [mockExtractNoteFromFile],
}))

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useSplitInspectionNoteMutation: () => [mockSplitInspectionNote],
}))

const existingNote = {
  id: "note-1",
  title: "Site inspection notes",
  extracted_text: "The fire extinguisher in zone B was found to be expired.",
  inspectionId: "insp-1",
  createdAt: "2026-06-21T10:00:00.000Z",
}

function renderPage() {
  return render(
    <MemoryRouter>
      <InspectionNote />
    </MemoryRouter>
  )
}

describe("InspectionNote", () => {
  beforeEach(() => {
    mockLanguage = undefined
    mockUseGetNoteByInspectionIdQuery.mockReset()
    mockExtractNoteFromFile.mockReset()
    mockSplitInspectionNote.mockReset()
    mockNavigate.mockReset()
    mockExtractNoteFromFile.mockReturnValue({
      unwrap: () => Promise.resolve({ data: {} }),
    })
    mockSplitInspectionNote.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
  })

  it("shows a loading spinner while checking for an existing note", () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows upload form when no note exists (404 mapped to no note)", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/pages\.inspection\.note\.dropFilePrefix/)).toBeInTheDocument()
    )
  })

  it("shows a real error state (not the upload form) on a non-404 error", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500, data: { message: "Note service unavailable" } },
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Note service unavailable")).toBeInTheDocument()
    )
    expect(screen.queryByText(/pages\.inspection\.note\.dropFilePrefix/)).not.toBeInTheDocument()
  })

  it("falls back to a generic message for a non-404 error with no server message", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("pages.inspection.note.loadFailed")).toBeInTheDocument()
    )
  })

  it("shows existing note content when a note already exists", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: existingNote },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Site inspection notes")).toBeInTheDocument()
    )
    expect(screen.getByText(/fire extinguisher in zone B/i)).toBeInTheDocument()
  })

  // aexa-frontend#378: the existing-note timestamp used a bare
  // toLocaleDateString() with no locale, always showing English month names
  // under a French UI.
  it("formats the existing note's date using the shared locale-aware helper", async () => {
    mockLanguage = "fr-FR"
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: existingNote },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Site inspection notes")).toBeInTheDocument()
    )

    const expectedFr = new Date(existingNote.createdAt).toLocaleDateString(
      "fr-FR"
    )
    expect(screen.getByText(expectedFr)).toBeInTheDocument()
  })

  it("shows a download link for an existing note's attachment", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: {
        data: {
          ...existingNote,
          attachments: ["https://cdn.example.com/original-scan.pdf"],
        },
      },
      isLoading: false,
      isError: false,
    })
    renderPage()

    const link = await screen.findByRole("link", {
      name: /original-scan\.pdf/i,
    })
    expect(link).toHaveAttribute(
      "href",
      "https://cdn.example.com/original-scan.pdf"
    )
  })

  it("shows no attachment link when the note has none", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: { ...existingNote, attachments: [] } },
      isLoading: false,
      isError: false,
    })
    renderPage()

    await waitFor(() =>
      expect(screen.getByText("Site inspection notes")).toBeInTheDocument()
    )
    // Navigation/back links are still present; only attachment links are absent
    expect(
      screen.queryByRole("link", { name: "pages.inspection.note.backToInspection" })
    ).toBeInTheDocument()
    expect(document.querySelector('a[target="_blank"]')).not.toBeInTheDocument()
  })

  it('shows "Back to inspection" link when a note exists', async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: { data: existingNote },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("pages.inspection.note.backToInspection")).toBeInTheDocument()
    )
  })

  it("shows an error when an invalid file type is selected", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    })
    renderPage()
    await waitFor(() => screen.getByText(/pages\.inspection\.note\.dropFilePrefix/))

    // userEvent.upload skips display:none inputs — use fireEvent directly
    const file = new File(["content"], "notes.txt", { type: "text/plain" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(
        screen.getByText(/pages\.inspection\.note\.fileTypeError/)
      ).toBeInTheDocument()
    )
  })

  it("shows the selected filename as a chip", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    })
    renderPage()
    await waitFor(() => screen.getByText(/pages\.inspection\.note\.dropFilePrefix/))

    const file = new File(["%PDF"], "report.pdf", { type: "application/pdf" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByText("report.pdf")).toBeInTheDocument()
  })

  it("shows extracted text and navigates after a successful upload + AI extraction", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    })
    mockExtractNoteFromFile.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            id: "note-new",
            title: "Extracted",
            extracted_text: "Zone B extinguisher expired.",
            inspectionId: "insp-1",
            createdAt: "2026-06-22T10:00:00.000Z",
          },
        }),
    })
    mockSplitInspectionNote.mockReturnValue({
      unwrap: () => Promise.resolve({ data: "success fully splitted" }),
    })

    renderPage()
    await waitFor(() => screen.getByText(/pages\.inspection\.note\.dropFilePrefix/))

    const file = new File(["%PDF"], "notes.pdf", { type: "application/pdf" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await userEvent.upload(input, file)

    await userEvent.click(screen.getByText("pages.inspection.note.uploadExtract"))

    await waitFor(() =>
      expect(screen.getByText(/pages\.inspection\.note\.doneTitle/)).toBeInTheDocument()
    )
    expect(screen.getByText("Zone B extinguisher expired.")).toBeInTheDocument()
    expect(screen.getByText(/pages\.inspection\.note\.reviewAnswers/)).toBeInTheDocument()
  })

  it("shows a download link for the source file right after upload + extraction", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    })
    mockExtractNoteFromFile.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            id: "note-new",
            title: "Extracted",
            extracted_text: "Zone B extinguisher expired.",
            inspectionId: "insp-1",
            createdAt: "2026-06-22T10:00:00.000Z",
            attachments: ["https://cdn.example.com/notes.pdf"],
          },
        }),
    })
    mockSplitInspectionNote.mockReturnValue({
      unwrap: () => Promise.resolve({ data: "success fully splitted" }),
    })

    renderPage()
    await waitFor(() => screen.getByText(/pages\.inspection\.note\.dropFilePrefix/))

    const file = new File(["%PDF"], "notes.pdf", { type: "application/pdf" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText("pages.inspection.note.uploadExtract"))

    const link = await screen.findByRole("link", { name: /notes\.pdf/i })
    expect(link).toHaveAttribute("href", "https://cdn.example.com/notes.pdf")
  })

  it("shows the server-provided error message when the upload mutation fails", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    })
    mockExtractNoteFromFile.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Upload failed (500)" } }),
    })

    renderPage()
    await waitFor(() => screen.getByText(/pages\.inspection\.note\.dropFilePrefix/))

    const file = new File(["%PDF"], "notes.pdf", { type: "application/pdf" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText("pages.inspection.note.uploadExtract"))

    await waitFor(() =>
      expect(screen.getByText("Upload failed (500)")).toBeInTheDocument()
    )
  })

  it("falls back to a generic error message when the rejection has no data.message", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    })
    mockExtractNoteFromFile.mockReturnValue({
      unwrap: () => Promise.reject({}),
    })

    renderPage()
    await waitFor(() => screen.getByText(/pages\.inspection\.note\.dropFilePrefix/))

    const file = new File(["%PDF"], "notes.pdf", { type: "application/pdf" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText("pages.inspection.note.uploadExtract"))

    await waitFor(() =>
      expect(screen.getByText("pages.inspection.note.genericError")).toBeInTheDocument()
    )
  })
})
