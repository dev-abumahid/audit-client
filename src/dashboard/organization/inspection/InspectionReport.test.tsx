import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import InspectionReport from "./InspectionReport"

// aexa-frontend#552: the site label is now a real <Link>, so every render()
// needs a Router context.
const withRouter = { wrapper: MemoryRouter }

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
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<InspectionReport />, withRouter)

    // i18n isn't initialized in the test environment, so t() echoes the raw
    // key back (see RiskRegisterPage.test.tsx for the same convention).
    expect(
      screen.getByText("organization.inspection.loadingReport")
    ).toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 5, resilience finding): this
  // query never checked isLoading/isError, so a genuine fetch failure fell
  // through to the same "loading" branch forever -- live-confirmed via a
  // real 404 that just kept showing "Loading report..." indefinitely.
  it("shows a real error state, not a permanent loading state, on a genuine fetch failure", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })

    render(<InspectionReport />, withRouter)

    expect(
      screen.queryByText("organization.inspection.loadingReport")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "organization.inspection.reportLoadError"
    )
    expect(
      screen.getByRole("button", {
        name: "organization.inspection.backToInspections",
      })
    ).toBeInTheDocument()
  })

  it("shows a not-found state, not a permanent loading state, when the query succeeds with no data", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })

    render(<InspectionReport />, withRouter)

    expect(
      screen.queryByText("organization.inspection.loadingReport")
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("organization.inspection.notFound")
    ).toBeInTheDocument()
  })

  it("renders the header with status, template name, site and stats", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />, withRouter)

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

  // quality-bar-loop (Inspections, round 13, mobile finding): this
  // button measured 159x40px live, under the 44px touch-target guideline
  // -- the primary action of the whole report page.
  it("gives the Download PDF button a 44px touch target", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />, withRouter)

    expect(
      screen.getByRole("button", {
        name: "organization.inspection.downloadPdf",
      }).className
    ).toMatch(/\bh-11\b/)
  })

  // aexa-frontend#552: the site label was plain text even though
  // inspection.site.id was already available -- reuses the established
  // ?siteId=&search= pattern (#533/#541) since SitesEntities has no
  // per-site detail route.
  it("links the site label into Sites, scoped to that site", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />, withRouter)

    const link = screen.getByRole("link", { name: "HQ Casablanca" })
    expect(link).toHaveAttribute(
      "href",
      "/organization/sites?siteId=site-1&search=HQ%20Casablanca"
    )
  })

  // Regression (aexa-frontend round-9 audit #463): the page h1 (report
  // title) was followed directly by an h3 (each template page's title, e.g.
  // "General"), with no h2 anywhere in between. Page titles are now h2,
  // siblings of the Attachments/Unsplit Text section h2s.
  it("keeps a valid heading hierarchy: page title is h2, not h3, right after the h1", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />, withRouter)

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

    render(<InspectionReport />, withRouter)

    expect(screen.getByText("organization.inspection.yes")).toBeInTheDocument()
    expect(screen.getByText("Checked twice")).toBeInTheDocument()
  })

  it("renders the slider value and the locale-formatted date answer", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />, withRouter)

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

    render(<InspectionReport />, withRouter)

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

    render(<InspectionReport />, withRouter)

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

    render(<InspectionReport />, withRouter)

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

    render(<InspectionReport />, withRouter)

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

    render(<InspectionReport />, withRouter)

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

  // quality-bar-loop (Inspections, round 3, security finding, review
  // follow-up): the backend already validates attachments' scheme on
  // write, but a pre-existing record from before that check landed could
  // still carry an unsafe value.
  it("refuses to render an inspection-level attachment with a non-http(s) scheme as a link", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          attachments: ["javascript:alert(1)"],
        }),
      },
    })

    render(<InspectionReport />, withRouter)

    expect(
      screen.getByText("organization.inspection.unsafeAttachment")
    ).toBeInTheDocument()
    expect(
      document.querySelector('[href^="javascript:"]')
    ).not.toBeInTheDocument()
  })

  it("does not crash on an attachment URL with a malformed percent-escape", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          attachments: ["https://cdn.example.com/100%off.pdf"],
        }),
      },
    })

    expect(() => render(<InspectionReport />, withRouter)).not.toThrow()
    expect(screen.getByText("100%off.pdf")).toBeInTheDocument()
  })

  it("does not render an Attachments section when there are none", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection({ attachments: [] }) },
    })

    render(<InspectionReport />, withRouter)

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

    render(<InspectionReport />, withRouter)

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

    render(<InspectionReport />, withRouter)
    expect(
      screen.queryByText("organization.inspection.mediaPreview")
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "organization.inspection.mediaThumbnailAlt" }))
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

  // quality-bar-loop (Inspections, round 13, mobile finding): this
  // hand-rolled lightbox close button measured 28x28px live -- it's not
  // built on the shared Dialog component, so it never got the app-wide
  // 44px close-button fix applied there.
  it("gives the media lightbox close button a 44px touch target", async () => {
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
                    id: "q-4",
                    question: "Photo",
                    answerType: "input",
                    isRequired: false,
                  },
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

    render(<InspectionReport />, withRouter)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.inspection.mediaThumbnailAlt",
      })
    )

    const closeButton = screen.getByRole("button", {
      name: "organization.inspection.closeMediaPreview",
    })
    expect(closeButton.className).toMatch(/\bh-11\b/)
    expect(closeButton.className).toMatch(/\bw-11\b/)
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

    render(<InspectionReport />, withRouter)
    await userEvent.click(screen.getByRole("button", { name: "organization.inspection.mediaThumbnailAlt" }))

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

    render(<InspectionReport />, withRouter)
    await userEvent.click(screen.getByRole("button", { name: "organization.inspection.mediaThumbnailAlt" }))

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAccessibleName("organization.inspection.mediaPreview")

    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  // Round 14 (#515): the secondary "additional media files" thumbnail grid
  // and the Media Lightbox it opens always rendered <img>, even for
  // video/PDF uploads -- distinct from the primary per-question media
  // renderer round 13 (#507) already fixed.
  describe("additional media files thumbnails and lightbox branch on file type (#515)", () => {
    function renderWithMedia(mediaUrl: string) {
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
                mediaFiles: [{ url: mediaUrl, type: "image" }],
              },
            ],
          }),
        },
      })
      return render(<InspectionReport />, withRouter)
    }

    it("renders a video media file as a <video> thumbnail and a <video controls> lightbox, not a broken <img>", async () => {
      renderWithMedia("https://cdn.example.com/clip.mp4")

      expect(document.querySelector("video")).toBeInTheDocument()
      expect(document.querySelector("img")).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole("button", { name: "organization.inspection.mediaThumbnailAlt" }))

      const lightboxVideo = screen.getByText(
        "organization.inspection.mediaPreview"
      )
        .closest('[role="dialog"]')!
        .querySelector("video")
      expect(lightboxVideo).toBeInTheDocument()
      expect(lightboxVideo).toHaveAttribute("controls")
    })

    it("renders a PDF media file as a document icon thumbnail and a link in the lightbox, not a broken <img>", async () => {
      renderWithMedia("https://cdn.example.com/report.pdf")

      expect(document.querySelector("img")).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole("button", { name: "organization.inspection.mediaThumbnailAlt" }))

      const link = screen.getByRole("link", { name: /report\.pdf/ })
      expect(link).toHaveAttribute("href", "https://cdn.example.com/report.pdf")
      expect(document.querySelector("img")).not.toBeInTheDocument()
    })
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

    render(<InspectionReport />, withRouter)

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

  // quality-bar-loop (Inspections, round 7, accessibility finding): this
  // hover-only reveal control had no focus-visible counterpart -- a
  // keyboard user tabbing to it saw no affordance since it stayed
  // invisible until :hover.
  it("reveals the view-full-size control on keyboard focus, not just hover", () => {
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

    render(<InspectionReport />, withRouter)

    const viewButton = screen.getByText(
      "organization.inspection.viewFullSize"
    )
    expect(viewButton.closest("button")?.className).toMatch(
      /\bgroup-focus-within:opacity-100\b/
    )
  })

  // Round 13 (#507): the "media" answer renderer unconditionally rendered
  // an <img>, even though UpdateInspection.tsx's upload input for this same
  // answer type accepts "image/*,video/*,application/pdf" -- a video or
  // PDF answer silently fell through to the broken-image placeholder.
  function makeMediaReportInspection(mediaUrl: string) {
    return makeInspection({
      template: {
        templateName: "Fire Safety Audit",
        pages: [
          {
            title: "General",
            questions: [
              {
                id: "q-5",
                question: "Uploaded evidence",
                answerType: "media",
              },
            ],
          },
        ],
      },
      questionAnswers: [
        {
          questionId: "q-5",
          answer: mediaUrl,
          note: "",
          mediaFiles: [],
        },
      ],
    })
  }

  it("renders a video answer with a real <video controls> element, not a broken <img>", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeMediaReportInspection("https://cdn.example.com/clip.mp4"),
      },
    })

    render(<InspectionReport />, withRouter)

    const video = document.querySelector("video")
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute("controls")
    expect(document.querySelector("img")).not.toBeInTheDocument()
  })

  it("renders a PDF answer as a link to open it, not a broken <img>", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeMediaReportInspection("https://cdn.example.com/report.pdf"),
      },
    })

    render(<InspectionReport />, withRouter)

    const link = screen.getByRole("link", { name: /report\.pdf/ })
    expect(link).toHaveAttribute("href", "https://cdn.example.com/report.pdf")
    expect(link).toHaveAttribute("target", "_blank")
    expect(document.querySelector("img")).not.toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 3, security finding): `answer` is
  // client-supplied and gets rendered straight into <img src>/<a href>/
  // window.open for "media" questions -- a javascript:/data: value must
  // never reach one of those sinks, regardless of how it got stored.
  it("refuses to render a media answer with a non-http(s) scheme into an img/href/window.open sink", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeMediaReportInspection("javascript:alert(1)"),
      },
    })

    render(<InspectionReport />, withRouter)

    expect(
      screen.getByText("organization.inspection.unsafeAttachment")
    ).toBeInTheDocument()
    expect(document.querySelector("img")).not.toBeInTheDocument()
    expect(document.querySelector("video")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /alert/i })
    ).not.toBeInTheDocument()
    expect(
      document.querySelector('[href^="javascript:"]')
    ).not.toBeInTheDocument()
  })

  // Round 14 (#515): the sections sidebar had no <nav aria-label> and its
  // buttons had no aria-current, unlike SectionNavigator.tsx (which was
  // originally extracted from this exact pattern but never backported the
  // improvement here).
  it("wraps the sections list in a labeled <nav> and marks the active section with aria-current", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection() },
    })

    render(<InspectionReport />, withRouter)

    const nav = screen.getByRole("navigation", {
      name: "organization.inspection.sections",
    })
    const activeButton = within(nav).getByText("General").closest("button")!
    expect(activeButton).toHaveAttribute("aria-current", "true")
  })
})
