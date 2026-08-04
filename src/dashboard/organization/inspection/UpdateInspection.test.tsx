import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
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
  beforeEach(async () => {
    mockNavigate.mockReset()
    mockUseGetSingleInspectionQuery.mockReset()
    mockUpdateInspection.mockReset()
    mockUpdateQuestionAnswer.mockReset()
    mockUploadFileAws.mockReset()
    const { toast } = await import("sonner")
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  it("shows a loading message while the inspection is loading", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<UpdateInspection />)

    // i18n isn't initialized in the test environment, so t() echoes the raw
    // key back (see RiskRegisterPage.test.tsx for the same convention).
    expect(
      screen.getByText("organization.inspection.loadingInspection")
    ).toBeInTheDocument()
  })

  it('shows "Inspection not found" when there is no inspection', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    render(<UpdateInspection />)

    expect(
      screen.getByText("organization.inspection.notFound")
    ).toBeInTheDocument()
  })

  it("renders template name, site, existing answers and status", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />)

    // editTitle interpolates {{name}}, but the uninitialized test t() echoes
    // just the key without interpolation.
    expect(
      screen.getByText("organization.inspection.editTitle")
    ).toBeInTheDocument()
    expect(screen.getByText("HQ Casablanca")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Fine")).toBeInTheDocument()
    expect(screen.getAllByRole("checkbox")[0]).toBeChecked()
    // Bug-fix batch: the status dropdown trigger used to render the raw
    // enum value ("IN_PROGRESS") instead of the humanized translation key
    // shared with the dropdown menu items right below it.
    expect(
      screen.getByText("organization.inspection.statusInProgress")
    ).toBeInTheDocument()
    expect(screen.queryByText("IN_PROGRESS")).not.toBeInTheDocument()
  })

  // Regression (round 3 audit): a template with zero pages left both the
  // sticky page-nav list and the main content area completely blank, with
  // no explanation -- e.g. the "AI-Generated Findings (system, do not
  // edit)" inspection, whose template has no questions defined.
  it("shows an empty-state message instead of a blank page when the template has no pages", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: { templateName: "Empty Template", pages: [] },
        }),
      },
      isLoading: false,
    })

    render(<UpdateInspection />)

    expect(
      screen.getAllByText("organization.inspection.noPagesTitle").length
    ).toBeGreaterThan(0)
    expect(
      screen.getByText("organization.inspection.noPagesDescription")
    ).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  // Regression (aexa-frontend round-9 audit #463): the page h1 was followed
  // directly by an h3 (Attachments, then "no pages" empty state) with no h2
  // in between in the zero-pages render path specifically, since the only
  // h2 on the page lived inside the pages.map() loop. Attachments is now h2
  // so an h2 always exists right after the h1, regardless of render path.
  it("keeps a valid heading hierarchy (h1 -> h2, no orphan h3) when the template has no pages", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: { templateName: "Empty Template", pages: [] },
        }),
      },
      isLoading: false,
    })

    render(<UpdateInspection />)

    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1)
    expect(
      screen.getAllByRole("heading", { level: 2 }).length
    ).toBeGreaterThan(0)
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
      screen.getByRole("button", {
        name: "organization.inspection.uploadNote",
      })
    ).toBeInTheDocument()

    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection({ note: { id: "note-1" } }) },
      isLoading: false,
    })
    rerender(<UpdateInspection />)
    expect(
      screen.getByRole("button", {
        name: "organization.inspection.viewNote",
      })
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
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.inspection\.statusInProgress/i,
      })
    )
    await userEvent.click(
      await screen.findByText("organization.inspection.statusCompleted")
    )

    await waitFor(() =>
      expect(mockUpdateInspection).toHaveBeenCalledWith({
        id: "insp-1",
        data: { status: "COMPLETED" },
      })
    )
  })

  // Regression (aexa-frontend round-9 audit #463): the status dropdown's
  // "In Progress" menu item used a separate, never-translated
  // "statusMenuInProgress" key that always rendered raw English "IN
  // PROGRESS" text even under a French UI, unlike the sibling
  // "statusInProgress" key used by the trigger button right above it. The
  // menu item now shares that same translated key.
  it("shows the shared translated key (not a raw hardcoded string) for the dropdown's In Progress item", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.inspection\.statusInProgress/i,
      })
    )

    expect(
      screen.getAllByText("organization.inspection.statusInProgress").length
    ).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText("IN PROGRESS")).not.toBeInTheDocument()
    expect(
      screen.queryByText("organization.inspection.statusMenuInProgress")
    ).not.toBeInTheDocument()
  })

  it('opens the finding modal when "Add Finding" is clicked', async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />)
    await userEvent.click(
      screen.getAllByRole("button", {
        name: "organization.inspection.addFinding",
      })[0]
    )

    expect(screen.getByText("Finding modal open")).toBeInTheDocument()
  })

  it('opens the upload-notes modal when "Upload Note" is clicked', async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.uploadNote",
      })
    )

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
      expect(toast.success).toHaveBeenCalledWith(
        "organization.inspection.attachmentUploadedToast"
      )
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
      await userEvent.click(screen.getAllByTitle("organization.inspection.remove")[1])

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
      const removeButtons = screen.getAllByTitle("organization.inspection.remove")
      await userEvent.click(removeButtons[0])

      expect(screen.getAllByTitle("organization.inspection.remove")[1]).toBeDisabled()
      await userEvent.click(screen.getAllByTitle("organization.inspection.remove")[1])
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

    it("shows a partial-success message (not the generic upload-failed toast) when the file uploads but persisting it to the inspection then fails (#123)", async () => {
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
        unwrap: () => Promise.reject({ data: {} }),
      })

      render(<UpdateInspection />)
      const file = new File(["x"], "new.pdf", { type: "application/pdf" })
      const inputs = document.querySelectorAll('input[type="file"]')
      await userEvent.upload(inputs[0] as HTMLInputElement, file)

      const { toast } = await import("sonner")
      await waitFor(() => expect(mockUpdateInspection).toHaveBeenCalled())
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "organization.inspection.attachmentAttachFailedToast"
        )
      )
      // The file itself genuinely uploaded -- the generic "Failed to upload
      // attachment" full-failure message must not fire, and neither must the
      // success toast (only attaching the URL to the inspection failed).
      expect(toast.error).not.toHaveBeenCalledWith(
        "organization.inspection.attachmentUploadFailedToast"
      )
      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  // aexa-frontend#484 -- the per-question media-file "remove" control was a
  // <span onClick={...}>, not a real button: no role="button", no tabIndex,
  // no Enter/Space keyboard handler, so it was not reachable or operable
  // via keyboard. Converted to a real <button type="button">.
  describe("per-question media file removal (#484)", () => {
    it("renders the remove control as a real, keyboard-operable button", async () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            questionAnswers: [
              {
                id: "qa-1",
                questionId: "q-1",
                answer: true,
                note: "",
                mediaFiles: [{ url: "https://cdn.example.com/photo.jpg" }],
              },
              {
                id: "qa-2",
                questionId: "q-2",
                answer: "Fine",
                note: "",
                mediaFiles: [],
              },
            ],
          }),
        },
        isLoading: false,
      })

      render(<UpdateInspection />)

      const removeButton = screen.getByRole("button", {
        name: "organization.inspection.remove",
      })
      expect(removeButton.tagName).toBe("BUTTON")
      expect(removeButton).toHaveAttribute("type", "button")

      await userEvent.click(removeButton)
      expect(
        screen.queryByRole("button", {
          name: "organization.inspection.remove",
        })
      ).not.toBeInTheDocument()
    })
  })

  // Round 14 (#515): the "additional media files" secondary upload path
  // (handleExternalMediaUpload + its thumbnail list) is distinct from the
  // primary per-question "media" answer renderer fixed in round 13 (#507)
  // above -- it still hardcoded { type: "image" } for every upload and
  // always rendered <img>, regardless of the file's real MIME type.
  describe("additional media files: secondary upload path branches on file type (#515)", () => {
    it("stores the real MIME-derived type instead of hardcoding image for a video upload", async () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: makeInspection() },
        isLoading: false,
      })
      mockUploadFileAws.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            success: true,
            data: "https://cdn.example.com/clip.mp4",
          }),
      })
      mockUpdateQuestionAnswer.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })

      render(<UpdateInspection />)
      const file = new File(["x"], "clip.mp4", { type: "video/mp4" })
      const input = document.getElementById(
        "update-external-media-q-1"
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      // qa-1 already has a persisted questionAnswerId, so the upload
      // triggers the debounced auto-save with the newly stored mediaFiles.
      await waitFor(
        () =>
          expect(mockUpdateQuestionAnswer).toHaveBeenCalledWith(
            expect.objectContaining({
              id: "qa-1",
              data: expect.objectContaining({
                mediaFiles: [
                  { url: "https://cdn.example.com/clip.mp4", type: "video" },
                ],
              }),
            })
          ),
        { timeout: 2000 }
      )
    })

    it("renders an existing video media file as <video controls>, not a broken <img>", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            questionAnswers: [
              {
                id: "qa-1",
                questionId: "q-1",
                answer: true,
                note: "",
                mediaFiles: [
                  { url: "https://cdn.example.com/clip.mp4", type: "video" },
                ],
              },
              {
                id: "qa-2",
                questionId: "q-2",
                answer: "Fine",
                note: "",
                mediaFiles: [],
              },
            ],
          }),
        },
        isLoading: false,
      })

      render(<UpdateInspection />)

      const video = document.querySelector("video")
      expect(video).toBeInTheDocument()
      expect(video).toHaveAttribute("controls")
    })

    it("renders an existing PDF media file as a link, not a broken <img>", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            questionAnswers: [
              {
                id: "qa-1",
                questionId: "q-1",
                answer: true,
                note: "",
                mediaFiles: [
                  {
                    url: "https://cdn.example.com/report.pdf",
                    type: "document",
                  },
                ],
              },
              {
                id: "qa-2",
                questionId: "q-2",
                answer: "Fine",
                note: "",
                mediaFiles: [],
              },
            ],
          }),
        },
        isLoading: false,
      })

      render(<UpdateInspection />)

      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "https://cdn.example.com/report.pdf")
      expect(link).toHaveAttribute("target", "_blank")
    })
  })

  // Round 13 (#507): the "media" answer-type renderer unconditionally
  // rendered an <img>, even though the upload input accepts
  // "image/*,video/*,application/pdf" -- a video or PDF upload silently
  // fell through to the broken-image placeholder with no way to view it.
  describe("media answer renderer branches on file type (#507)", () => {
    function makeMediaInspection(mediaUrl: string) {
      return makeInspection({
        template: {
          templateName: "Fire Safety Audit",
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-media",
                  question: "Upload evidence",
                  answerType: "media",
                  isRequired: false,
                },
              ],
            },
          ],
        },
        questionAnswers: [
          {
            id: "qa-media",
            questionId: "q-media",
            answer: mediaUrl,
            note: "",
            mediaFiles: [],
          },
        ],
      })
    }

    it("renders a video answer with a real <video controls> element, not a broken <img>", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: makeMediaInspection("https://cdn.example.com/clip.mp4") },
        isLoading: false,
      })

      render(<UpdateInspection />)

      const video = document.querySelector("video")
      expect(video).toBeInTheDocument()
      expect(video).toHaveAttribute("controls")
      expect(
        screen.queryByAltText("organization.inspection.uploadedMediaAlt")
      ).not.toBeInTheDocument()
    })

    it("renders a PDF answer as a link to open it, not a broken <img>", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeMediaInspection("https://cdn.example.com/report.pdf"),
        },
        isLoading: false,
      })

      render(<UpdateInspection />)

      const link = screen.getByRole("link", { name: /report\.pdf/ })
      expect(link).toHaveAttribute("href", "https://cdn.example.com/report.pdf")
      expect(link).toHaveAttribute("target", "_blank")
      expect(document.querySelector("img")).not.toBeInTheDocument()
    })

    it("still renders an image answer as an <img>", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeMediaInspection("https://cdn.example.com/photo.jpg"),
        },
        isLoading: false,
      })

      render(<UpdateInspection />)

      expect(
        screen.getByAltText("organization.inspection.uploadedMediaAlt")
      ).toBeInTheDocument()
    })
  })

  // Round 13 (#507): the per-question evidence-photo thumbnail had
  // alt="" (decorative), even though it's real user-uploaded evidence
  // content -- inconsistent with this same file's "media" question img,
  // which correctly uses a translated alt text key.
  describe("evidence-photo thumbnail alt text (#507)", () => {
    it("gives the evidence-photo thumbnail real alt text, not alt=\"\"", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            questionAnswers: [
              {
                id: "qa-1",
                questionId: "q-1",
                answer: true,
                note: "",
                mediaFiles: [{ url: "https://cdn.example.com/photo.jpg" }],
              },
              {
                id: "qa-2",
                questionId: "q-2",
                answer: "Fine",
                note: "",
                mediaFiles: [],
              },
            ],
          }),
        },
        isLoading: false,
      })

      render(<UpdateInspection />)

      const thumbnail = screen.getByAltText(
        "organization.inspection.uploadedMediaAlt"
      )
      expect(thumbnail).toHaveAttribute("src", "https://cdn.example.com/photo.jpg")
    })
  })

  // Round 14 (#515): the sticky pages sidebar had no <nav aria-label> and
  // its buttons had no aria-current, unlike SectionNavigator.tsx (which was
  // originally extracted from this exact pattern but never backported the
  // improvement here).
  describe("pages sidebar navigation accessibility (#515)", () => {
    it("wraps the pages list in a labeled <nav> and marks the active page with aria-current", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: makeInspection() },
        isLoading: false,
      })

      render(<UpdateInspection />)

      const nav = screen.getByRole("navigation", {
        name: "organization.inspection.pages",
      })
      const activeButton = within(nav)
        .getByText("General")
        .closest("button")!
      expect(activeButton).toHaveAttribute("aria-current", "true")
    })
  })
})
