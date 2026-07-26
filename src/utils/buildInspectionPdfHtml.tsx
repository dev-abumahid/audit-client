/* eslint-disable @typescript-eslint/no-explicit-any */

const PRIMARY = "#6ec075"

// ─── Shared helpers ────────────────────────────────────────────────────────────

// This HTML string gets assigned to an iframe's `srcdoc` and actually parsed
// as a real document (see renderHtmlToPdf in InspectionReport.tsx) — unlike
// JSX, which auto-escapes, nothing here does that for us. Question text,
// notes, and action titles are org-authored content already displayed
// elsewhere in the app, but this is the one place it flows into a raw HTML
// string; escape anything that isn't a value we constructed ourselves.
const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  )

// ─── Labels ────────────────────────────────────────────────────────────────────
//
// This file is a plain function module (no React, no `useTranslation`), so it
// cannot resolve i18n keys itself. Every user-visible string is instead passed
// in by the caller (which does have `t()` access) via this shared `PdfLabels`
// shape. Both builders below accept the same shape rather than two divergent
// ones, since several labels genuinely overlap ("Section N", "Answer", the
// sign-off table columns) — see src/dashboard/organization/inspection/InspectionReport.tsx
// for the real call site building this object with `t()`.
//
// Strings with an interpolated value (section number, generated-at date,
// counts) are resolved functions rather than raw strings: the number/date is
// only known inside the builder's loops, so the caller hands over a closure
// like `(n) => t("organization.inspection.section", { num: n })` instead of a
// pre-baked string.
//
// Labels are interpolated into the HTML raw, NOT passed through escapeHtml
// above — deliberately, not an oversight. escapeHtml exists for org-authored
// content (question text, notes, action titles) that could contain anything;
// labels are translator-controlled strings from en.json/fr.json, not user
// input, so there's nothing here for escapeHtml to guard against.
export interface PdfLabels {
  /** "Section {{num}}" — bare per-page marker (template PDF breadcrumb). */
  section: (num: number) => string
  /** "Section {{num}} of {{total}}" — per-page marker with a total page count
   * (template PDF footer; inspection PDF breadcrumb + footer). */
  sectionOfTotal: (num: number, total: number) => string
  /** "Generated on {{date}}" (both footers). */
  generatedOn: (date: string) => string
  /** "Actions ({{count}})" (inspection PDF actions-page heading). */
  actionsCount: (count: number) => string
  /** "Related Actions ({{count}})" (inspection PDF per-question actions). */
  relatedActionsCount: (count: number) => string
  /** "{{count}} media file(s) attached" (inspection PDF per-question media note). */
  mediaFilesAttached: (count: number) => string
  organizationName: string
  authorName: string
  date: string
  site: string
  status: string
  reportId: string
  type: string
  /** "Answer" — heading above the answer box (inspection PDF). */
  answer: string
  /** "Answer:" — template PDF's placeholder text shown when a question has
   * no answer yet (pre-existing template-preview behavior, unchanged here). */
  noAnswerPlaceholder: string
  /** "No answer provided" (inspection PDF's empty-answer state). */
  noAnswerProvided: string
  approvalSignOff: string
  colAuthorizedSignature: string
  colSignature: string
  colDate: string
  colPrintName: string
  colPositionTitle: string
  colTitle: string
  colPriority: string
  colDueDate: string
  colQuestion: string
  colStatus: string
  signOffDisclaimerTemplate: string
  signOffDisclaimerInspection: string
  /** "Yes" / "No" — checkbox answer rendering (inspection PDF). */
  yes: string
  no: string
  /** "Inspection Report" — fallback title when templateName is empty. */
  reportTitleFallback: string
}

const sharedCss = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 0; size: A4; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    background: #fff;
    color: #111827;
    width: 210mm;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
  }
  .page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
`

const breadcrumb = (title: string, pageNum: number, labels: PdfLabels) => `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
    <span style="font-size:12px;color:${PRIMARY};font-weight:600;border-bottom:2px solid ${PRIMARY};padding-bottom:2px;">
      ${title}
    </span>
    <span style="font-size:12px;color:#9ca3af;white-space:nowrap;">${labels.section(pageNum)}</span>
  </div>
`

const footer = (
  title: string,
  pageNum: number,
  totalPages: number,
  generatedAt: string,
  labels: PdfLabels
) => `
  <div style="
    margin:0 32px 24px;padding-top:10px;
    border-top:1px solid #e5e7eb;
    display:flex;justify-content:space-between;
    font-size:10px;color:#9ca3af;
  ">
    <span>${title}</span>
    <span>${labels.generatedOn(generatedAt)}&nbsp;&nbsp;${labels.sectionOfTotal(pageNum, totalPages)}</span>
  </div>
`

const wrapHtml = (body: string) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>${sharedCss}</style>
    </head>
    <body>${body}</body>
  </html>
`

// ─── 1. TEMPLATE PDF (DescribeMainContent) ────────────────────────────────────

export interface TemplatePdfOptions {
  templateName: string
  templateDisc?: string
  userName: string
  createdAt: string
  pages: any[]
  logoBase64?: string | null
  labels: PdfLabels
}

export const buildTemplatePdfHtml = ({
  templateName,
  templateDisc = "",
  userName,
  createdAt,
  pages,
  logoBase64,
  labels,
}: TemplatePdfOptions): string => {
  const generatedAt = new Date()
    .toISOString()
    .replace("T", " ")
    .substring(0, 19)
  const totalPages = pages.length + 2
  const safeTemplateName = escapeHtml(templateName)
  const initial = escapeHtml(templateName.trim().charAt(0).toUpperCase() || "M")

  const logoHtml = logoBase64
    ? `<img src="${escapeHtml(logoBase64)}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:16px;" />`
    : `<span style="font-size:64px;font-weight:800;color:${PRIMARY};">${initial}</span>`

  // Cover
  const coverPage = `
    <div class="page" style="background-color:${PRIMARY};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 40px;text-align:center;">
      <div style="width:120px;height:120px;background:#fff;border-radius:20px;display:flex;align-items:center;justify-content:center;margin-bottom:36px;overflow:hidden;">
        ${logoHtml}
      </div>
      <h1 style="font-size:32px;font-weight:800;color:#fff;line-height:1.25;max-width:560px;margin:0 0 18px;">
        ${safeTemplateName}
      </h1>
      <p style="font-size:14px;color:#fff;opacity:0.9;max-width:480px;line-height:1.75;margin:0 0 40px;text-align:justify;">
        ${escapeHtml(templateDisc.slice(0, 200))}
      </p>
      <div style="background:#fff;border-radius:16px;padding:22px 44px;display:inline-block;min-width:260px;text-align:center;">
        <p style="margin:6px 0;font-size:13px;color:#6b7280;">${labels.organizationName} <strong style="color:#111827;">${escapeHtml(userName)}</strong></p>
        <p style="margin:6px 0;font-size:13px;color:#6b7280;">${labels.authorName} <strong style="color:#111827;">${escapeHtml(userName)}</strong></p>
        <p style="margin:6px 0;font-size:13px;color:#6b7280;">${labels.date} <strong style="color:#111827;">${escapeHtml(createdAt)}</strong></p>
      </div>
    </div>
  `

  // Section pages
  const sectionPages = pages
    .map((page: any, pageIdx: number) => {
      const questions: any[] = page?.questions ?? []
      const pageNum = pageIdx + 2

      const questionsHtml = questions
        .map(
          (q: any, qIdx: number) => `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="min-width:32px;height:32px;background:${PRIMARY};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;margin-top:2px;">
            ${qIdx + 1}
          </div>
          <div style="flex:1;">
            <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#1f2937;line-height:1.5;">
              ${escapeHtml(q?.question ?? "")}
            </p>
            <span style="display:inline-block;background:#dbeafe;color:#3b82f6;font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;margin-bottom:12px;">
              ${labels.type} ${escapeHtml(q?.answerType?.value ?? q?.type ?? "")}
            </span>
            <div style="border:2px solid #e5e7eb;border-radius:8px;padding:12px 14px;min-height:80px;font-size:13px;background:#f9fafb;">
              ${
                q?.answer
                  ? `<span style="color:#374151;">${escapeHtml(q.answer)}</span>`
                  : `<span style="color:#9ca3af;font-style:italic;">${labels.noAnswerPlaceholder}</span>`
              }
            </div>
          </div>
        </div>
      </div>
    `
        )
        .join("")

      return `
      <div class="page" style="background:#f9fafb;display:flex;flex-direction:column;">
        <div style="padding:24px 32px 0;">
          ${breadcrumb(safeTemplateName, pageNum, labels)}
          <div style="background:${PRIMARY};border-radius:12px;padding:20px 24px;margin-bottom:20px;">
            <h2 style="font-size:22px;font-weight:800;color:#fff;margin:0;line-height:1.35;">
              ${escapeHtml(page?.title ?? labels.section(pageIdx + 1))}
            </h2>
          </div>
        </div>
        <div style="padding:0 32px;flex:1;">${questionsHtml}</div>
        ${footer(safeTemplateName, pageNum, totalPages, generatedAt, labels)}
      </div>
    `
    })
    .join("")

  // Sign-off
  const signOffPage = `
    <div class="page" style="background:#fff;display:flex;flex-direction:column;">
      <div style="background:${PRIMARY};display:flex;justify-content:space-between;align-items:center;padding:10px 32px;">
        <span style="font-size:13px;font-weight:600;color:#fff;">${safeTemplateName}</span>
        <span style="font-size:12px;color:#fff;opacity:0.8;">${labels.section(totalPages)}</span>
      </div>
      <div style="padding:32px;">
        <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 24px;">${labels.approvalSignOff}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f3f4f6;">
              ${[
                labels.colAuthorizedSignature,
                labels.colSignature,
                labels.colDate,
                labels.colPrintName,
                labels.colPositionTitle,
              ]
                .map(
                  (h) =>
                    `<th style="padding:10px 14px;text-align:left;font-size:12px;color:#374151;border:1px solid #e5e7eb;">${h}</th>`
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:48px 14px;border:1px solid #e5e7eb;"></td>
              <td style="padding:48px 14px;border:1px solid #e5e7eb;"></td>
              <td style="padding:48px 14px;border:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">DD/MM/YYYY</td>
              <td style="padding:48px 14px;border:1px solid #e5e7eb;"></td>
              <td style="padding:48px 14px;border:1px solid #e5e7eb;"></td>
            </tr>
          </tbody>
        </table>
        <p style="margin-top:16px;font-size:11px;color:#6b7280;font-style:italic;">
          ${labels.signOffDisclaimerTemplate}
        </p>
      </div>
    </div>
  `

  return wrapHtml(coverPage + sectionPages + signOffPage)
}

// ─── 2. INSPECTION PDF (ViewReportPage) ───────────────────────────────────────

export interface InspectionPdfOptions {
  inspectionId: string
  orgName?: string
  templateName: string
  templateDisc?: string
  logoBase64?: string | null
  siteName: string
  status: string
  createdAt: string
  updatedAt: string
  templatePages: any[] // full template pages with questions
  questionAndAnswers: any[] // flat answered Q&A from inspection
  actions: any[]
  labels: PdfLabels
}

export const buildInspectionPdfHtml = ({
  inspectionId,
  orgName = "",
  templateName,
  templateDisc = "",
  logoBase64,
  siteName,
  status,
  createdAt,
  templatePages,
  questionAndAnswers,
  actions,
  labels,
}: InspectionPdfOptions): string => {
  const generatedAt = new Date()
    .toISOString()
    .replace("T", " ")
    .substring(0, 19)
  const shortId = inspectionId.slice(-8)
  const title = escapeHtml(templateName || labels.reportTitleFallback)
  const initial = escapeHtml(
    (templateName || labels.reportTitleFallback).trim().charAt(0).toUpperCase() ||
      "I"
  )
  const safeOrgName = escapeHtml(orgName)
  const safeSiteName = escapeHtml(siteName)
  const safeStatus = escapeHtml(status)
  const logoHtml = logoBase64
    ? `<img src="${escapeHtml(logoBase64)}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:16px;" />`
    : `<span style="font-size:52px;font-weight:800;color:${PRIMARY};">${initial}</span>`

  // ── Build answer lookup: questionId → { answer, note, mediaFiles }
  //
  // Matched by questionId, not question text: the real QuestionAnswer shape
  // (src/types/inspection.ts) carries a nested `question: { id, question, ... }`
  // object, not a top-level `question` string — matching on `.question.trim()`
  // would throw at runtime (objects have no `.trim`), and even guarded, text
  // matching is fragile against duplicate/edited question wording. questionId
  // is the actual FK both sides agree on.
  const qaMap = new Map<
    string,
    { answer: any; note: string; mediaFiles: string[] }
  >()
  questionAndAnswers.forEach((qa: any) => {
    if (!qa.questionId) return
    qaMap.set(qa.questionId, {
      answer: qa.answer ?? "",
      note: qa.note ?? "",
      mediaFiles: qa.mediaFiles ?? [],
    })
  })

  const totalAct = actions.length
  // cover + one page per template section + actions page (if any) + sign-off
  const totalPages = 1 + templatePages.length + (totalAct > 0 ? 1 : 0) + 1

  const renderAnswerHtml = (answer: any, answerType: string): string => {
    const isEmpty = answer === null || answer === undefined || answer === ""
    if (isEmpty) {
      return `<span style="color:#9ca3af;font-style:italic;font-size:13px;">${labels.noAnswerProvided}</span>`
    }
    switch (answerType) {
      case "checkbox":
        return `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background:${answer ? "#dcfce7" : "#f3f4f6"};color:${answer ? "#166534" : "#6b7280"};">${answer ? `✓ ${labels.yes}` : `✗ ${labels.no}`}</span>`
      case "slider":
        return `<div style="margin-top:4px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#9ca3af;margin-bottom:4px;"><span>0</span><span style="font-weight:700;color:${PRIMARY};">${escapeHtml(answer)}</span><span>10</span></div>
          <div style="height:6px;background:#e5e7eb;border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${Number(answer) * 10}%;background:${PRIMARY};border-radius:4px;"></div>
          </div>
        </div>`
      case "date":
        return `<span style="font-size:13px;color:#374151;font-weight:500;">📅 ${escapeHtml(answer)}</span>`
      case "multipleSelect":
        return `<span style="display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:600;padding:3px 10px;border-radius:6px;">${escapeHtml(answer)}</span>`
      default:
        return `<p style="font-size:13px;color:#374151;margin:0;line-height:1.6;white-space:pre-wrap;">${escapeHtml(answer)}</p>`
    }
  }

  const priorityColor = (p: string) => {
    switch (p) {
      case "High":
      case "Critical":
        return "background:#fee2e2;color:#991b1b;"
      case "Medium":
        return "background:#fef3c7;color:#92400e;"
      case "Low":
        return "background:#dcfce7;color:#166534;"
      default:
        return "background:#f3f4f6;color:#374151;"
    }
  }

  const stateColor = (s: string) => {
    switch (s) {
      case "Completed":
      case "Complete":
        return `background:${PRIMARY};color:#fff;`
      case "In Progress":
        return "background:#dbeafe;color:#1d4ed8;"
      case "To do":
        return "background:#f3f4f6;color:#374151;"
      case "can't do":
        return "background:#fee2e2;color:#991b1b;"
      default:
        return "background:#f3f4f6;color:#374151;"
    }
  }

  // ── Cover page — same style as template PDF cover ─────────────────────────
  // Note: the created-date below (and the due-date in the actions table
  // further down) are formatted via toLocaleDateString("en-US", ...) --
  // deliberately not localized. #187 scoped this file to label text only,
  // not date formatting; tracked as a separate, explicit scope boundary
  // rather than an oversight.
  const coverPage = `
    <div class="page" style="
      background-color:${PRIMARY};
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;
      padding:60px 40px;text-align:center;
    ">
      <div style="
        width:120px;height:120px;background:#fff;border-radius:20px;
        display:flex;align-items:center;justify-content:center;
        margin-bottom:36px;overflow:hidden;
      ">${logoHtml}</div>

      <h1 style="font-size:32px;font-weight:800;color:#fff;line-height:1.25;max-width:560px;margin:0 0 18px;">
        ${title}
      </h1>

      ${
        templateDisc
          ? `
      <p style="font-size:14px;color:#fff;opacity:0.9;max-width:480px;line-height:1.75;margin:0 0 40px;text-align:justify;">
        ${escapeHtml(templateDisc.slice(0, 200))}
      </p>`
          : `<div style="margin-bottom:40px;"></div>`
      }

      <div style="
        background:#fff;border-radius:16px;padding:22px 44px;
        display:inline-block;min-width:260px;text-align:center;
      ">
        <p style="margin:6px 0;font-size:13px;color:#6b7280;">
          ${labels.organizationName} <strong style="color:#111827;">${safeOrgName}</strong>
        </p>
        <p style="margin:6px 0;font-size:13px;color:#6b7280;">
          ${labels.site} <strong style="color:#111827;">${safeSiteName}</strong>
        </p>
        <p style="margin:6px 0;font-size:13px;color:#6b7280;">
          ${labels.status} <strong style="color:#111827;">${safeStatus}</strong>
        </p>
        <p style="margin:6px 0;font-size:13px;color:#6b7280;">
          ${labels.reportId} <strong style="color:#111827;font-family:monospace;">${shortId}</strong>
        </p>
        <p style="margin:6px 0;font-size:13px;color:#6b7280;">
          ${labels.date} <strong style="color:#111827;">${new Date(createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong>
        </p>
      </div>
    </div>
  `

  // ── Template section pages — one per page ─────────────────────────────────
  const sectionPages = templatePages
    .map((page: any, pageIdx: number) => {
      const questions: any[] = page?.questions ?? []
      const pageNum = pageIdx + 2

      const questionsHtml = questions
        .map((q: any, qIdx: number) => {
          const matched = qaMap.get(q.id)
          const answer = matched?.answer ?? ""
          const note = matched?.note ?? ""
          const mediaFiles = matched?.mediaFiles ?? []
          // QuestionDef.answerType is a plain string (src/types/inspection.ts),
          // not a nested { answerType } object.
          const answerType = q.answerType ?? "input"
          // Related actions for this question. `templateInfo.questionIndex/pageIndex`
          // isn't a real field on the Action shape returned with an inspection —
          // InspectionReport.tsx's own actionsByQuestion grouping (the live,
          // already-working pattern) matches on the question's text instead.
          const relActions = actions.filter((a: any) => a.question === q.question)

          return `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;margin-bottom:12px;">
          <!-- Question header -->
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
            <div style="min-width:30px;height:30px;background:${PRIMARY};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;">
              ${qIdx + 1}
            </div>
            <div style="flex:1;">
              <p style="font-size:13px;font-weight:600;color:#1f2937;margin:0 0 6px;line-height:1.5;">${escapeHtml(q.question)}</p>
            </div>
          </div>

          <!-- Answer box -->
          <div style="margin-left:42px;">
            <p style="font-size:10px;color:#9ca3af;font-weight:600;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;">${labels.answer}</p>
            <div style="border:1.5px solid #e5e7eb;border-radius:8px;padding:10px 14px;background:#f9fafb;min-height:40px;">
              ${renderAnswerHtml(answer, answerType)}
            </div>

            ${
              note.trim()
                ? `
            <div style="margin-top:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;">
              <p style="font-size:11px;color:#92400e;margin:0;font-style:italic;">${escapeHtml(note)}</p>
            </div>`
                : ""
            }

            ${
              mediaFiles.length > 0
                ? `
            <p style="margin-top:6px;font-size:10px;color:#6b7280;font-weight:600;">📎 ${labels.mediaFilesAttached(mediaFiles.length)}</p>`
                : ""
            }

            ${
              relActions.length > 0
                ? `
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f3f4f6;">
              <p style="font-size:10px;color:#f97316;font-weight:600;margin:0 0 4px;">⚠ ${labels.relatedActionsCount(relActions.length)}</p>
              ${relActions
                .map(
                  (a: any) => `
                <div style="display:flex;align-items:center;gap:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:6px 10px;margin-bottom:4px;">
                  <span style="font-size:11px;font-weight:600;color:#111827;flex:1;">${escapeHtml(a.actionTitle)}</span>
                  <span style="padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600;${priorityColor(a.priority)}">${escapeHtml(a.priority)}</span>
                  <span style="padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600;${stateColor(a.state)}">${escapeHtml(a.state)}</span>
                </div>
              `
                )
                .join("")}
            </div>`
                : ""
            }
          </div>
        </div>
      `
        })
        .join("")

      return `
      <div class="page" style="background:#f9fafb;display:flex;flex-direction:column;">
        <div style="padding:20px 28px 0;">
          <!-- Breadcrumb -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span style="font-size:12px;color:${PRIMARY};font-weight:600;border-bottom:2px solid ${PRIMARY};padding-bottom:2px;">${title}</span>
            <span style="font-size:11px;color:#9ca3af;">${labels.sectionOfTotal(pageNum, totalPages)}</span>
          </div>
          <!-- Green section title -->
          <div style="background:${PRIMARY};border-radius:10px;padding:16px 20px;margin-bottom:16px;">
            <h3 style="font-size:18px;font-weight:800;color:#fff;margin:0;line-height:1.3;">
              ${page.title ? escapeHtml(page.title) : labels.section(pageIdx + 1)}
            </h3>
          </div>
        </div>
        <div style="padding:0 28px;flex:1;">${questionsHtml}</div>
        ${footer(title, pageNum, totalPages, generatedAt, labels)}
      </div>
    `
    })
    .join("")

  // ── Actions page ──────────────────────────────────────────────────────────
  const actionsPageNum = templatePages.length + 2
  const actionsPage =
    totalAct > 0
      ? `
    <div class="page" style="background:#f9fafb;display:flex;flex-direction:column;">
      <div style="padding:20px 28px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <span style="font-size:12px;color:${PRIMARY};font-weight:600;border-bottom:2px solid ${PRIMARY};padding-bottom:2px;">${title}</span>
          <span style="font-size:11px;color:#9ca3af;">${labels.sectionOfTotal(actionsPageNum, totalPages)}</span>
        </div>
        <div style="background:#f97316;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
          <h3 style="font-size:18px;font-weight:800;color:#fff;margin:0;">${labels.actionsCount(totalAct)}</h3>
        </div>
      </div>
      <div style="padding:0 28px;flex:1;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px;">
          <thead>
            <tr style="background:${PRIMARY};">
              ${[
                "#",
                labels.colTitle,
                labels.colPriority,
                labels.colStatus,
                labels.colDueDate,
                labels.colQuestion,
              ]
                .map(
                  (h) =>
                    `<th style="padding:7px 10px;text-align:left;color:#fff;font-weight:700;">${h}</th>`
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${actions
              .map(
                (action: any, idx: number) => `
              <tr style="${idx % 2 === 0 ? "background:#fff;" : "background:#f9fafb;"}">
                <td style="padding:7px 10px;color:#6b7280;">${idx + 1}</td>
                <td style="padding:7px 10px;color:#111827;font-weight:600;">${escapeHtml((action.actionTitle ?? "").substring(0, 38))}${(action.actionTitle ?? "").length > 38 ? "…" : ""}</td>
                <td style="padding:7px 10px;"><span style="padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;${priorityColor(action.priority)}">${action.priority ? escapeHtml(action.priority) : "—"}</span></td>
                <td style="padding:7px 10px;"><span style="padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;${stateColor(action.state)}">${action.state ? escapeHtml(action.state) : "—"}</span></td>
                <td style="padding:7px 10px;color:#6b7280;">${action.dueDate ? new Date(action.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                <td style="padding:7px 10px;color:#6b7280;max-width:160px;">${action.question ? `${escapeHtml(String(action.question).substring(0, 42))}${String(action.question).length > 42 ? "…" : ""}` : "—"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${footer(title, actionsPageNum, totalPages, generatedAt, labels)}
    </div>
  `
      : ""

  // ── Sign-off page ─────────────────────────────────────────────────────────
  const signOffPage = `
    <div class="page" style="background:#fff;display:flex;flex-direction:column;">
      <div style="background:${PRIMARY};display:flex;justify-content:space-between;align-items:center;padding:10px 28px;">
        <span style="font-size:13px;font-weight:600;color:#fff;">${title}</span>
        <span style="font-size:11px;color:#fff;opacity:0.8;">${labels.sectionOfTotal(totalPages, totalPages)}</span>
      </div>
      <div style="padding:28px;">
        <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 20px;">${labels.approvalSignOff}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f3f4f6;">
              ${[
                labels.colAuthorizedSignature,
                labels.colSignature,
                labels.colDate,
                labels.colPrintName,
                labels.colPositionTitle,
              ]
                .map(
                  (h) =>
                    `<th style="padding:10px 12px;text-align:left;font-size:11px;color:#374151;border:1px solid #e5e7eb;">${h}</th>`
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:48px 12px;border:1px solid #e5e7eb;"></td>
              <td style="padding:48px 12px;border:1px solid #e5e7eb;"></td>
              <td style="padding:48px 12px;border:1px solid #e5e7eb;font-size:10px;color:#9ca3af;">DD/MM/YYYY</td>
              <td style="padding:48px 12px;border:1px solid #e5e7eb;"></td>
              <td style="padding:48px 12px;border:1px solid #e5e7eb;"></td>
            </tr>
          </tbody>
        </table>
        <p style="margin-top:14px;font-size:11px;color:#6b7280;font-style:italic;">
          ${labels.signOffDisclaimerInspection}
        </p>
      </div>
    </div>
  `

  return wrapHtml(coverPage + sectionPages + actionsPage + signOffPage)
}
