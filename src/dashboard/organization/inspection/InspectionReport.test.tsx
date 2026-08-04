import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import InspectionReport from "./InspectionReport"

// Controllable `i18n.language` for the locale-formatting test below, while
// every other test in this file keeps relying on the real (uninitialized)
// react-i18next t(), which just echoes the raw key back -- same technique
// as TeamMembersTab.test.tsx.
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
vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useGetSingleInspectionQuery: (...args: unknown[]) =>
    mockUseGetSingleInspectionQuery(...args),
}))

function makeInspection(overrides = {}) {
  return {
    id: "insp-1",
    status: "COMPLETED",
    site: { id: "site-1", name: "HQ Casablanca" },
    unSplitText: "",
    actions: [],
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
            { id: "q-2", question: "Condition rating", answerType: "slider" },
            { id: "q-3", question: "Inspection date", answerType: "date" },
          ],
        },
      ],
    },
    questionAnswers: [
      {
        questionId: "q-1",
        answer: true,
        note: "Checked twice",
        mediaFiles: [],
      },
      { questionId: "q-2", answer: 7, note: "", mediaFiles: [] },
      { questionId: "q-3", answer: "2026-06-01", note: "", mediaFiles: [] },
    ],
    ...overrides,
  }
}

describe("InspectionReport", () => {
  beforeEach(() => {
    mockLanguage = undefined
    mockNavigate.mockReset()
    mockUseGetSingleInspectionQuery.mockReset()
  })

  it("shows a loading state while there is no inspection data yet", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({ data: undefined })

    render(<InspectionReport />)

    // i18n isn't initialized in the test environment, so t() echoes the raw
    // key back (see RiskRegisterPage.test.tsx for the same convention).
    expect(
      screen.getByText("organization.inspection.loadingReport")
    ).toBeInTheDocument()
  })

  it("renders the header with status, template name, site and stats", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />)

    // Bug-fix batch: the status badge used to render the raw enum value
    // ("COMPLETED") instead of the humanized translation key shared with
    // InspectionTable.tsx's status badge/filter dropdown.
    expect(
      screen.getByText("organization.inspection.statusCompleted")
    ).toBeInTheDocument()
    expect(screen.queryByText("COMPLETED")).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Fire Safety Audit" })
    ).toBeInTheDocument()
    expect(screen.getByText(/HQ Casablanca/)).toBeInTheDocument()
    expect(screen.getByText("3/3")).toBeInTheDocument() // totalAnswered/totalQuestions
  })

  // Regression (aexa-frontend round-9 audit #463): the page h1 (report
  // title) was followed directly by an h3 (each template page's title, e.g.
  // "General"), with no h2 anywhere in between. Page titles are now h2,
  // siblings of the Attachments/Unsplit Text section h2s.
  it("keeps a valid heading hierarchy: page title is h2, not h3, right after the h1", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Fire Safety Audit" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "General" })
    ).toBeInTheDocument()
  })

  it("renders a Yes badge for a truthy checkbox answer and shows its note", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />)

    expect(screen.getByText("organization.inspection.yes")).toBeInTheDocument()
    expect(screen.getByText("Checked twice")).toBeInTheDocument()
  })

  it("renders the slider value and the locale-formatted date answer", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />)

    expect(screen.getByText("7")).toBeInTheDocument()
    // aexa-frontend#378: the "date"-type answer used a bare
    // toLocaleDateString() with no locale/options -- now goes through the
    // same formatShortDate() helper as the rest of this file (en-US default).
    const expected = new Date("2026-06-01").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it("renders the date answer using the French locale when i18n.language starts with fr", () => {
    mockLanguage = "fr-FR"
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />)

    const expected = new Date("2026-06-01").toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('shows "No answer provided" for an unanswered question', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection({ questionAnswers: [] }) },
    })

    render(<InspectionReport />)

    expect(
      screen.getAllByText("organization.inspection.noAnswerProvided").length
    ).toBe(3)
    expect(screen.getByText("0/3")).toBeInTheDocument()
  })

  it("links each action only to its own matching question, not to others", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          actions: [
            {
              _id: "act-1",
              question: "Extinguisher present?",
              actionTitle: "Replace tag",
              priority: "high",
              state: "To do",
              dueDate: "2026-07-01T00:00:00.000Z",
            },
            {
              _id: "act-2",
              question: "Condition rating",
              actionTitle: "Recheck condition",
              priority: "low",
              state: "To do",
              dueDate: "2026-07-02T00:00:00.000Z",
            },
          ],
        }),
      },
    })

    render(<InspectionReport />)

    const extinguisherCard = screen
      .getByText("Extinguisher present?")
      .closest<HTMLDivElement>("div.rounded-xl")!
    const conditionCard = screen
      .getByText("Condition rating")
      .closest<HTMLDivElement>("div.rounded-xl")!

    // Each question's card shows only its own action chip, not the other question's
    expect(
      within(extinguisherCard).getByText("Replace tag")
    ).toBeInTheDocument()
    expect(
      within(extinguisherCard).queryByText("Recheck condition")
    ).not.toBeInTheDocument()
    expect(
      within(conditionCard).getByText("Recheck condition")
    ).toBeInTheDocument()
    expect(
      within(conditionCard).queryByText("Replace tag")
    ).not.toBeInTheDocument()
  })

  it("does not attach an action to any question when its question text matches none", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          actions: [
            {
              _id: "act-3",
              question: "Some unrelated question not in this template",
              actionTitle: "Orphan action",
              priority: "medium",
              state: "To do",
              dueDate: "2026-07-03T00:00:00.000Z",
            },
          ],
        }),
      },
    })

    render(<InspectionReport />)

    const extinguisherCard = screen
      .getByText("Extinguisher present?")
      .closest<HTMLDivElement>("div.rounded-xl")!
    const conditionCard = screen
      .getByText("Condition rating")
      .closest<HTMLDivElement>("div.rounded-xl")!

    expect(
      within(extinguisherCard).queryByText("Orphan action")
    ).not.toBeInTheDocument()
    expect(
      within(conditionCard).queryByText("Orphan action")
    ).not.toBeInTheDocument()
  })

  it("renders inspection-level attachments as download links", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          attachments: ["https://cdn.example.com/site-plan.pdf"],
        }),
      },
    })

    render(<InspectionReport />)

    expect(
      screen.getByRole("heading", {
        name: "organization.inspection.attachments",
      })
    ).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "site-plan.pdf" })
    expect(link).toHaveAttribute(
      "href",
      "https://cdn.example.com/site-plan.pdf"
    )
  })

  it("does not crash on an attachment URL with a malformed percent-escape", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          attachments: ["https://cdn.example.com/100%off.pdf"],
        }),
      },
    })

    expect(() => render(<InspectionReport />)).not.toThrow()
    expect(screen.getByText("100%off.pdf")).toBeInTheDocument()
  })

  it("does not render an Attachments section when there are none", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection({ attachments: [] }) },
    })

    render(<InspectionReport />)

    expect(
      screen.queryByRole("heading", {
        name: "organization.inspection.attachments",
      })
    ).not.toBeInTheDocument()
  })

  it("renders the unsplit text section when present", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          unSplitText: "Raw inspection transcript here.",
        }),
      },
    })

    render(<InspectionReport />)

    expect(
      screen.getByText("organization.inspection.unsplitText")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Raw inspection transcript here.")
    ).toBeInTheDocument()
  })

  it("opens and closes the media lightbox when a question media thumbnail is clicked", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: {
            templateName: "Fire Safety Audit",
            pages: [
              {
                title: "General",
                questions: [
                  { id: "q-4", question: "Site photo", answerType: "input" },
                ],
              },
            ],
          },
          // mediaFiles (attachments) are separate from the answer itself
          questionAnswers: [
            {
              questionId: "q-4",
              answer: "Looks fine",
              note: "",
              mediaFiles: [
                { url: "https://cdn.example.com/photo.jpg", type: "image" },
              ],
            },
          ],
        }),
      },
    })

    render(<InspectionReport />)
    expect(
      screen.queryByText("organization.inspection.mediaPreview")
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /media-0/i }))
    expect(
      screen.getByText("organization.inspection.mediaPreview")
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.closeMediaPreview",
      })
    )
    expect(
      screen.queryByText("organization.inspection.mediaPreview")
    ).not.toBeInTheDocument()
  })

  // aexa-frontend#499 -- the lightbox <img> had hardcoded English alt="preview"
  // instead of going through t(), unlike every other alt/label string in this
  // file (uploadedMediaAlt, closeMediaPreview).
  it("routes the lightbox image's alt text through i18n instead of a hardcoded string", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: {
            templateName: "Fire Safety Audit",
            pages: [
              {
                title: "General",
                questions: [
                  { id: "q-4", question: "Site photo", answerType: "input" },
                ],
              },
            ],
          },
          questionAnswers: [
            {
              questionId: "q-4",
              answer: "Looks fine",
              note: "",
              mediaFiles: [
                { url: "https://cdn.example.com/photo.jpg", type: "image" },
              ],
            },
          ],
        }),
      },
    })

    render(<InspectionReport />)
    await userEvent.click(screen.getByRole("button", { name: /media-0/i }))

    expect(
      screen.getByAltText("organization.inspection.uploadedMediaAlt")
    ).toBeInTheDocument()
    expect(screen.queryByAltText("preview")).not.toBeInTheDocument()
  })

  // aexa-frontend#490 -- the media lightbox was a plain div with no
  // role="dialog", no aria-modal and no Escape handling, unlike KRI's
  // modals (round 10, #487).
  it("marks the media lightbox as a labeled dialog and closes it on Escape", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: {
            templateName: "Fire Safety Audit",
            pages: [
              {
                title: "General",
                questions: [
                  { id: "q-4", question: "Site photo", answerType: "input" },
                ],
              },
            ],
          },
          questionAnswers: [
            {
              questionId: "q-4",
              answer: "Looks fine",
              note: "",
              mediaFiles: [
                { url: "https://cdn.example.com/photo.jpg", type: "image" },
              ],
            },
          ],
        }),
      },
    })

    render(<InspectionReport />)
    await userEvent.click(screen.getByRole("button", { name: /media-0/i }))

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAccessibleName("organization.inspection.mediaPreview")

    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens a media answer's full-size view without granting the new tab window.opener access (#110)", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
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
                    id: "q-5",
                    question: "Uploaded photo",
                    answerType: "media",
                  },
                ],
              },
            ],
          },
          questionAnswers: [
            {
              questionId: "q-5",
              answer: "https://cdn.example.com/uploaded-photo.jpg",
              note: "",
              mediaFiles: [],
            },
          ],
        }),
      },
    })

    render(<InspectionReport />)

    await userEvent.click(
      screen.getByText("organization.inspection.viewFullSize")
    )

    expect(openSpy).toHaveBeenCalledWith(
      "https://cdn.example.com/uploaded-photo.jpg",
      "_blank",
      "noopener,noreferrer"
    )

    openSpy.mockRestore()
  })
})
