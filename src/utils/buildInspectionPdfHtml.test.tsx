import { buildInspectionPdfHtml } from "./buildInspectionPdfHtml"

function baseOptions(overrides: Partial<Parameters<typeof buildInspectionPdfHtml>[0]> = {}) {
  return {
    inspectionId: "insp-12345678",
    templateName: "Fire Safety Audit",
    siteName: "Main Warehouse",
    status: "COMPLETED",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    templatePages: [],
    questionAndAnswers: [],
    actions: [],
    ...overrides,
  }
}

describe("buildInspectionPdfHtml (ticket #63)", () => {
  it("does not throw when questionAndAnswers carry a nested question object, not a top-level string", () => {
    // Real QuestionAnswer shape (src/types/inspection.ts): `question` is
    // { id, question, answerType, value }, not a plain string — matching by
    // `.question.trim()` used to throw at runtime.
    const options = baseOptions({
      templatePages: [
        {
          title: "Section 1",
          questions: [{ id: "q1", question: "Are exits clear?", answerType: "checkbox" }],
        },
      ],
      questionAndAnswers: [
        {
          questionId: "q1",
          answer: true,
          note: "",
          mediaFiles: [],
          question: { id: "q1", question: "Are exits clear?", answerType: "checkbox", value: null },
        },
      ],
    })

    expect(() => buildInspectionPdfHtml(options)).not.toThrow()
  })

  it("matches answers to questions by questionId and renders the real answer, not a blank", () => {
    const html = buildInspectionPdfHtml(
      baseOptions({
        templatePages: [
          {
            title: "Section 1",
            questions: [{ id: "q1", question: "Are exits clear?", answerType: "checkbox" }],
          },
        ],
        questionAndAnswers: [
          {
            questionId: "q1",
            answer: true,
            note: "",
            mediaFiles: [],
            question: { id: "q1", question: "Are exits clear?", answerType: "checkbox", value: null },
          },
        ],
      })
    )

    expect(html).toContain("Yes")
    expect(html).not.toContain("No answer provided")
  })

  it("shows 'No answer provided' when nothing matches the questionId", () => {
    const html = buildInspectionPdfHtml(
      baseOptions({
        templatePages: [
          {
            title: "Section 1",
            questions: [{ id: "q1", question: "Are exits clear?", answerType: "input" }],
          },
        ],
        questionAndAnswers: [],
      })
    )

    expect(html).toContain("No answer provided")
  })

  it("reads answerType as a plain string, not a nested { answerType } object, so a slider renders as a slider not plain text", () => {
    const html = buildInspectionPdfHtml(
      baseOptions({
        templatePages: [
          {
            title: "Section 1",
            questions: [{ id: "q1", question: "Rate cleanliness", answerType: "slider" }],
          },
        ],
        questionAndAnswers: [
          {
            questionId: "q1",
            answer: 80,
            note: "",
            mediaFiles: [],
            question: { id: "q1", question: "Rate cleanliness", answerType: "slider", value: null },
          },
        ],
      })
    )

    // The slider renderer draws a 0/value/100 scale; the default (input) renderer would not.
    expect(html).toContain(">80<")
    expect(html).toContain(">0<")
    expect(html).toContain(">100<")
  })

  it("matches related actions to their question by question text, mirroring InspectionReport.tsx's own actionsByQuestion grouping", () => {
    const html = buildInspectionPdfHtml(
      baseOptions({
        templatePages: [
          {
            title: "Section 1",
            questions: [{ id: "q1", question: "Are exits clear?", answerType: "input" }],
          },
        ],
        actions: [
          {
            _id: "a1",
            actionTitle: "Clear the north exit",
            priority: "High",
            state: "To do",
            question: "Are exits clear?",
          },
          {
            _id: "a2",
            actionTitle: "Unrelated finding",
            priority: "Low",
            state: "Completed",
            question: "Some other question",
          },
        ],
      })
    )

    expect(html).toContain("Clear the north exit")
    expect(html).toContain("Related Actions (1)")
  })

  it("does not crash when orgName is omitted", () => {
    expect(() => buildInspectionPdfHtml(baseOptions())).not.toThrow()
  })

  it("escapes HTML in question text, notes, and action titles instead of injecting them raw into the report frame (review fix)", () => {
    // buildInspectionPdfHtml's output is assigned to an iframe's `srcdoc` and
    // actually parsed as HTML (see renderHtmlToPdf) — unlike JSX, nothing
    // escapes this for us. Question text, notes, and action titles are
    // org-authored content typed elsewhere in the app.
    const html = buildInspectionPdfHtml(
      baseOptions({
        siteName: '<img src=x onerror="alert(1)">',
        templatePages: [
          {
            title: '<script>alert("page")</script>',
            questions: [
              {
                id: "q1",
                question: '<script>alert("question")</script>',
                answerType: "input",
              },
            ],
          },
        ],
        questionAndAnswers: [
          {
            questionId: "q1",
            answer: '<img src=x onerror="alert(2)">',
            note: '<script>alert("note")</script>',
            mediaFiles: [],
            question: { id: "q1", question: "x", answerType: "input", value: null },
          },
        ],
        actions: [
          {
            _id: "a1",
            actionTitle: '<script>alert("action")</script>',
            priority: "High",
            state: "To do",
            question: '<script>alert("question")</script>',
          },
        ],
      })
    )

    expect(html).not.toContain("<script>alert")
    expect(html).not.toContain("<img src=x onerror")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&lt;img src=x onerror")
  })

  it("escapes templateDisc on the cover page (round-2 review fix — missed in the first escaping pass)", () => {
    const html = buildInspectionPdfHtml(
      baseOptions({ templateDisc: '<script>alert("desc")</script>' })
    )

    expect(html).not.toContain("<script>alert")
    expect(html).toContain("&lt;script&gt;")
  })

  it("escapes a slider answer instead of interpolating it raw into markup and a CSS width value (round-2 review fix)", () => {
    const html = buildInspectionPdfHtml(
      baseOptions({
        templatePages: [
          {
            title: "Section 1",
            questions: [{ id: "q1", question: "Rate cleanliness", answerType: "slider" }],
          },
        ],
        questionAndAnswers: [
          {
            questionId: "q1",
            answer: '"><script>alert("slider")</script>',
            note: "",
            mediaFiles: [],
            question: { id: "q1", question: "Rate cleanliness", answerType: "slider", value: null },
          },
        ],
      })
    )

    expect(html).not.toContain("<script>alert")
    expect(html).toContain("&lt;script&gt;")
  })
})
