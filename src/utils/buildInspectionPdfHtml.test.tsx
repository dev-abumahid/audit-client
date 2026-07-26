import {
  buildInspectionPdfHtml,
  buildTemplatePdfHtml,
  type PdfLabels,
} from "./buildInspectionPdfHtml"

// Mirrors the English strings the real caller (InspectionReport.tsx's
// downloadPdf) resolves via t() — kept in sync with src/i18n/locales/en.json's
// organization.inspection.* keys so existing assertions on rendered English
// text ("No answer provided", "Related Actions (1)", etc.) still hold.
const enLabels: PdfLabels = {
  section: (num) => `Section ${num}`,
  sectionOfTotal: (num, total) => `Section ${num} of ${total}`,
  generatedOn: (date) => `Generated on ${date}`,
  actionsCount: (count) => `Actions (${count})`,
  relatedActionsCount: (count) => `Related Actions (${count})`,
  mediaFilesAttached: (count) => `${count} media file(s) attached`,
  organizationName: "Organization Name:",
  authorName: "Author Name:",
  date: "Date:",
  site: "Site:",
  status: "Status:",
  reportId: "Report ID:",
  type: "Type:",
  answer: "Answer",
  noAnswerPlaceholder: "Answer:",
  noAnswerProvided: "No answer provided",
  approvalSignOff: "Approval &amp; Sign-off",
  colAuthorizedSignature: "Authorized Signature",
  colSignature: "Signature",
  colDate: "Date",
  colPrintName: "Print Name",
  colPositionTitle: "Position/Title",
  colTitle: "Title",
  colPriority: "Priority",
  colDueDate: "Due Date",
  colQuestion: "Question",
  colStatus: "Status",
  signOffDisclaimerTemplate:
    "Note: By signing this document, you acknowledge that you have reviewed and approved the contents of this template.",
  signOffDisclaimerInspection:
    "By signing this document you acknowledge that you have reviewed and approved the contents of this inspection report.",
  reportTitleFallback: "Inspection Report",
  yes: "Yes",
  no: "No",
}

// A second, deliberately distinct set of label values — used to prove the
// builder actually renders whatever `labels` it's given (i.e. localizes),
// rather than falling back to hardcoded English internally.
const frLikeLabels: PdfLabels = {
  ...enLabels,
  section: (num) => `Section FR ${num}`,
  noAnswerProvided: "Aucune réponse fournie",
  approvalSignOff: "Approbation et signature",
  relatedActionsCount: (count) => `Actions liées (${count})`,
}

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
    labels: enLabels,
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

    // The slider renderer draws a 0/value/10 scale (matching the live in-app view); the default (input) renderer would not.
    expect(html).toContain(">80<")
    expect(html).toContain(">0<")
    expect(html).toContain(">10<")
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

  it("escapes logoBase64 instead of interpolating it raw into the img src attribute", () => {
    const html = buildInspectionPdfHtml(
      baseOptions({ logoBase64: '"><script>alert("logo")</script>' })
    )

    expect(html).not.toContain("<script>alert")
    expect(html).toContain("&lt;script&gt;")
  })
})

// The blank-template preview builder shares buildInspectionPdfHtml's
// iframe-srcdoc mechanism (see file-level comment on escapeHtml) but had
// never had escaping applied — found during the 2026-07-16 audit sweep.
function baseTemplateOptions(
  overrides: Partial<Parameters<typeof buildTemplatePdfHtml>[0]> = {}
) {
  return {
    templateName: "Fire Safety Audit",
    userName: "Acme Org",
    createdAt: "2026-07-01",
    pages: [],
    labels: enLabels,
    ...overrides,
  }
}

describe("buildTemplatePdfHtml (phase-1 sweep, 2026-07-16)", () => {
  it("escapes HTML in templateName, templateDisc, userName, and question/answer text instead of injecting them raw", () => {
    const html = buildTemplatePdfHtml(
      baseTemplateOptions({
        templateName: '<script>alert("name")</script>',
        templateDisc: '<script>alert("desc")</script>',
        userName: '<img src=x onerror="alert(1)">',
        pages: [
          {
            title: '<script>alert("page")</script>',
            questions: [
              {
                question: '<script>alert("question")</script>',
                answerType: { value: "input" },
                answer: '<img src=x onerror="alert(2)">',
              },
            ],
          },
        ],
      })
    )

    expect(html).not.toContain("<script>alert")
    expect(html).not.toContain("<img src=x onerror")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&lt;img src=x onerror")
  })

  it("does not throw and does not inject raw markup when pages is empty", () => {
    expect(() => buildTemplatePdfHtml(baseTemplateOptions())).not.toThrow()
  })

  it("escapes logoBase64 instead of interpolating it raw into the img src attribute", () => {
    const html = buildTemplatePdfHtml(
      baseTemplateOptions({ logoBase64: '"><script>alert("logo")</script>' })
    )

    expect(html).not.toContain("<script>alert")
    expect(html).toContain("&lt;script&gt;")
  })
})

describe("PDF label localization (issue #187)", () => {
  it("buildInspectionPdfHtml renders the passed-in labels, not hardcoded English", () => {
    const html = buildInspectionPdfHtml(
      baseOptions({
        templatePages: [
          {
            title: "Section 1",
            questions: [{ id: "q1", question: "Are exits clear?", answerType: "input" }],
          },
        ],
        questionAndAnswers: [],
        actions: [
          {
            _id: "a1",
            actionTitle: "Clear the north exit",
            priority: "High",
            state: "To do",
            question: "Are exits clear?",
          },
        ],
        labels: frLikeLabels,
      })
    )

    expect(html).toContain("Aucune réponse fournie")
    expect(html).toContain("Actions liées (1)")
    expect(html).toContain("Approbation et signature")
    expect(html).not.toContain("No answer provided")
    expect(html).not.toContain("Related Actions (1)")
    expect(html).not.toContain("Approval &amp; Sign-off")
  })

  it("buildTemplatePdfHtml renders the passed-in labels, not hardcoded English", () => {
    const html = buildTemplatePdfHtml(
      baseTemplateOptions({
        pages: [
          {
            title: "Section 1",
            questions: [
              {
                question: "Are extinguishers charged?",
                answerType: { value: "input" },
                answer: "",
              },
            ],
          },
        ],
        labels: frLikeLabels,
      })
    )

    expect(html).toContain("Approbation et signature")
    expect(html).not.toContain("Approval &amp; Sign-off")
  })
})
