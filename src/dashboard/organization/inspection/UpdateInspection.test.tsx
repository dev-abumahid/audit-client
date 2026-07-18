import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import UpdateInspection from "./UpdateInspection"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "insp-1" }),
  }
})

const mockUseGetSingleInspectionQuery = vi.fn()
const mockUpdateInspection = vi.fn()
const mockUpdateQuestionAnswer = vi.fn()
const mockUploadFileAws = vi.fn()

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useGetSingleInspectionQuery: (...args: unknown[]) =>
    mockUseGetSingleInspectionQuery(...args),
  useUpdateInspectionMutation: () => [mockUpdateInspection],
  useUpdateInspectionQuestionAnswerMutation: () => [mockUpdateQuestionAnswer],
}))

vi.mock("@/redux/apis/common.api", () => ({
  useUploadAnyFileAwsMutation: () => [mockUploadFileAws],
}))

vi.mock("../recommendation/ViewAndEditRecommendation", () => ({
  default: () => <div>Recommendation section</div>,
}))

vi.mock("./UnSplitText", () => ({
  default: () => <div>Unsplit text section</div>,
}))

vi.mock("../findings/CreateNewFindingModal", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div>Finding modal open</div> : null,
}))

vi.mock("./UploadNotesModal", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div>Upload notes modal open</div> : null,
}))

function makeInspection(overrides = {}) {
  return {
    id: "insp-1",
    status: "IN_PROGRESS",
    site: { id: "site-1", name: "HQ Casablanca" },
    template: {
      templateName: "Fire Safety Audit",
      pages: [
        {
          title: "General",
          questions: [
            {
              id: "q-1",
              question: "Extinguisher present?",
              answerType: "checkbox",
              isRequired: true,
            },
            {
              id: "q-2",
              question: "Notes on condition",
              answerType: "input",
              isRequired: false,
            },
          ],
        },
      ],
    },
    questionAnswers: [
      { id: "qa-1", questionId: "q-1", answer: true, note: "", mediaFiles: [] },
      {
        id: "qa-2",
        questionId: "q-2",
        answer: "Fine",
        note: "",
        mediaFiles: [],
      },
    ],
    note: null,
    attachments: [],
    ...overrides,
  }
}

describe("UpdateInspection", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockUseGetSingleInspectionQuery.mockReset()
    mockUpdateInspection.mockReset()
    mockUpdateQuestionAnswer.mockReset()
    mockUploadFileAws.mockReset()
  })

  it("shows a loading message while the inspection is loading", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<UpdateInspection />)

    expect(screen.getByText("Loading inspection data...")).toBeInTheDocument()
  })

  it('shows "Inspection not found" when there is no inspection', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    render(<UpdateInspection />)

    expect(screen.getByText("Inspection not found")).toBeInTheDocument()
  })

  it("renders template name, site, existing answers and status", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />)

    expect(screen.getByText("Edit: Fire Safety Audit")).toBeInTheDocument()
    expect(screen.getByText("HQ Casablanca")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Fine")).toBeInTheDocument()
    expect(screen.getAllByRole("checkbox")[0]).toBeChecked()
    expect(screen.getByText("IN_PROGRESS")).toBeInTheDocument()
  })

  it("renders the embedded recommendation and unsplit-text sections", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />)

    expect(screen.getByText("Recommendation section")).toBeInTheDocument()
    expect(screen.getByText("Unsplit text section")).toBeInTheDocument()
  })

  it('shows "Upload Note" when there is no note, "View Note" when one exists', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })
    const { rerender } = render(<UpdateInspection />)
    expect(
      screen.getByRole("button", { name: /upload note/i })
    ).toBeInTheDocument()

    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection({ note: { id: "note-1" } }) },
      isLoading: false,
    })
    rerender(<UpdateInspection />)
    expect(
      screen.getByRole("button", { name: /view note/i })
    ).toBeInTheDocument()
  })

  it("auto-saves an answer change via updateQuestionAnswer after the debounce delay", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })
    mockUpdateQuestionAnswer.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(<UpdateInspection />)
    const checkbox = screen.getAllByRole("checkbox")[0]
    await userEvent.click(checkbox)

    // Component debounces the save by 1000ms via setTimeout
    await waitFor(
      () =>
        expect(mockUpdateQuestionAnswer).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "qa-1",
            data: expect.objectContaining({ answer: false }),
          })
        ),
      { timeout: 2000 }
    )
  })

  it("does not auto-save a question with no existing questionAnswerId", () => {
    vi.useFakeTimers()
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({ questionAnswers: [] }), // no persisted answers yet
      },
      isLoading: false,
    })

    render(<UpdateInspection />)
    const checkbox = screen.getAllByRole("checkbox")[0]
    // fireEvent (not userEvent) avoids userEvent's internal async delays, which deadlock
    // when the whole test runs under fake timers.
    fireEvent.click(checkbox)

    vi.advanceTimersByTime(1200)
    expect(mockUpdateQuestionAnswer).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("changes inspection status via the dropdown", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })
    mockUpdateInspection.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<UpdateInspection />)
    await userEvent.click(screen.getByRole("button", { name: /in_progress/i }))
    await userEvent.click(await screen.findByText("COMPLETED"))

    await waitFor(() =>
      expect(mockUpdateInspection).toHaveBeenCalledWith({
        id: "insp-1",
        data: { status: "COMPLETED" },
      })
    )
  })

  it('opens the finding modal when "Add Finding" is clicked', async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />)
    await userEvent.click(
      screen.getAllByRole("button", { name: /add finding/i })[0]
    )

    expect(screen.getByText("Finding modal open")).toBeInTheDocument()
  })

  it('opens the upload-notes modal when "Upload Note" is clicked', async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />)
    await userEvent.click(screen.getByRole("button", { name: /upload note/i }))

    expect(screen.getByText("Upload notes modal open")).toBeInTheDocument()
  })

  describe("inspection-level attachments", () => {
    it("renders existing attachments as links", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            attachments: ["https://cdn.example.com/report.pdf"],
          }),
        },
        isLoading: false,
      })

      render(<UpdateInspection />)

      expect(screen.getByText("report.pdf")).toBeInTheDocument()
    })

    it("uploads a file, persists the URL onto the inspection, and shows a success toast", async () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: makeInspection() },
        isLoading: false,
      })
      mockUploadFileAws.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            success: true,
            data: "https://cdn.example.com/new.pdf",
          }),
      })
      mockUpdateInspection.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })

      render(<UpdateInspection />)
      const file = new File(["x"], "new.pdf", { type: "application/pdf" })
      const inputs = document.querySelectorAll('input[type="file"]')
      // First file input on the page is the attachments uploader (header section).
      await userEvent.upload(inputs[0] as HTMLInputElement, file)

      await waitFor(() =>
        expect(mockUpdateInspection).toHaveBeenCalledWith({
          id: "insp-1",
          data: { attachments: ["https://cdn.example.com/new.pdf"] },
        })
      )
      const { toast } = await import("sonner")
      expect(toast.success).toHaveBeenCalledWith("Attachment uploaded")
    })

    it("appends the new URL to existing attachments rather than replacing them", async () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            attachments: ["https://cdn.example.com/existing.pdf"],
          }),
        },
        isLoading: false,
      })
      mockUploadFileAws.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            success: true,
            data: "https://cdn.example.com/new.pdf",
          }),
      })
      mockUpdateInspection.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })

      render(<UpdateInspection />)
      const file = new File(["x"], "new.pdf", { type: "application/pdf" })
      const inputs = document.querySelectorAll('input[type="file"]')
      await userEvent.upload(inputs[0] as HTMLInputElement, file)

      await waitFor(() =>
        expect(mockUpdateInspection).toHaveBeenCalledWith({
          id: "insp-1",
          data: {
            attachments: [
              "https://cdn.example.com/existing.pdf",
              "https://cdn.example.com/new.pdf",
            ],
          },
        })
      )
    })

    it("removes an attachment by filtering it out of the array", async () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            attachments: [
              "https://cdn.example.com/keep.pdf",
              "https://cdn.example.com/remove.pdf",
            ],
          }),
        },
        isLoading: false,
      })
      mockUpdateInspection.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })

      render(<UpdateInspection />)
      await userEvent.click(screen.getAllByTitle("Remove")[1])

      await waitFor(() =>
        expect(mockUpdateInspection).toHaveBeenCalledWith({
          id: "insp-1",
          data: { attachments: ["https://cdn.example.com/keep.pdf"] },
        })
      )
    })

    it("blocks a second remove while one is still in flight, preventing a lost-update race", async () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            attachments: [
              "https://cdn.example.com/a.pdf",
              "https://cdn.example.com/b.pdf",
            ],
          }),
        },
        isLoading: false,
      })
      let resolveFirstRemove: (value: unknown) => void = () => {}
      const firstRemovePromise = new Promise((resolve) => {
        resolveFirstRemove = resolve
      })
      mockUpdateInspection.mockReturnValueOnce({
        unwrap: () => firstRemovePromise,
      })

      render(<UpdateInspection />)
      const removeButtons = screen.getAllByTitle("Remove")
      await userEvent.click(removeButtons[0])

      expect(screen.getAllByTitle("Remove")[1]).toBeDisabled()
      await userEvent.click(screen.getAllByTitle("Remove")[1])
      expect(mockUpdateInspection).toHaveBeenCalledTimes(1)

      resolveFirstRemove({})
    })

    it("shows an error toast when upload fails", async () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: makeInspection() },
        isLoading: false,
      })
      mockUploadFileAws.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: "File too large" } }),
      })

      render(<UpdateInspection />)
      const file = new File(["x"], "new.pdf", { type: "application/pdf" })
      const inputs = document.querySelectorAll('input[type="file"]')
      await userEvent.upload(inputs[0] as HTMLInputElement, file)

      const { toast } = await import("sonner")
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("File too large")
      )
      expect(mockUpdateInspection).not.toHaveBeenCalled()
    })
  })
})
