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

  it("renders a Yes badge for a truthy checkbox answer and shows its note", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />)

    expect(screen.getByText("organization.inspection.yes")).toBeInTheDocument()
    expect(screen.getByText("Checked twice")).toBeInTheDocument()
  })

  it("renders the slider value and the formatted date answer", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />)

    expect(screen.getByText("7")).toBeInTheDocument()
    expect(
      screen.getByText(new Date("2026-06-01").toLocaleDateString())
    ).toBeInTheDocument()
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

    expect(
      screen.getByRole("heading", {
        name: "organization.inspection.colActions",
      })
    ).toBeInTheDocument()
    // Count badge next to the "Actions" heading (separate element, not concatenated text)
    expect(
      screen.getByText("2", { selector: "span.bg-orange-100" })
    ).toBeInTheDocument()
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
    // Still shows up in the actions table, just not attached to any question card
    expect(screen.getByText("Orphan action")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        name: "organization.inspection.colActions",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText("1", { selector: "span.bg-orange-100" })
    ).toBeInTheDocument()
  })

  // aexa-frontend#339: the Actions table's due-date column used a module-
  // level formatShortDate() hardcoded to toLocaleDateString("en-US", ...),
  // ignoring the app's selected language. Now goes through the shared
  // formatLocaleDate helper (round 3, aexa-frontend#339's original fix for
  // other call sites).
  describe("locale-aware Actions table due-date formatting (#339)", () => {
    function makeActionsInspection() {
      return makeInspection({
        actions: [
          {
            _id: "act-1",
            question: "Extinguisher present?",
            actionTitle: "Replace tag",
            priority: "high",
            state: "To do",
            dueDate: "2026-07-01T00:00:00.000Z",
          },
        ],
      })
    }

    it("formats the due date using the French locale when i18n.language starts with fr", () => {
      mockLanguage = "fr-FR"
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: makeActionsInspection() },
      })

      render(<InspectionReport />)

      const expected = new Date("2026-07-01T00:00:00.000Z").toLocaleDateString(
        "fr-FR",
        { year: "numeric", month: "short", day: "numeric" }
      )
      expect(screen.getByText(expected)).toBeInTheDocument()
    })

    it("formats the due date using the English locale by default", () => {
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: makeActionsInspection() },
      })

      render(<InspectionReport />)

      const expected = new Date("2026-07-01T00:00:00.000Z").toLocaleDateString(
        "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      )
      expect(screen.getByText(expected)).toBeInTheDocument()
    })
  })

  it("renders the actions table and navigates when a row is clicked", async () => {
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
          ],
        }),
      },
    })

    render(<InspectionReport />)
    await userEvent.click(screen.getByRole("row", { name: /replace tag/i }))

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/single-action/act-1")
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

    await userEvent.click(screen.getByRole("button", { name: "×" }))
    expect(
      screen.queryByText("organization.inspection.mediaPreview")
    ).not.toBeInTheDocument()
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
