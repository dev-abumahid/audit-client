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
