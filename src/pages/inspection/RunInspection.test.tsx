import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import RunInspection from "./RunInspection"

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return {
    ...mod,
    useParams: () => ({ id: "insp-1" }),
    useNavigate: () => mockNavigate,
  }
})

const mockUseGetSingleInspectionQuery = vi.fn()
const mockUpdateInspectionQuestionAnswer = vi.fn()
const mockUpdateInspection = vi.fn()

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useGetSingleInspectionQuery: (...args: unknown[]) =>
    mockUseGetSingleInspectionQuery(...args),
  useUpdateInspectionQuestionAnswerMutation: () => [
    mockUpdateInspectionQuestionAnswer,
  ],
  useUpdateInspectionMutation: () => [mockUpdateInspection],
}))

const mockUseGetAllFindingsQuery = vi.fn()
vi.mock("@/redux/apis/organization/findings.api", () => ({
  useGetAllFindingsQuery: (...args: unknown[]) =>
    mockUseGetAllFindingsQuery(...args),
}))

const mockInspection = {
  id: "insp-1",
  status: "IN_PROGRESS",
  createdAt: "2026-06-21T00:00:00.000Z",
  updatedAt: "2026-06-21T00:00:00.000Z",
  unSplitText: null,
  note: null,
  site: { id: "s-1", name: "HQ Casablanca" },
  template: {
    id: "t-1",
    templateName: "Fire Safety Audit",
    pages: [
      {
        id: "pg-1",
        pageIndex: 1,
        title: "General info",
        questions: [
          {
            id: "q-1",
            index: 0,
            question: "Location?",
            isRequired: true,
            answerType: "TEXT",
            value: null,
          },
          {
            id: "q-2",
            index: 1,
            question: "Date?",
            isRequired: false,
            answerType: "DATE",
            value: null,
          },
        ],
      },
      {
        id: "pg-2",
        pageIndex: 2,
        title: "Fire systems",
        questions: [
          {
            id: "q-3",
            index: 0,
            question: "Extinguisher ok?",
            isRequired: true,
            answerType: "CHECKBOX",
            value: ["Yes", "No"],
          },
        ],
      },
    ],
  },
  questionAnswers: [
    {
      id: "qa-1",
      questionId: "q-1",
      answer: "",
      note: null,
      mediaFiles: null,
      question: {
        id: "q-1",
        question: "Location?",
        answerType: "TEXT",
        value: null,
      },
    },
    {
      id: "qa-2",
      questionId: "q-2",
      answer: "",
      note: null,
      mediaFiles: null,
      question: {
        id: "q-2",
        question: "Date?",
        answerType: "DATE",
        value: null,
      },
    },
    {
      id: "qa-3",
      questionId: "q-3",
      answer: [],
      note: null,
      mediaFiles: null,
      question: {
        id: "q-3",
        question: "Extinguisher ok?",
        answerType: "CHECKBOX",
        value: ["Yes", "No"],
      },
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RunInspection />
    </MemoryRouter>
  )
}

describe("RunInspection", () => {
  beforeEach(() => {
    mockUseGetSingleInspectionQuery.mockReset()
    mockUpdateInspectionQuestionAnswer.mockReset()
    mockUpdateInspection.mockReset()
    mockUseGetAllFindingsQuery.mockReset()
    mockNavigate.mockReset()
    mockUpdateInspectionQuestionAnswer.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    mockUpdateInspection.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 100, total: 0, totalPage: 0 } },
    })
  })

  it("shows a loading spinner initially", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows an error when the fetch fails", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Failed to load inspection")).toBeInTheDocument()
    )
  })

  it("renders the template name in the breadcrumb", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    )
  })

  it("renders all page titles in the sidebar", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    // "General info" appears in both sidebar nav and as the current page heading
    await waitFor(() =>
      expect(screen.getAllByText("General info").length).toBeGreaterThan(0)
    )
    expect(screen.getByText("Fire systems")).toBeInTheDocument()
  })

  it("renders questions for the current page", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Location?")).toBeInTheDocument()
    )
    expect(screen.getByText("Date?")).toBeInTheDocument()
    // Second page questions should not be visible yet
    expect(screen.queryByText("Extinguisher ok?")).not.toBeInTheDocument()
  })

  it("navigates to the next page when Next is clicked", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Next"))
    await userEvent.click(screen.getByText("Next"))
    await waitFor(() =>
      expect(screen.getByText("Extinguisher ok?")).toBeInTheDocument()
    )
    expect(screen.queryByText("Location?")).not.toBeInTheDocument()
  })

  it("Previous button is disabled on the first page", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Previous"))
    expect(screen.getByText("Previous").closest("button")).toBeDisabled()
  })

  it("marks inspection complete and navigates to list", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Mark complete"))
    await userEvent.click(screen.getByText("Mark complete"))
    await waitFor(() =>
      expect(mockUpdateInspection).toHaveBeenCalledWith({
        id: "insp-1",
        data: { status: "COMPLETED" },
      })
    )
    expect(mockNavigate).toHaveBeenCalledWith("/organization/audit/inspections")
  })

  it('shows "Upload notes" link when inspection has no note', async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Upload notes")).toBeInTheDocument()
    )
  })

  it('shows "View notes" link when inspection has an existing note', async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: { ...mockInspection, note: { id: "note-1" } } },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("View notes")).toBeInTheDocument()
    )
  })

  it("renders questions as read-only when inspection is COMPLETED", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: { ...mockInspection, status: "COMPLETED" } },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Location?"))
    const inputs = screen.getAllByRole("textbox")
    inputs.forEach((input) => expect(input).toBeDisabled())
  })

  it("shows the finding count badge from the (server-filtered) findings query", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        data: [
          { id: "a1", inspectionId: "insp-1" },
          { id: "a2", inspectionId: "insp-1" },
        ],
        meta: { page: 1, limit: 100, total: 2, totalPage: 1 },
      },
    })
    renderPage()
    await waitFor(() => screen.getByText("Location?"))
    expect(screen.getAllByText("2").length).toBeGreaterThan(0)
    expect(mockUseGetAllFindingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ inspectionId: "insp-1" }),
      expect.anything()
    )
  })

  it("renders a relative mediaFile URL with the BASE_URL prefix", async () => {
    const inspectionWithMedia = {
      ...mockInspection,
      questionAnswers: [
        {
          id: "qa-1",
          questionId: "q-1",
          answer: "Paris",
          note: null,
          mediaFiles: [{ url: "/uploads/photo.jpg" }],
          question: {
            id: "q-1",
            question: "Location?",
            answerType: "TEXT",
            value: null,
          },
        },
        {
          id: "qa-2",
          questionId: "q-2",
          answer: "",
          note: null,
          mediaFiles: null,
          question: {
            id: "q-2",
            question: "Date?",
            answerType: "DATE",
            value: null,
          },
        },
        {
          id: "qa-3",
          questionId: "q-3",
          answer: [],
          note: null,
          mediaFiles: null,
          question: {
            id: "q-3",
            question: "Extinguisher ok?",
            answerType: "CHECKBOX",
            value: ["Yes", "No"],
          },
        },
      ],
    }
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: inspectionWithMedia },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Location?"))
    const img = document.querySelector(
      'img[alt="Attachment 1"]'
    ) as HTMLImageElement
    expect(img).toBeInTheDocument()
    // VITE_API_BASE_URL is not set in the test environment so it falls back to ''
    // meaning relative paths are kept as-is (no double slash)
    expect(img.src).toContain("/uploads/photo.jpg")
  })

  it("does not lose an already-answered question's completion status on a same-inspection background refetch", async () => {
    // Single-question page so the sidebar "done" checkmark reflects q-1's
    // status directly.
    const raceInspection = {
      ...mockInspection,
      template: {
        ...mockInspection.template,
        pages: [
          {
            id: "pg-1",
            pageIndex: 1,
            title: "General info",
            questions: [
              {
                id: "q-1",
                index: 0,
                question: "Location?",
                isRequired: true,
                answerType: "TEXT",
                value: null,
              },
            ],
          },
        ],
      },
      questionAnswers: [
        {
          id: "qa-1",
          questionId: "q-1",
          answer: "Paris",
          note: null,
          mediaFiles: null,
          question: {
            id: "q-1",
            question: "Location?",
            answerType: "TEXT",
            value: null,
          },
        },
      ],
    }

    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: raceInspection },
      isLoading: false,
      isError: false,
    })
    const { rerender } = renderPage()
    await waitFor(() => screen.getByText("Location?"))
    // Page is fully answered — sidebar shows a checkmark, not "1".
    expect(screen.getByText("✓")).toBeInTheDocument()

    // Simulate a background refetch of the *same* inspection (RTK Query
    // hands back a brand-new object reference on every refetch, even for
    // unchanged data) that races ahead of the just-answered question's own
    // row — e.g. read-replica lag right after the autosave that triggered
    // this refetch. Same inspection id, but questionAnswers is temporarily
    // missing q-1's row.
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: { ...raceInspection, questionAnswers: [] } },
      isLoading: false,
      isError: false,
    })
    rerender(
      <MemoryRouter>
        <RunInspection />
      </MemoryRouter>
    )

    // Because the reseed is keyed on inspection id (not object reference),
    // the local answer cache from the first render is retained and still
    // reports q-1 as answered, so the checkmark should NOT revert to "1".
    await waitFor(() => expect(screen.getByText("✓")).toBeInTheDocument())
    expect(screen.queryByText("1")).not.toBeInTheDocument()
  })

  it("renders an absolute mediaFile URL unchanged", async () => {
    const inspectionWithMedia = {
      ...mockInspection,
      questionAnswers: [
        {
          id: "qa-1",
          questionId: "q-1",
          answer: "Paris",
          note: null,
          mediaFiles: ["https://cdn.example.com/photo.png"],
          question: {
            id: "q-1",
            question: "Location?",
            answerType: "TEXT",
            value: null,
          },
        },
        {
          id: "qa-2",
          questionId: "q-2",
          answer: "",
          note: null,
          mediaFiles: null,
          question: {
            id: "q-2",
            question: "Date?",
            answerType: "DATE",
            value: null,
          },
        },
        {
          id: "qa-3",
          questionId: "q-3",
          answer: [],
          note: null,
          mediaFiles: null,
          question: {
            id: "q-3",
            question: "Extinguisher ok?",
            answerType: "CHECKBOX",
            value: ["Yes", "No"],
          },
        },
      ],
    }
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: inspectionWithMedia },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Location?"))
    const img = document.querySelector(
      'img[alt="Attachment 1"]'
    ) as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toBe("https://cdn.example.com/photo.png")
  })
})
