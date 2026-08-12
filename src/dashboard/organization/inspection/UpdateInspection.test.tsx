import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRoutesStub } from "react-router"
import UpdateInspection from "./UpdateInspection"

// aexa-frontend#552: the site label is now a real <Link>, so every render()
// needs a Router context. RTL's `wrapper` option applies to `rerender()`
// too, so this is a drop-in addition rather than needing a renderPage()
// helper everywhere (same convention as CorrelationMatrixPage.test.tsx's
// #549 fix).
//
// quality-bar-loop (Inspections, round 56, industry-standards finding):
// round 56 added a `useBlocker` call (see UpdateInspection.tsx), which
// throws outside a real *data* router -- plain `MemoryRouter` doesn't
// qualify. `createRoutesStub` builds a minimal data router that supports
// useBlocker/useNavigate/etc. the same way the real createBrowserRouter
// app does. `UpdateInspection` takes no props, so the route's Component
// references it directly (a stable, module-scope value -- the
// react-hooks/static-components lint rule flags creating a NEW component
// on every render, which a `children`-closure version would have done)
// rather than a generic children-wrapping route.
//
// quality-bar-loop (Inspections, round 58, resilience finding, PR #734
// round 3): `useNavigate` used to be mocked out entirely (a plain spy,
// `mockNavigate`), which -- same as CreateNewInspection.test.tsx's round
// 56 fix -- made `saveBlocker` a no-op in every test, since a mocked
// navigate never reaches the router to be blocked. The Back button's two
// tests below now assert against a sentinel destination page's rendered
// text instead of a mock spy call, and `initialEntries` seeds two real
// history entries so navigate(-1) has somewhere genuine to go back to.
const NAVIGATED_TO_LIST_SENTINEL = "NAVIGATED_TO_INSPECTIONS_LIST"
function ListSentinel() {
  return <>{NAVIGATED_TO_LIST_SENTINEL}</>
}
// Round 58 review finding (PR #736): a second real navigation target,
// distinct from the Back button's `/organization/audit/inspections`, is
// needed to reproduce the "two different links in quick succession" race
// this round's fix targets -- the site cross-link at the top of the page
// navigates here.
const NAVIGATED_TO_SITE_SENTINEL = "NAVIGATED_TO_SITE"
function SiteSentinel() {
  return <>{NAVIGATED_TO_SITE_SENTINEL}</>
}
const Stub = createRoutesStub([
  { path: "/organization/audit/inspections", Component: ListSentinel },
  { path: "/organization/sites", Component: SiteSentinel },
  { path: "*", Component: UpdateInspection },
])
function RouterWrapper() {
  return (
    <Stub
      initialEntries={[
        "/organization/audit/inspections",
        "/organization/audit/inspection/insp-1/edit",
      ]}
      initialIndex={1}
    />
  )
}
const withRouter = { wrapper: RouterWrapper }

// jsdom has no scrollIntoView; round 48's completion-gate fix now calls
// scrollToPage the same way CreateNewInspection.tsx's submit gate already
// did (see that file's test for the identical polyfill).
HTMLElement.prototype.scrollIntoView = vi.fn()

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// `t()` just echoes the raw key back in this uninitialized test environment,
// which would normally swallow round 48's new `count`/`question` params on
// "cannotCompleteRequiredUnanswered" -- special-case just that one key to
// interpolate it, same pattern as CreateNewInspection.test.tsx's
// "requiredAnswerMissingToast" mock, so the multi-page test below can
// actually assert the computed count and first-question ordering instead of
// both being indistinguishable from the raw key.
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
            key === "organization.inspection.cannotCompleteRequiredUnanswered" &&
            params?.question !== undefined
          ) {
            return `Cannot mark as Completed: ${params.count} required question(s) still unanswered, starting with "${params.question}"`
          }
          return real.t(key)
        },
      }
    },
  }
})

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
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

    render(<UpdateInspection />, withRouter)

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

    render(<UpdateInspection />, withRouter)

    expect(
      screen.getByText("organization.inspection.notFound")
    ).toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 12, resilience finding): this
  // query never checked isError, only isLoading -- a real fetch failure
  // showed the same "not found" message as a genuine 404, unlike
  // InspectionReport.tsx's identical query, which round 5 already fixed
  // to distinguish the two.
  it("shows a real error state, not the generic not-found message, on a genuine fetch failure", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })

    render(<UpdateInspection />, withRouter)

    expect(
      screen.queryByText("organization.inspection.notFound")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "organization.inspection.inspectionLoadError"
    )
    expect(
      screen.getByRole("button", {
        name: "organization.inspection.backToInspections",
      })
    ).toBeInTheDocument()
  })

  it("renders template name, site, existing answers and status", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

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

  // quality-bar-loop (Inspections, round 14, visual polish): guards the
  // status->severity refactor (getInspectionStatusSeverity, replacing this
  // file's own nested ternary) against a color regression.
  it("colors the status dropdown trigger amber for IN_PROGRESS", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    const trigger = screen.getByText(
      "organization.inspection.statusInProgress"
    ).closest("button")
    expect(trigger?.className).toMatch(/text-amber-800/)
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): the checkbox
  // answer's visual box is well under the 44px touch-target guideline;
  // WCAG's target-size rule is about the clickable AREA, so the wrapping
  // <label> needs min-h-11 instead of resizing the checkbox itself.
  it("gives the checkbox answer's wrapping label a 44px touch target", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    const checkbox = screen.getAllByRole("checkbox")[0]
    expect(checkbox.closest("label")?.className).toMatch(/\bmin-h-11\b/)
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): this pill-styled
  // trigger is a real interactive control (opens the status-change menu),
  // not just a badge -- it measured well under the 44px touch-target
  // guideline live.
  it("gives the status dropdown trigger a 44px touch target", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    expect(
      screen.getByText("organization.inspection.statusInProgress").closest(
        "button"
      )?.className
    ).toMatch(/\bh-11\b/)
  })

  // quality-bar-loop (Inspections, round 7, accessibility finding): all
  // three file inputs on this page used `className="hidden"`
  // (display:none), removing them from the tab order entirely -- a
  // keyboard-only user couldn't attach a photo, add supporting media, or
  // upload an inspection attachment (WCAG 2.1.1). `sr-only` keeps them
  // visually hidden but focusable.
  it("keeps every media/attachment upload input focusable (not display:none-hidden)", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: {
            templateName: "Fire Safety Audit",
            pages: [
              {
                title: "General",
                questions: [
                  {
                    id: "q-media",
                    question: "Site photo",
                    answerType: "media",
                    isRequired: false,
                  },
                ],
              },
            ],
          },
          questionAnswers: [],
        }),
      },
      isLoading: false,
    })

    const { container } = render(<UpdateInspection />, withRouter)

    const inputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="file"]'
    )
    expect(inputs.length).toBeGreaterThanOrEqual(3)
    for (const input of inputs) {
      expect(input.className).toMatch(/\bsr-only\b/)
      expect(input.className).not.toMatch(/\bhidden\b/)
    }
  })

  // quality-bar-loop (Inspections, round 22, visual polish finding):
  // this delete button used to be hover-only (opacity-0
  // group-hover:opacity-100) -- the exact touch-discoverability trap
  // round 13 already eliminated for the image-answer case. Confirms the
  // document-answer delete button is now always visible and matches the
  // same bg-black/60 text-white h-11 w-11 treatment.
  it("gives the document-answer delete button an always-visible 44px touch target", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: {
            templateName: "Fire Safety Audit",
            pages: [
              {
                title: "General",
                questions: [
                  {
                    id: "q-media",
                    question: "Site plan",
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
              answer: "https://cdn.example.com/site-plan.pdf",
              note: "",
              mediaFiles: [],
            },
          ],
        }),
      },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    const deleteButton = screen.getByRole("button", {
      name: "organization.inspection.deleteMedia",
    })
    expect(deleteButton.className).toMatch(/\bh-11\b/)
    expect(deleteButton.className).toMatch(/\bw-11\b/)
    expect(deleteButton.className).toMatch(/bg-black\/60/)
    expect(deleteButton.className).not.toMatch(/opacity-0/)
    expect(deleteButton.className).not.toMatch(/group-hover/)
  })

  // quality-bar-loop (Inspections, round 22, visual polish finding):
  // this delete button used a smaller size and lower opacity
  // (bg-black/60 p-1.5 opacity-80, ~28px) than the image-answer case's
  // proven pattern -- unified to the same button.
  it("gives the video-answer delete button the same 44px treatment as the image-answer case", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: {
            templateName: "Fire Safety Audit",
            pages: [
              {
                title: "General",
                questions: [
                  {
                    id: "q-media",
                    question: "Site walkthrough",
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
              answer: "https://cdn.example.com/walkthrough.mp4",
              note: "",
              mediaFiles: [],
            },
          ],
        }),
      },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    const deleteButton = screen.getByRole("button", {
      name: "organization.inspection.deleteMedia",
    })
    expect(deleteButton.className).toMatch(/\bh-11\b/)
    expect(deleteButton.className).toMatch(/\bw-11\b/)
    expect(deleteButton.className).not.toMatch(/opacity-80/)
  })

  // quality-bar-loop (Inspections, round 22, visual polish finding):
  // amber-bg/red-icon had no relationship to this app's severity/
  // destructive token system -- unified to the same bg-black/60
  // text-white treatment as every other "delete this media" control.
  it("uses the shared bg-black/60 treatment for the media-thumbnail remove button, not amber/red", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
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
                    isRequired: false,
                  },
                ],
              },
            ],
          },
          questionAnswers: [
            {
              id: "qa-1",
              questionId: "q-1",
              answer: true,
              note: "",
              mediaFiles: [
                { url: "https://cdn.example.com/photo.jpg", type: "image" },
              ],
            },
          ],
        }),
      },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    const removeButton = screen.getByRole("button", {
      name: "organization.inspection.remove",
    })
    expect(removeButton.className).toMatch(/bg-black\/60/)
    expect(removeButton.className).not.toMatch(/bg-amber-100/)
    expect(removeButton.className).not.toMatch(/text-red-500/)
  })

  // quality-bar-loop (Inspections, round 6, UX finding): a slider
  // question with a non-numeric configured default (`value`) previously
  // flowed straight through as the initial answer for a question with no
  // existing recorded answer yet -- live-confirmed rendering the literal
  // string "text" under the slider handle.
  it("falls back to a numeric default when a slider question's configured value isn't a number and has no existing answer", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: {
            templateName: "Fire Safety Audit",
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
          },
          questionAnswers: [],
        }),
      },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

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
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: {
            templateName: "Fire Safety Audit",
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
          },
          questionAnswers: [],
        }),
      },
      isLoading: false,
    })

    const { container } = render(<UpdateInspection />, withRouter)

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
  // question types -- were the only ones round 21 missed; a screen reader
  // heard just "Yes"/"No, checkbox" or nothing at all for a free-text
  // field, with zero tie to the question text.
  it("gives the checkbox and free-text answer inputs an accessible name from their question text", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    expect(
      screen.getByRole("checkbox", { name: /Extinguisher present\?/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "Notes on condition" })
    ).toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 31, accessibility finding): the
  // per-question Note field's <p> label was a visual-only sibling of its
  // textarea, with no id/htmlFor connecting them.
  it("gives the per-question Note field an accessible name once opened", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

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

  // quality-bar-loop (Inspections, round 9, efficiency finding): the
  // effect that seeds visibleNotes used to be keyed on `[answers]` and
  // unconditionally overwrote the whole visibleNotes object on every
  // answer change -- not just an O(totalQuestions) tax per keystroke, but
  // a real correctness bug: opening an empty "Add Note" textarea for one
  // question, then editing a DIFFERENT question's answer, silently closed
  // the just-opened, still-empty note textarea (the recompute only looks
  // at saved note text, so an empty-but-just-opened note gets dropped).
  it("keeps a just-opened, still-empty note field open after editing a different question's answer", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    await userEvent.click(
      screen.getAllByRole("button", {
        name: "organization.inspection.addNote",
      })[0]
    )
    expect(
      screen.getByPlaceholderText("organization.inspection.notePlaceholder")
    ).toBeInTheDocument()

    // Edit a different question's answer (q-2, a plain text input) --
    // this changes `answers`, which used to re-trigger the buggy effect.
    // Targeted by placeholder, not role/index: role="textbox" also
    // matches the just-opened note's own <textarea>, which sits earlier
    // in the DOM and would make an index-based query silently type into
    // the note field itself instead of a different question.
    await userEvent.type(
      screen.getByPlaceholderText("organization.inspection.answerPlaceholder"),
      "x"
    )

    expect(
      screen.getByPlaceholderText("organization.inspection.notePlaceholder")
    ).toBeInTheDocument()
  })

  // aexa-frontend#552: same site cross-link as InspectionReport.tsx --
  // reuses the established ?siteId=&search= pattern (#533/#541).
  it("links the site label into Sites, scoped to that site", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    const link = screen.getByRole("link", { name: "HQ Casablanca" })
    expect(link).toHaveAttribute(
      "href",
      "/organization/sites?siteId=site-1&search=HQ%20Casablanca"
    )
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

    render(<UpdateInspection />, withRouter)

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

    render(<UpdateInspection />, withRouter)

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

    render(<UpdateInspection />, withRouter)

    expect(screen.getByText("Recommendation section")).toBeInTheDocument()
    expect(screen.getByText("Unsplit text section")).toBeInTheDocument()
  })

  it('shows "Upload Note" when there is no note, "View Note" when one exists', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })
    const { unmount } = render(<UpdateInspection />, withRouter)
    expect(
      screen.getByRole("button", {
        name: "organization.inspection.uploadNote",
      })
    ).toBeInTheDocument()

    // quality-bar-loop (Inspections, round 56, industry-standards
    // finding): a real `rerender()` no longer reliably propagates through
    // the `createRoutesStub`-based router wrapper `useBlocker` now
    // requires (the data router's own internal state-subscription can
    // bail out a plain ancestor re-render, unlike the previous bare
    // MemoryRouter). UpdateInspection has no internal state that would be
    // lost by mounting fresh instead, so a second render with the updated
    // mock is behaviorally equivalent for what this test actually checks.
    // Review finding on PR #734: unmount the first tree explicitly first
    // -- RTL's automatic cleanup only runs `afterEach`, not between two
    // `render()` calls in the same test, so without this the two trees
    // would coexist and any future edit giving both an identically-named
    // button would break `getByRole` with a "multiple elements" error.
    unmount()
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection({ note: { id: "note-1" } }) },
      isLoading: false,
    })
    render(<UpdateInspection />, withRouter)
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

    render(<UpdateInspection />, withRouter)
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

  // quality-bar-loop (Inspections, round 56, industry-standards finding):
  // live-reproduced data loss -- typing an answer then clicking Back
  // *inside* the 1s debounce window navigated away before the pending
  // save ever fired, silently discarding the edit with zero warning.
  // Unlike CreateNewInspection.tsx (which has nothing to flush and needs
  // a real discard-confirmation instead), this file already auto-saves --
  // the fix is flushing the pending save immediately rather than letting
  // navigation race it.
  it("flushes a pending debounced save before navigating back, instead of losing it to the race", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })
    mockUpdateQuestionAnswer.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(<UpdateInspection />, withRouter)
    const checkbox = screen.getAllByRole("checkbox")[0]
    await userEvent.click(checkbox)

    // Click Back well before the 1000ms debounce would have fired on its
    // own -- the old behavior navigated away here with the save still
    // pending, never persisting it.
    await userEvent.click(
      screen.getByRole("button", { name: "organization.inspection.back" })
    )

    await waitFor(() =>
      expect(mockUpdateQuestionAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "qa-1",
          data: expect.objectContaining({ answer: false }),
        })
      )
    )
    await waitFor(() =>
      expect(screen.getByText(NAVIGATED_TO_LIST_SENTINEL)).toBeInTheDocument()
    )
  })

  // Round 58 review finding (PR #736): the try/catch around
  // `saveBlocker.proceed()` shipped with no test proving it's actually
  // reachable/necessary. This reproduces the race the PR body describes:
  // `flushPendingSaves` clears `saveTimeoutRef` synchronously (before the
  // mutation resolves), so react-router's own reactive re-evaluation of
  // the blocker's `shouldBlock` predicate can auto-settle THIS SAME
  // blocker instance to "unblocked" before the effect's `.then()`
  // callback gets a chance to call `.proceed()` -- at which point
  // `.proceed()` throws `Invalid blocker state transition: unblocked ->
  // proceeding`. Confirmed by temporarily reverting the try/catch: this
  // exact single-Back-click flow (no second navigation target needed --
  // the race is inherent to the timing between the synchronous
  // `saveTimeoutRef` clear and the awaited mutation, not to competing
  // navigation targets) reliably reproduces it. Node's `process` emits
  // `unhandledRejection` for a rejection an effect's `.then()` never
  // catches -- that's the actual channel Vitest's own "Unhandled Errors"
  // report reads from, not jsdom's `window` `unhandledrejection` event
  // (which never fires here, since the throw happens on the Node side of
  // the test, not as a browser-dispatched promise rejection).
  it("does not throw an unhandled rejection when the flush's own settle races the blocker's proceed", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })
    mockUpdateQuestionAnswer.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    // This project has no @types/node, so `process` isn't ambiently typed
    // here -- reach it via `globalThis` instead of adding a global dep just
    // for one test's assertion.
    const nodeProcess = (
      globalThis as unknown as {
        process: {
          on: (event: string, listener: (reason: unknown) => void) => void
          off: (event: string, listener: (reason: unknown) => void) => void
        }
      }
    ).process

    const rejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => {
      rejections.push(reason)
    }
    nodeProcess.on("unhandledRejection", onUnhandledRejection)

    try {
      render(<UpdateInspection />, withRouter)
      const checkbox = screen.getAllByRole("checkbox")[0]
      await userEvent.click(checkbox)

      // Click Back well before the 1000ms debounce would have fired on
      // its own, same trigger as the "flushes a pending debounced save"
      // test above -- the unhandled-rejection channel that test never
      // asserted on is exactly what this test exists to check.
      await userEvent.click(
        screen.getByRole("button", { name: "organization.inspection.back" })
      )

      await waitFor(() =>
        expect(
          screen.getByText(NAVIGATED_TO_LIST_SENTINEL)
        ).toBeInTheDocument()
      )
      // Give the flush's own microtask/macrotask queue a chance to settle
      // so a swallowed-vs-unhandled rejection would have already surfaced.
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Round 58 review round 2 finding: `process` is a single, per-worker
      // EventEmitter, so this listener technically has no way to scope
      // itself to just this test's own async work -- filter to the
      // specific invariant this test exists to guard against, rather than
      // asserting on the raw (unscoped) rejection list, so an unrelated
      // rejection from elsewhere can't turn this into a flaky false
      // failure.
      const blockerRaceRejections = rejections.filter(
        (reason) =>
          reason instanceof Error &&
          reason.message.includes("Invalid blocker state transition")
      )
      expect(blockerRaceRejections).toEqual([])
    } finally {
      nodeProcess.off("unhandledRejection", onUnhandledRejection)
    }
  })

  it("navigates back immediately when there is no pending save to flush", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)
    await userEvent.click(
      screen.getByRole("button", { name: "organization.inspection.back" })
    )

    expect(mockUpdateQuestionAnswer).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByText(NAVIGATED_TO_LIST_SENTINEL)).toBeInTheDocument()
    )
  })

  // quality-bar-loop (Inspections, round 19, resilience finding): the
  // debounced auto-save wrapper's own catch used to toast a second,
  // generic "Failed to save answer" on top of handleUpdateQuestion's
  // already-fired, more specific error toast -- every auto-save failure
  // stacked two toasts. Confirms exactly one error toast fires now.
  it("shows exactly one error toast when auto-save fails, not two", async () => {
    const toast = (await import("sonner")).toast
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })
    mockUpdateQuestionAnswer.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Network error" } }),
    })

    render(<UpdateInspection />, withRouter)
    const checkbox = screen.getAllByRole("checkbox")[0]
    await userEvent.click(checkbox)

    await waitFor(() => expect(mockUpdateQuestionAnswer).toHaveBeenCalled(), {
      timeout: 2000,
    })
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(toast.error).toHaveBeenCalledWith(
      "organization.inspection.updateQuestionFailedToast"
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

    render(<UpdateInspection />, withRouter)
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

    render(<UpdateInspection />, withRouter)
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

  // quality-bar-loop (Inspections, round 18, UX finding): marking an
  // inspection COMPLETED used to have zero required-field validation --
  // this blocks it and surfaces exactly how many required questions are
  // still unanswered, rather than silently completing an inspection with
  // gaps.
  it("blocks marking COMPLETED when a required text question is unanswered", async () => {
    const toast = (await import("sonner")).toast
    // A required "input"-type question genuinely has no answer here (no
    // questionAnswers entry, and its local default is `""`) -- unlike
    // checkbox/slider, this type's blank default IS a real, meaningful
    // "unanswered" signal (see the code comment on handleStatusChange for
    // why checkbox/slider can't be validated the same way).
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
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
                    isRequired: true,
                  },
                ],
              },
            ],
          },
          questionAnswers: [
            { id: "qa-1", questionId: "q-1", answer: true, note: "", mediaFiles: [] },
          ],
        }),
      },
      isLoading: false,
    })
    mockUpdateInspection.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<UpdateInspection />, withRouter)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.inspection\.statusInProgress/i,
      })
    )
    await userEvent.click(
      await screen.findByText("organization.inspection.statusCompleted")
    )

    expect(mockUpdateInspection).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      'Cannot mark as Completed: 1 required question(s) still unanswered, starting with "Notes on condition"'
    )
  })

  // quality-bar-loop (Inspections, round 46, UX finding): the fix for the
  // gap the comment above used to document as an accepted limitation --
  // a required checkbox/slider left at its literal default is now
  // correctly treated as unanswered via a separate touchedQuestionIds
  // signal, entirely independent of the answer value itself.
  it("blocks marking COMPLETED when a required checkbox has never been answered", async () => {
    const toast = (await import("sonner")).toast
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          // No questionAnswers entry for q-1 at all -- never touched,
          // not even a persisted default.
          questionAnswers: [
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
    mockUpdateInspection.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<UpdateInspection />, withRouter)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.inspection\.statusInProgress/i,
      })
    )
    await userEvent.click(
      await screen.findByText("organization.inspection.statusCompleted")
    )

    expect(mockUpdateInspection).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      'Cannot mark as Completed: 1 required question(s) still unanswered, starting with "Extinguisher present?"'
    )
  })

  // quality-bar-loop (Inspections, round 48, UX finding): this gate used to
  // only report a bare count with no way to locate the offending question --
  // an asymmetric gap relative to CreateNewInspection.tsx's submit gate,
  // which always named the question and scrolled to it. Now both scroll and
  // focus land on the actual question, same as the create flow.
  it("scrolls to and focuses the first unanswered required question when completion is blocked", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
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
                ],
              },
            ],
          },
          // No questionAnswers entry for q-1 -- genuinely never touched.
          questionAnswers: [],
        }),
      },
      isLoading: false,
    })
    mockUpdateInspection.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<UpdateInspection />, withRouter)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.inspection\.statusInProgress/i,
      })
    )
    await userEvent.click(
      await screen.findByText("organization.inspection.statusCompleted")
    )

    expect(mockUpdateInspection).not.toHaveBeenCalled()
    expect(
      (HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>)
    ).toHaveBeenCalled()
    // Deferred past the dropdown menu's own focus-return -- see the code
    // comment on handleStatusChange for why this can't be synchronous here.
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("question-card-q-1")
    )
  })

  // quality-bar-loop (Inspections, round 52, accessibility finding): same
  // fix as CreateNewInspection.tsx's identical gap -- a screen reader
  // landing on the focused card via round 48's mechanism previously had
  // nothing to announce.
  it("gives every question card an aria-labelledby that resolves to its own question text", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    const card = document.getElementById("question-card-q-1")!
    const labelId = card.getAttribute("aria-labelledby")
    expect(labelId).toBe("question-label-q-1")
    expect(document.getElementById(labelId!)?.textContent).toContain(
      "Extinguisher present?"
    )
  })

  // quality-bar-loop (Inspections, round 52, accessibility finding): in
  // dark mode neither round 50's `border/50` nor `ring/40` cleared WCAG
  // 1.4.11's 3:1 non-text-contrast floor (computed against the real
  // --destructive/--card tokens); both bumped to `/70`. Negative control:
  // asserts the fixed dark-mode values are present, not the under-contrast
  // ones round 50 shipped. Light mode is untouched (the full-opacity
  // border alone already clears 3:1 there).
  it("uses contrast-safe dark-mode border/ring opacity on the focused question card", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    const card = document.getElementById("question-card-q-1")!
    expect(card.className).toContain("dark:focus:border-destructive/70")
    expect(card.className).toContain("dark:focus:ring-destructive/70")
    expect(card.className).not.toContain("dark:focus:border-destructive/50")
    expect(card.className).not.toContain("dark:focus:ring-destructive/40")
  })

  // quality-bar-loop (Inspections, round 52, accessibility finding): same
  // fix as CreateNewInspection.tsx's identical gap -- `sr-only` clips the
  // file input's own focus ring, leaving keyboard focus reachable but
  // visually invisible (WCAG 2.4.7).
  it("gives the sr-only Add Media file input's visible sibling Button a peer-focus-visible ring", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    const externalMediaInput = document.querySelector(
      'input[id^="update-external-media-"]'
    )!
    expect(externalMediaInput.className).toContain("peer")

    // Button uses `asChild`, so its actual DOM node is the <span> it wraps,
    // not a real <button> -- select the peer's next sibling directly.
    const visibleControl = externalMediaInput.nextElementSibling!
    expect(visibleControl.className).toContain("peer-focus-visible:ring-2")
  })

  // quality-bar-loop (Inspections, round 52, accessibility finding): the
  // inspection-level attachment upload input isn't wrapped by a separate
  // Button sibling (its label wraps the visible content directly), so it
  // uses `has-[:focus-visible]` on the label instead of the `peer` pattern
  // used by the other file inputs in this file.
  it("gives the attachment-upload label a focus-visible ring via has-[:focus-visible]", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    const attachmentInput = screen.getByText(
      "organization.inspection.uploadFile"
    ).closest("label")!.querySelector('input[type="file"]')!
    expect(attachmentInput.closest("label")!.className).toContain(
      "has-[:focus-visible]:ring-2"
    )
  })

  // quality-bar-loop (Inspections, round 54, industry-standards finding):
  // the attachment-remove and page-nav pill buttons had no explicit type,
  // defaulting to type="submit" -- same latent-bug class fixed across the
  // other 9 buttons in this loop's history (round 41+).
  it("gives the attachment-remove and page-nav buttons an explicit type=\"button\"", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          attachments: ["https://cdn.example.com/report.pdf"],
        }),
      },
      isLoading: false,
    })

    render(<UpdateInspection />, withRouter)

    expect(
      screen.getByTitle("organization.inspection.remove").tagName
    ).toBe("BUTTON")
    expect(
      (screen.getByTitle("organization.inspection.remove") as HTMLButtonElement)
        .type
    ).toBe("button")

    // "General" (the page title) renders in both the sidebar nav button
    // and the page's own heading -- find the one inside a <button>.
    const navButton = screen
      .getAllByText("General")
      .map((el) => el.closest("button"))
      .find((btn) => btn !== null)!
    expect(navButton.type).toBe("button")
  })

  // Review finding on PR #726: the reduce->map/flat refactor needed a test
  // with missing required questions spread across *multiple* pages, to
  // confirm the total count still accumulates correctly (not just the
  // first match) and that missing[0] resolves to the first page's question
  // in document order, not an arbitrary one.
  it("counts every missing required question across pages, and targets the first one in page order", async () => {
    const toast = (await import("sonner")).toast
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: {
            templateName: "Fire Safety Audit",
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
                    isRequired: true,
                  },
                ],
              },
            ],
          },
          // Neither q-6 (page 0) nor q-1 (page 1) has a persisted answer --
          // both genuinely unanswered, on two different pages.
          questionAnswers: [],
        }),
      },
      isLoading: false,
    })
    mockUpdateInspection.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<UpdateInspection />, withRouter)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.inspection\.statusInProgress/i,
      })
    )
    await userEvent.click(
      await screen.findByText("organization.inspection.statusCompleted")
    )

    expect(mockUpdateInspection).not.toHaveBeenCalled()
    // count reflects BOTH missing questions, not just the first found.
    expect(toast.error).toHaveBeenCalledWith(
      'Cannot mark as Completed: 2 required question(s) still unanswered, starting with "Describe the hazard"'
    )
    // and focus/scroll target page 0's question ("Describe the hazard"),
    // not page 1's ("Extinguisher present?") -- proving .flat() preserved
    // page order rather than picking an arbitrary match.
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("question-card-q-6")
    )
  })

  // The one signal actually derivable from data alone: a persisted value
  // that *differs* from the question's computed default means it really
  // was answered in a past session, even though there's no explicit
  // "touched" flag anywhere in this data model. Protects the realistic
  // multi-session workflow (fill out most of an inspection, come back
  // later to finish and complete it) from being forced to re-touch every
  // already-correct checkbox/slider.
  it("allows marking COMPLETED when a required checkbox was already answered in a past session", async () => {
    // Default makeInspection() already has q-1 (required checkbox)
    // persisted as `answer: true` -- differs from the computed default
    // of `false`, so it's inferred touched on load without the user
    // re-clicking anything in this session.
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
      isLoading: false,
    })
    mockUpdateInspection.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<UpdateInspection />, withRouter)
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

  it("allows marking COMPLETED once a required checkbox is touched in the current session", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          // No persisted answer for q-1 -- starts genuinely untouched.
          questionAnswers: [
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
    mockUpdateInspection.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<UpdateInspection />, withRouter)
    await userEvent.click(screen.getByRole("checkbox"))

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

  // Review finding on PR #724: `qa.answer` is typed `any` off a Json
  // column, so a backend that serializes the checkbox default as the
  // string "false" (instead of the boolean false) must still be read as
  // "at its default" -- a naive `=== false` comparison would treat this
  // as "differs from default" and wrongly infer the question was touched,
  // silently reintroducing the bug this PR fixes for that data shape.
  it("blocks marking COMPLETED when a persisted checkbox default arrives as the string \"false\"", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          questionAnswers: [
            {
              id: "qa-1",
              questionId: "q-1",
              answer: "false",
              note: "",
              mediaFiles: [],
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
    mockUpdateInspection.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<UpdateInspection />, withRouter)
    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.inspection\.statusInProgress/i,
      })
    )
    await userEvent.click(
      await screen.findByText("organization.inspection.statusCompleted")
    )

    expect(mockUpdateInspection).not.toHaveBeenCalled()
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

    render(<UpdateInspection />, withRouter)
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

    render(<UpdateInspection />, withRouter)
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

    render(<UpdateInspection />, withRouter)
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

      render(<UpdateInspection />, withRouter)

      expect(screen.getByText("report.pdf")).toBeInTheDocument()
    })

    // quality-bar-loop (Inspections, round 13, mobile finding): the
    // remove-attachment icon was 14x14 with zero padding. `p-2.5 -m-2.5`
    // extends the real tappable area to 34x34 (not the full 44px, since
    // this row wraps several small chips side by side and a full 44px box
    // here would break that compact layout) without growing the chip's
    // own visual size.
    it("extends the attachment remove icon's tappable area beyond its visual size", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            attachments: ["https://cdn.example.com/report.pdf"],
          }),
        },
        isLoading: false,
      })

      render(<UpdateInspection />, withRouter)

      const removeButton = screen.getByTitle("organization.inspection.remove")
      expect(removeButton.className).toMatch(/\bp-2\.5\b/)
      expect(removeButton.className).toMatch(/-m-2\.5\b/)
    })

    // quality-bar-loop (Inspections, round 3, security finding, review
    // follow-up): the backend already validates attachments' scheme on
    // write, but a pre-existing record from before that check landed
    // could still carry an unsafe value.
    it("refuses to render an attachment with a non-http(s) scheme as a link", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            attachments: ["javascript:alert(1)"],
          }),
        },
        isLoading: false,
      })

      render(<UpdateInspection />, withRouter)

      expect(
        screen.getByText("organization.inspection.unsafeAttachment")
      ).toBeInTheDocument()
      expect(
        document.querySelector('[href^="javascript:"]')
      ).not.toBeInTheDocument()
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

      render(<UpdateInspection />, withRouter)
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

      render(<UpdateInspection />, withRouter)
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

      render(<UpdateInspection />, withRouter)
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

      render(<UpdateInspection />, withRouter)
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

      render(<UpdateInspection />, withRouter)
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

      render(<UpdateInspection />, withRouter)
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

      render(<UpdateInspection />, withRouter)

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

    // quality-bar-loop (Inspections, round 62, mobile finding, found in
    // round 61): a question with many attached photos overflowed the
    // thumbnail row's parent Card and clipped later thumbnails' delete
    // buttons out of the tappable area at narrow viewports, since the row
    // had no flex-wrap.
    it("wraps the media-thumbnail row instead of letting it overflow horizontally", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            questionAnswers: [
              {
                id: "qa-1",
                questionId: "q-1",
                answer: true,
                note: "",
                mediaFiles: Array.from({ length: 8 }, (_, i) => ({
                  url: `https://cdn.example.com/photo-${i}.jpg`,
                })),
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

      const { container } = render(<UpdateInspection />, withRouter)

      const row = container.querySelector(".flex.items-center.gap-x-5")
      expect(row).not.toBeNull()
      expect(row?.className).toContain("flex-wrap")
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

      render(<UpdateInspection />, withRouter)
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

      render(<UpdateInspection />, withRouter)

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

      render(<UpdateInspection />, withRouter)

      // aexa-frontend#552 added a second <a> on this page (the site-name
      // cross-link), so this now needs to target the attachment link
      // specifically rather than assume it's the only one -- this link is
      // icon-only (no accessible name), so disambiguate by href instead.
      const link = screen
        .getAllByRole("link")
        .find((el) => el.getAttribute("href") === "https://cdn.example.com/report.pdf")
      expect(link).toBeDefined()
      expect(link).toHaveAttribute("target", "_blank")
    })

    // quality-bar-loop (Inspections, round 3, security finding):
    // mediaFile.url is rendered straight into <source src>/<a href>/
    // <img src> above -- same guard as the single-answer media case.
    it("refuses to render an existing media file with a non-http(s) scheme into any sink", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeInspection({
            questionAnswers: [
              {
                id: "qa-1",
                questionId: "q-1",
                answer: true,
                note: "",
                mediaFiles: [{ url: "javascript:alert(1)", type: "image" }],
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

      render(<UpdateInspection />, withRouter)

      expect(
        screen.getByText("organization.inspection.unsafeAttachment")
      ).toBeInTheDocument()
      expect(document.querySelector("img")).not.toBeInTheDocument()
      expect(document.querySelector("video")).not.toBeInTheDocument()
      expect(
        document.querySelector('[href^="javascript:"]')
      ).not.toBeInTheDocument()
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

      render(<UpdateInspection />, withRouter)

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

      render(<UpdateInspection />, withRouter)

      const link = screen.getByRole("link", { name: /report\.pdf/ })
      expect(link).toHaveAttribute("href", "https://cdn.example.com/report.pdf")
      expect(link).toHaveAttribute("target", "_blank")
      expect(document.querySelector("img")).not.toBeInTheDocument()
    })

    // quality-bar-loop (Inspections, round 3, security finding): `answer`
    // is stored data and gets rendered straight into <source src>/<a href>/
    // <img src> above -- an existing record saved before the backend's
    // URL-scheme validation could still carry a javascript:/data: value.
    it("refuses to render a media answer with a non-http(s) scheme into any sink", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: makeMediaInspection("javascript:alert(1)") },
        isLoading: false,
      })

      render(<UpdateInspection />, withRouter)

      expect(
        screen.getByText("organization.inspection.unsafeAttachment")
      ).toBeInTheDocument()
      expect(document.querySelector("img")).not.toBeInTheDocument()
      expect(document.querySelector("video")).not.toBeInTheDocument()
      expect(
        document.querySelector('[href^="javascript:"]')
      ).not.toBeInTheDocument()
    })

    it("still renders an image answer as an <img>", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeMediaInspection("https://cdn.example.com/photo.jpg"),
        },
        isLoading: false,
      })

      render(<UpdateInspection />, withRouter)

      expect(
        screen.getByAltText("organization.inspection.uploadedMediaAlt")
      ).toBeInTheDocument()
    })

    // quality-bar-loop (Inspections, round 13, mobile finding): the media
    // delete control used to be a hover-only, full-image overlay -- a
    // genuine data-loss trap on touch devices, since no hover state means
    // tapping anywhere on the photo silently deleted it. Replaced with an
    // always-visible, 44px corner button with a real accessible name.
    it("gives the media delete control an always-visible 44px touch target and an accessible name", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: {
          data: makeMediaInspection("https://cdn.example.com/photo.jpg"),
        },
        isLoading: false,
      })

      render(<UpdateInspection />, withRouter)

      const deleteButton = screen.getByRole("button", {
        name: "organization.inspection.deleteMedia",
      })
      expect(deleteButton.className).toMatch(/\bh-11\b/)
      expect(deleteButton.className).toMatch(/\bw-11\b/)
      expect(deleteButton.className).not.toMatch(/opacity-0/)
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

      render(<UpdateInspection />, withRouter)

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

      render(<UpdateInspection />, withRouter)

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
