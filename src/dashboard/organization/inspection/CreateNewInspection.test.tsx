import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CreateNewInspection from "./CreateNewInspection"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

// `t()` just echoes the raw key back in this uninitialized test environment
// (see RiskRegisterPage.test.tsx for the same convention), which would
// normally swallow the interpolated `question` param on the
// "requiredAnswerMissingToast" key -- special-case just that one key to
// interpolate it so the toast message is assertable, matching the pattern in
// InspectionActions.test.tsx / FindingClosureControls.test.tsx.
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return {
        ...real,
        t: (key: string, params?: Record<string, unknown>) => {
          if (
            key === "organization.inspection.requiredAnswerMissingToast" &&
            params?.question
          ) {
            return `Please answer the required question: "${params.question}"`
          }
          // Round 2 addition: interpolate `num` so the per-question "Qn"
          // badge test below can actually distinguish "Q1"/"Q2" instead of
          // both echoing the identical raw key (which would make the test
          // pass regardless of whether the underlying bug -- every
          // question on a page showing the same number -- was present).
          if (key === "organization.inspection.questionBadge" && params?.num) {
            return `Q${params.num}`
          }
          return real.t(key)
        },
      }
    },
  }
})

// jsdom has no IntersectionObserver; the component only uses it to track
// scroll position (currentPageIndex). Capture the callback so multi-page
// tests can simulate "scrolling to" a page by invoking it directly, the same
// way a real IntersectionObserver would when a page's ref enters the
// viewport.
let intersectionCallback: IntersectionObserverCallback | null = null
class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    intersectionCallback = cb
  }
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

// jsdom has no scrollIntoView; the missing-required-answer validation path
// calls scrollToPage(), which invokes it on the target page's ref.
HTMLElement.prototype.scrollIntoView = vi.fn()

const mockNavigate = vi.fn()
let mockLocationState: Record<string, unknown> = {}
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockLocationState }),
  }
})

const mockUseGetSingleTemplateQuery = vi.fn()
const mockCreateInspection = vi.fn()
const mockUploadFileAws = vi.fn()

vi.mock("@/redux/apis/organization/template.api", () => ({
  useGetSingleTemplateQuery: (...args: unknown[]) =>
    mockUseGetSingleTemplateQuery(...args),
}))

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useCreateNewInspectionMutation: () => [
    mockCreateInspection,
    { isLoading: false },
  ],
}))

vi.mock("@/redux/apis/common.api", () => ({
  useUploadAnyFileAwsMutation: () => [mockUploadFileAws],
}))

function makeTemplate(overrides = {}) {
  return {
    id: "tpl-1",
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
    ...overrides,
  }
}

describe("CreateNewInspection", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockUseGetSingleTemplateQuery.mockReset()
    mockCreateInspection.mockReset()
    mockUploadFileAws.mockReset()
    mockToastError.mockReset()
    mockLocationState = {
      templateId: "tpl-1",
      siteId: "site-1",
      siteName: "HQ Casablanca",
    }
  })

  it("shows a loading message while the template is loading", () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<CreateNewInspection />)

    // i18n isn't initialized in the test environment, so t() echoes the raw
    // key back (see RiskRegisterPage.test.tsx for the same convention).
    expect(
      screen.getByText("organization.inspection.loadingTemplate")
    ).toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 12, resilience finding): this
  // query never checked isError, only isLoading -- a genuine fetch
  // failure rendered a fully-styled, zero-section inspection form,
  // indistinguishable from a legitimately empty template. Same bug class
  // round 5 already fixed for InspectionReport.tsx/StartInspectionModal.tsx.
  it("shows a real error state, not the loading/empty template form, on a genuine fetch failure", () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })

    render(<CreateNewInspection />)

    expect(
      screen.queryByText("organization.inspection.loadingTemplate")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "organization.inspection.templateLoadError"
    )
    expect(
      screen.getByRole("button", {
        name: "organization.inspection.backToInspections",
      })
    ).toBeInTheDocument()
  })

  it("renders the template name, site and questions", () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })

    render(<CreateNewInspection />)

    expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    expect(screen.getByText("HQ Casablanca")).toBeInTheDocument()
    expect(screen.getByText("Extinguisher present?")).toBeInTheDocument()
    expect(screen.getByText("Notes on condition")).toBeInTheDocument()
  })

  // Found by review (quality-bar-loop round 2, live-confirmed with 3
  // distinct questions on one page): the "Qn" badge used `pageIndex + 1`
  // for every question on a page, so all of them showed the same number.
  it("numbers each question on a page by its own position, not the page's", () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })

    render(<CreateNewInspection />)

    expect(screen.getByText("Q1")).toBeInTheDocument()
    expect(screen.getByText("Q2")).toBeInTheDocument()
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): the checkbox's own
  // visual box (h-5, 20px) is well under the 44px touch-target guideline;
  // WCAG's target-size rule is about the clickable AREA, so the wrapping
  // <label> needs min-h-11 instead.
  it("gives the checkbox answer's wrapping label a 44px touch target", () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })

    render(<CreateNewInspection />)

    const checkbox = screen.getByRole("checkbox")
    expect(checkbox.closest("label")?.className).toMatch(/\bmin-h-11\b/)
  })

  it("renders a checkbox for checkbox-type questions and toggles its answer", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })

    render(<CreateNewInspection />)
    const checkbox = screen.getAllByRole("checkbox")[0]
    expect(checkbox).not.toBeChecked()

    await userEvent.click(checkbox)

    expect(checkbox).toBeChecked()
    expect(
      screen.getByText("organization.inspection.yes")
    ).toBeInTheDocument()
  })

  it("submits answers and navigates to the inspections list on success", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })
    mockCreateInspection.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<CreateNewInspection />)
    const textInput = screen.getByPlaceholderText(
      "organization.inspection.answerPlaceholder"
    )
    await userEvent.type(textInput, "Looks good")
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.submitInspection",
      })
    )

    await waitFor(() => expect(mockCreateInspection).toHaveBeenCalled())
    const payload = mockCreateInspection.mock.calls[0][0]
    expect(payload).toMatchObject({ templateId: "tpl-1", siteId: "site-1" })
    expect(payload.questionAnswers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ questionId: "q-2", answer: "Looks good" }),
      ])
    )
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/organization/audit/inspections"
      )
    )
  })

  it("shows an error toast and does not submit when template or site is missing", async () => {
    mockLocationState = { templateId: undefined, siteId: undefined }
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })

    render(<CreateNewInspection />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.submitInspection",
      })
    )

    expect(mockCreateInspection).not.toHaveBeenCalled()
  })

  it("blocks submission and toasts when a required text question is left blank", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-5",
                  question: "Describe the hazard",
                  answerType: "input",
                  isRequired: true,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })

    render(<CreateNewInspection />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.submitInspection",
      })
    )

    expect(mockCreateInspection).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith(
      'Please answer the required question: "Describe the hazard"'
    )
  })

  it("scrolls back to an earlier page containing the first missing required answer, from the last page", async () => {
    const scrollIntoViewSpy = HTMLElement.prototype
      .scrollIntoView as ReturnType<typeof vi.fn>
    scrollIntoViewSpy.mockClear()

    // Required question lives on page 0; page 1 (last) has no unmet
    // requirements -- this exercises scrollToPage() actually targeting a
    // *different* page than the one currently in view, not just page 0 by
    // coincidence.
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "Hazards",
              questions: [
                {
                  id: "q-6",
                  question: "Describe the hazard",
                  answerType: "input",
                  isRequired: true,
                },
              ],
            },
            {
              title: "General",
              questions: [
                {
                  id: "q-1",
                  question: "Extinguisher present?",
                  answerType: "checkbox",
                  isRequired: false,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })

    render(<CreateNewInspection />)

    // The Submit button only renders once currentPageIndex === last page,
    // which in the real app is driven by IntersectionObserver as the user
    // scrolls. Simulate that by invoking the captured observer callback as
    // if page index 1's ref had scrolled into view.
    const lastPageEl = document.querySelector('[data-page-index="1"]')!
    act(() => {
      intersectionCallback!(
        [
          {
            isIntersecting: true,
            boundingClientRect: { top: 0 },
            target: lastPageEl,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      )
    })

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.submitInspection",
      })
    )

    expect(mockCreateInspection).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith(
      'Please answer the required question: "Describe the hazard"'
    )
    // The missing required question is on page index 0 ("Hazards"), not the
    // currently-visible last page -- scrollToPage should jump back to it.
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1)
  })

  it("allows submission when a required checkbox question keeps its default (unset) value", async () => {
    // Checkbox/slider questions are always initialized with a real default
    // (false / 5), so "required" there shouldn't block submission -- only
    // text/date/select/media questions that default to "" should.
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })
    mockCreateInspection.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<CreateNewInspection />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.submitInspection",
      })
    )

    await waitFor(() => expect(mockCreateInspection).toHaveBeenCalled())
  })

  // quality-bar-loop (Inspections, round 6, UX finding): a slider question
  // with a non-numeric configured default (`value`) previously flowed
  // straight through as the initial answer -- live-confirmed rendering the
  // literal string "text" under the slider handle in a submitted record.
  it("falls back to a numeric default when a slider question's configured value isn't a number", () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-slider",
                  question: "Rate overall safety (1-10)",
                  answerType: "slider",
                  value: "text",
                  isRequired: false,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })

    render(<CreateNewInspection />)

    expect(screen.getByRole("slider")).toHaveValue("5")
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.queryByText("text")).not.toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 21, accessibility finding):
  // slider/date/multipleSelect answer inputs had no id/label/aria-label
  // tying them to their question text -- a screen-reader user tabbing to
  // any of these three question types heard only "slider"/"date picker"/
  // "combobox" with zero name (WCAG 4.1.2).
  it("gives the slider, date, and multipleSelect answer inputs an accessible name from their question text", () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-slider",
                  question: "Rate overall safety (1-10)",
                  answerType: "slider",
                  isRequired: false,
                },
                {
                  id: "q-date",
                  question: "Inspection date",
                  answerType: "date",
                  isRequired: false,
                },
                {
                  id: "q-select",
                  question: "Pick a hazard category",
                  answerType: "multipleSelect",
                  value: "'Fire','Electrical'",
                  isRequired: false,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })

    const { container } = render(<CreateNewInspection />)

    expect(
      screen.getByRole("slider", { name: "Rate overall safety (1-10)" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Pick a hazard category" })
    ).toBeInTheDocument()
    const dateInput = container.querySelector('input[type="date"]')!
    expect(dateInput.getAttribute("aria-labelledby")).toBe(
      "question-label-q-date"
    )
    expect(document.getElementById("question-label-q-date")).toHaveTextContent(
      "Inspection date"
    )
  })

  // quality-bar-loop (Inspections, round 31, accessibility finding): the
  // checkbox and free-text ("input") answer types -- the two MOST COMMON
  // question types -- were the only ones round 21 missed.
  it("gives the checkbox and free-text answer inputs an accessible name from their question text", () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })

    render(<CreateNewInspection />)

    expect(
      screen.getByRole("checkbox", { name: /Extinguisher present\?/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "Notes on condition" })
    ).toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 31, accessibility finding): same
  // fix as UpdateInspection.tsx's identical Note field.
  it("gives the per-question Note field an accessible name once opened", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })

    render(<CreateNewInspection />)

    await userEvent.click(
      screen.getAllByRole("button", {
        name: "organization.inspection.addNote",
      })[0]
    )

    expect(
      screen.getByRole("textbox", {
        name: "organization.inspection.note",
      })
    ).toBeInTheDocument()
  })

  it("uploads a media answer file via uploadFileAws", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-3",
                  question: "Site photo",
                  answerType: "media",
                  isRequired: false,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "https://cdn.example.com/photo.jpg",
        }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["img"], "site.png", { type: "image/png" })
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!

    await userEvent.upload(input, file)

    await waitFor(() => expect(mockUploadFileAws).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        screen.getByAltText("organization.inspection.uploadedMediaAlt")
      ).toHaveAttribute(
        "src",
        "https://cdn.example.com/photo.jpg"
      )
    )
  })

  // quality-bar-loop (Inspections, round 43, visual-polish regression
  // finding): round 41 fixed video/document branching for the per-question
  // mediaFiles thumbnails, but left this single-answer preview rendering a
  // broken <img> for a video/PDF answer -- ports UpdateInspection.tsx's
  // already-shipped equivalent (round 13/#507).
  it("renders a video media answer as a <video>, not a broken <img>", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-3",
                  question: "Site walkthrough",
                  answerType: "media",
                  isRequired: false,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "https://cdn.example.com/clip.mp4",
        }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["vid"], "clip.mp4", { type: "video/mp4" })
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, file)

    await waitFor(() =>
      expect(container.querySelector("video")).toBeInTheDocument()
    )
    expect(
      container.querySelector('img[src="https://cdn.example.com/clip.mp4"]')
    ).not.toBeInTheDocument()
  })

  it("renders a PDF media answer as a document link, not a broken <img>", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-3",
                  question: "Site walkthrough",
                  answerType: "media",
                  isRequired: false,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "https://cdn.example.com/report.pdf",
        }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["pdf"], "report.pdf", {
      type: "application/pdf",
    })
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, file)

    await waitFor(() =>
      expect(
        container.querySelector('a[href="https://cdn.example.com/report.pdf"]')
      ).toBeInTheDocument()
    )
    expect(
      container.querySelector('img[src="https://cdn.example.com/report.pdf"]')
    ).not.toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 7, accessibility finding): both
  // file inputs used `className="hidden"` (display:none), removing them
  // from the tab order entirely -- a keyboard-only user couldn't attach a
  // photo at all (WCAG 2.1.1). `sr-only` keeps them visually hidden but
  // focusable.
  // quality-bar-loop (Inspections, round 13, mobile finding): the media
  // delete control used to be a hover-only, full-image overlay -- a
  // genuine data-loss trap on touch devices, since no hover state means
  // tapping anywhere on the photo silently deleted it. Replaced with an
  // always-visible, 44px corner button with a real accessible name.
  it("gives the media delete control an always-visible 44px touch target and an accessible name", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-3",
                  question: "Site photo",
                  answerType: "media",
                  isRequired: false,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "https://cdn.example.com/photo.jpg",
        }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["img"], "site.png", { type: "image/png" })
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, file)

    const deleteButton = await screen.findByRole("button", {
      name: "organization.inspection.deleteMedia",
    })
    expect(deleteButton.className).toMatch(/\bh-11\b/)
    expect(deleteButton.className).toMatch(/\bw-11\b/)
    // The button is unconditionally rendered (no opacity-0/group-hover
    // classes) -- always visible, not revealed only on hover/focus.
    expect(deleteButton.className).not.toMatch(/opacity-0/)
  })

  it("keeps both media upload inputs focusable (not display:none-hidden)", () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-3",
                  question: "Site photo",
                  answerType: "media",
                  isRequired: false,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })

    const { container } = render(<CreateNewInspection />)

    const inputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="file"]'
    )
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) {
      expect(input.className).toMatch(/\bsr-only\b/)
      expect(input.className).not.toMatch(/\bhidden\b/)
    }
  })

  // quality-bar-loop (Inspections, round 3, security finding): `value` is
  // rendered straight into <img src> below -- a javascript:/data: value
  // (e.g. if the upload response were ever compromised, or an existing
  // record predates the backend's URL-scheme validation) must not reach
  // that sink.
  it("refuses to render a media answer with a non-http(s) scheme as an <img>", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-3",
                  question: "Site photo",
                  answerType: "media",
                  isRequired: false,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "javascript:alert(1)",
        }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["img"], "site.png", { type: "image/png" })
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!

    await userEvent.upload(input, file)

    await waitFor(() => expect(mockUploadFileAws).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        screen.getByText("organization.inspection.unsafeAttachment")
      ).toBeInTheDocument()
    )
    expect(document.querySelector("img")).not.toBeInTheDocument()
  })

  // Found by review (quality-bar-loop round 2): the "remove media" control
  // on an uploaded external-media file was a `<span onClick>` -- no
  // role/tabIndex/keyboard handler, a genuine keyboard trap (couldn't be
  // focused or activated from the keyboard at all).
  it("renders the remove-media control on an uploaded external file as a real, accessible button", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "https://cdn.example.com/photo.jpg",
        }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["img"], "site.png", { type: "image/png" })
    const input = container.querySelector<HTMLInputElement>(
      'input[id^="external-media-"]'
    )!

    await userEvent.upload(input, file)

    const removeButton = await screen.findByRole("button", {
      name: "organization.inspection.removeMedia",
    })
    // A real <button> is focusable/keyboard-activatable by construction --
    // the prior <span onClick> had no role and no way to receive focus at
    // all, so this assertion alone distinguishes the two.
    removeButton.focus()
    expect(removeButton).toHaveFocus()
  })

  // quality-bar-loop (Inspections, round 22, visual polish finding):
  // amber-bg/red-icon had no relationship to this app's severity/
  // destructive token system -- unified to the same bg-black/60
  // text-white treatment as every other "delete this media" control in
  // this feature (matches UpdateInspection.tsx's identical fix).
  it("uses the shared bg-black/60 treatment for the media-thumbnail remove button, not amber/red", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "https://cdn.example.com/photo.jpg",
        }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["img"], "site.png", { type: "image/png" })
    const input = container.querySelector<HTMLInputElement>(
      'input[id^="external-media-"]'
    )!

    await userEvent.upload(input, file)

    const removeButton = await screen.findByRole("button", {
      name: "organization.inspection.removeMedia",
    })
    expect(removeButton.className).toMatch(/bg-black\/60/)
    expect(removeButton.className).not.toMatch(/bg-amber-100/)
    expect(removeButton.className).not.toMatch(/text-red-500/)
  })

  // quality-bar-loop (Inspections, round 3, security finding): mediaFile.url
  // is rendered straight into <img src> for the thumbnail -- same guard as
  // the single-answer media case above.
  it("refuses to render an external media file with a non-http(s) scheme as an <img> thumbnail", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "javascript:alert(1)",
        }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["img"], "site.png", { type: "image/png" })
    const input = container.querySelector<HTMLInputElement>(
      'input[id^="external-media-"]'
    )!

    await userEvent.upload(input, file)

    await waitFor(() =>
      expect(
        screen.getByText("organization.inspection.unsafeAttachment")
      ).toBeInTheDocument()
    )
    expect(document.querySelector("img")).not.toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 41, code-quality finding): this
  // component's handleExternalMediaUpload used to hardcode `type: "image"`
  // for every uploaded file regardless of its real MIME type, and the
  // thumbnail renderer never branched on file type at all -- so a video
  // uploaded during inspection *creation* rendered as a broken <img>
  // instead of a <video>. UpdateInspection.tsx's identical function
  // already tags and renders this correctly (aexa-frontend#515); this
  // ports that fix to close the sibling-file duplication bug.
  it("renders an uploaded video file as a <video>, not a broken <img>", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "https://cdn.example.com/clip.mp4",
        }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["vid"], "clip.mp4", { type: "video/mp4" })
    const input = container.querySelector<HTMLInputElement>(
      'input[id^="external-media-"]'
    )!

    await userEvent.upload(input, file)

    await waitFor(() =>
      expect(container.querySelector("video")).toBeInTheDocument()
    )
    expect(
      container.querySelector('img[src="https://cdn.example.com/clip.mp4"]')
    ).not.toBeInTheDocument()
  })

  it("renders an uploaded PDF file as a document link, not a broken <img>", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "https://cdn.example.com/report.pdf",
        }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["pdf"], "report.pdf", {
      type: "application/pdf",
    })
    const input = container.querySelector<HTMLInputElement>(
      'input[id^="external-media-"]'
    )!

    await userEvent.upload(input, file)

    await waitFor(() =>
      expect(
        container.querySelector('a[href="https://cdn.example.com/report.pdf"]')
      ).toBeInTheDocument()
    )
    expect(
      container.querySelector('img[src="https://cdn.example.com/report.pdf"]')
    ).not.toBeInTheDocument()
  })

  // Companion to the two rendering tests above: proves the upload handler
  // itself tags the file correctly (not just that the thumbnail happens to
  // render right via the URL-based fileType() fallback), by checking what
  // actually reaches the create-inspection payload.
  it("tags an uploaded video file as type \"video\" (not \"image\") in the submitted payload", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplate() },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: "https://cdn.example.com/clip.mp4",
        }),
    })
    mockCreateInspection.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    const { container } = render(<CreateNewInspection />)
    const file = new File(["vid"], "clip.mp4", { type: "video/mp4" })
    const input = container.querySelector<HTMLInputElement>(
      'input[id^="external-media-"]'
    )!
    await userEvent.upload(input, file)
    await waitFor(() =>
      expect(container.querySelector("video")).toBeInTheDocument()
    )

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.submitInspection",
      })
    )

    await waitFor(() => expect(mockCreateInspection).toHaveBeenCalled())
    const payload = mockCreateInspection.mock.calls[0][0]
    expect(payload.questionAnswers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questionId: "q-1",
          mediaFiles: [
            { url: "https://cdn.example.com/clip.mp4", type: "video" },
          ],
        }),
      ])
    )
  })

  it("rejects an oversized media file without uploading", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: "General",
              questions: [
                {
                  id: "q-4",
                  question: "Site photo",
                  answerType: "media",
                  isRequired: false,
                },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })

    const { container } = render(<CreateNewInspection />)
    const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], "huge.png", {
      type: "image/png",
    })
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!

    await userEvent.upload(input, bigFile)

    expect(mockUploadFileAws).not.toHaveBeenCalled()
  })
})
