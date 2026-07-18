import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import InspectionNote from "./InspectionNote"

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
      expect(screen.getByText(/Drop a file here/i)).toBeInTheDocument()
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
    expect(screen.queryByText(/Drop a file here/i)).not.toBeInTheDocument()
  })

  it("falls back to a generic message for a non-404 error with no server message", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Failed to load note")).toBeInTheDocument()
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
      screen.queryByRole("link", { name: /back to inspection/i })
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
      expect(screen.getByText("Back to inspection")).toBeInTheDocument()
    )
  })

  it("shows an error when an invalid file type is selected", async () => {
    mockUseGetNoteByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    })
    renderPage()
    await waitFor(() => screen.getByText(/Drop a file here/i))

    // userEvent.upload skips display:none inputs — use fireEvent directly
    const file = new File(["content"], "notes.txt", { type: "text/plain" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(
        screen.getByText(/Only PDF, JPG, PNG, or WEBP/i)
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
    await waitFor(() => screen.getByText(/Drop a file here/i))

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
    await waitFor(() => screen.getByText(/Drop a file here/i))

    const file = new File(["%PDF"], "notes.pdf", { type: "application/pdf" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await userEvent.upload(input, file)

    await userEvent.click(screen.getByText(/Upload & extract/i))

    await waitFor(() =>
      expect(screen.getByText(/Notes uploaded/i)).toBeInTheDocument()
    )
    expect(screen.getByText("Zone B extinguisher expired.")).toBeInTheDocument()
    expect(screen.getByText("Review answers →")).toBeInTheDocument()
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
    await waitFor(() => screen.getByText(/Drop a file here/i))

    const file = new File(["%PDF"], "notes.pdf", { type: "application/pdf" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText(/Upload & extract/i))

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
    await waitFor(() => screen.getByText(/Drop a file here/i))

    const file = new File(["%PDF"], "notes.pdf", { type: "application/pdf" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText(/Upload & extract/i))

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
    await waitFor(() => screen.getByText(/Drop a file here/i))

    const file = new File(["%PDF"], "notes.pdf", { type: "application/pdf" })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText(/Upload & extract/i))

    await waitFor(() =>
      expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    )
  })
})
