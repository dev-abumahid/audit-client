/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useGetSingleInspectionQuery } from "@/redux/apis/organization/inspection.api"
import type { PageDef } from "@/types/inspection"
import { attachmentFileName } from "@/utils/attachmentFileName"
import {
  buildInspectionPdfHtml,
  type PdfLabels,
} from "@/utils/buildInspectionPdfHtml"
import { fileType } from "@/utils/fileType"
import { formatLocaleDate } from "@/utils/formatDate"
import { useModalA11y } from "@/hooks/useModalA11y"
import { getInspectionStatusLabel } from "@/utils/inspectionStatus"
import { A4_WIDTH_MM, computePdfPagePlacements } from "@/utils/pdfPageMath"
import { PLACEHOLDER_IMAGE_SRC } from "@/utils/placeholderImage"
import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"
import {
  AlertTriangle,
  Calendar,
  CopyCheck,
  Download,
  FileText,
  Globe,
  Hash,
  Loader2,
  MessageSquare,
  Paperclip,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"
import type { TFunction } from "i18next"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router"
import { toast } from "sonner"

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Was toLocaleDateString("en-US", ...) hardcoded -- silently ignored the
// app's selected language and always showed English month names under a
// French UI. Takes i18n.language explicitly (module-level, no hook access)
// and defers to the shared formatLocaleDate helper (built in round 3 to
// prevent exactly this bug class -- aexa-frontend#339) instead of a second
// local en-US-only formatter.
const formatShortDate = (d: string, language: string | undefined) =>
  formatLocaleDate(d, language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

// ─── Sub Components ───────────────────────────────────────────────────────────

const renderAnswerValue = (
  answer: any,
  answerType: string,
  t: TFunction,
  language: string | undefined
): React.ReactNode => {
  if (answer === null || answer === undefined || answer === "") {
    return (
      <span className="text-sm text-muted-foreground italic">
        {t("organization.inspection.noAnswerProvided")}
      </span>
    )
  }

  switch (answerType) {
    case "checkbox":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            answer ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {answer ? (
            <>
              <ToggleRight className="h-4 w-4" />{" "}
              {t("organization.inspection.yes")}
            </>
          ) : (
            <>
              <ToggleLeft className="h-4 w-4" />{" "}
              {t("organization.inspection.no")}
            </>
          )}
        </span>
      )

    case "slider":
      return (
        <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span className="font-semibold text-primary">{answer}</span>
            <span>10</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Number(answer) * 10}%` }}
            />
          </div>
        </div>
      )

    case "date":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          {formatShortDate(answer, language)}
        </span>
      )

    case "multipleSelect": {
      // Clean and parse the answer
      let selectedValues: string[] = []

      if (typeof answer === "string") {
        // Handle formats like "'hello','hi','bye'" or "hello,hi,bye"
        const cleanAnswer = answer.replace(/'/g, '"') // Replace single quotes with double quotes
        try {
          // Try to parse as JSON array
          if (cleanAnswer.startsWith('"') && cleanAnswer.endsWith('"')) {
            // Single value case
            selectedValues = [JSON.parse(cleanAnswer)]
          } else if (cleanAnswer.startsWith("[")) {
            // Already array format
            selectedValues = JSON.parse(cleanAnswer)
          } else {
            // Split by comma and clean
            selectedValues = answer
              .split(",")
              .map((item: string) => item.trim().replace(/^['"]|['"]$/g, ""))
              .filter((item: string) => item)
          }
        } catch {
          // Fallback: split by comma
          selectedValues = answer
            .split(",")
            .map((item: string) => item.trim().replace(/^['"]|['"]$/g, ""))
            .filter((item: string) => item)
        }
      } else if (Array.isArray(answer)) {
        selectedValues = answer
      } else {
        selectedValues = [String(answer)]
      }

      return (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((value, index) => (
            <span
              key={index}
              className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {value}
            </span>
          ))}
        </div>
      )
    }

    case "media": {
      // Round 13 (#507) -- UpdateInspection.tsx's upload input for this
      // same "media" answer type accepts "image/*,video/*,application/pdf",
      // but this renderer used to unconditionally render an <img>, so a
      // video or PDF answer silently fell through to the broken-image
      // placeholder. Branch on the real file type instead: video gets a
      // native <video controls>, and PDFs/other documents get a link that
      // opens the file in a new tab, since neither can be inline-previewed
      // as an <img>.
      const mediaType = answer ? fileType(String(answer)) : null

      if (mediaType === "video") {
        return (
          <div className="inline-block overflow-hidden rounded-lg border p-2">
            <video controls className="max-h-96 w-auto max-w-full rounded">
              <source src={answer} />
              {t("organization.inspection.videoUnsupported")}
            </video>
          </div>
        )
      }

      if (mediaType === "document" || mediaType === "file") {
        return (
          <a
            href={answer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <FileText className="h-8 w-8 shrink-0" />
            <span className="max-w-60 truncate font-medium text-foreground">
              {attachmentFileName(String(answer))}
            </span>
          </a>
        )
      }

      return (
        <div className="group relative inline-block overflow-hidden rounded-lg border">
          <img
            src={answer}
            alt={t("organization.inspection.uploadedMediaAlt")}
            className="max-h-96 w-auto max-w-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              // Handle image load error
              ;(e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE_SRC
            }}
          />
          <button
            onClick={() => window.open(answer, "_blank", "noopener,noreferrer")}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <span className="rounded bg-white px-2 py-1 text-xs font-medium text-black">
              {t("organization.inspection.viewFullSize")}
            </span>
          </button>
        </div>
      )
    }

    default:
      return (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {String(answer)}
        </p>
      )
  }
}

const QuestionCard = memo(
  ({
    question,
    questionIndex,
    answer,
    note,
    mediaFiles,
    relatedActions,
    onMediaClick,
  }: {
    question: any
    questionIndex: number
    answer: any
    note: string
    mediaFiles: { url: string; type: string }[]
    relatedActions: any[]
    onMediaClick: (url: string) => void
  }) => {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const answerType =
      question.answerType?.answerType ?? question.answerType ?? "input"
    const hasNote = note?.trim().length > 0
    const hasMedia = mediaFiles?.length > 0

    return (
      <div className="mb-4 rounded-xl border border-border bg-card p-6">
        <div className="mb-3 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {questionIndex + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="leading-snug font-medium text-foreground">
              {question.question}
              {question.isRequired && (
                <span className="ml-1 text-destructive">*</span>
              )}
            </p>
          </div>
        </div>

        <div className="ml-11">
          <p className="mb-1.5 text-xs text-muted-foreground">
            {t("organization.inspection.answerLabel")}
          </p>
          <div className="min-h-17.5 w-full rounded-lg border border-border bg-muted/50 px-4 py-3">
            {renderAnswerValue(answer, answerType, t, i18n.language)}
          </div>

          {hasNote && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
              <p className="text-sm font-medium text-amber-700">
                {t("organization.inspection.noteLabel")}
              </p>
              <p className="text-sm text-amber-800">{note}</p>
            </div>
          )}

          {hasMedia && (
            <div className="mt-3 flex flex-wrap gap-2">
              {mediaFiles.map((media, i) => {
                const mediaKind = fileType(media.url)
                return (
                  <button
                    key={i}
                    onClick={() => onMediaClick(media.url)}
                    aria-label={t("organization.inspection.mediaThumbnailAlt", {
                      index: i + 1,
                    })}
                    className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-border transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    {mediaKind === "video" ? (
                      <video className="h-full w-full object-cover">
                        <source src={media.url} />
                      </video>
                    ) : mediaKind === "document" || mediaKind === "file" ? (
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <img
                        src={media.url}
                        alt={t("organization.inspection.mediaThumbnailAlt", {
                          index: i + 1,
                        })}
                        className="h-full w-full object-cover"
                        onError={(e) =>
                          (e.currentTarget.src = PLACEHOLDER_IMAGE_SRC)
                        }
                      />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {relatedActions.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3 text-orange-500" />
                {t("organization.inspection.actionsCount", {
                  count: relatedActions.length,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {relatedActions.map((action: any) => (
                  <button
                    key={action._id}
                    onClick={() =>
                      navigate(`/dashboard/single-action/${action._id}`)
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 transition-colors hover:border-green-400 hover:bg-green-100"
                  >
                    <CopyCheck className="h-3 w-3 shrink-0" />
                    {action.actionTitle}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
)

const PageSection = memo(
  ({
    page,
    pageIndex,
    templateName,
    answerMap,
    actionsByQuestion,
    onMediaClick,
  }: {
    page: any
    pageIndex: number
    templateName: string
    answerMap: Map<string, { answer: any; note: string; mediaFiles: any[] }>
    actionsByQuestion: Record<string, any[]>
    onMediaClick: (url: string) => void
  }) => {
    const { t } = useTranslation()
    const questions = page?.questions ?? []

    return (
      <div>
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="border-b border-primary pb-0.5 text-sm font-medium text-primary">
            {templateName}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("organization.inspection.section", { num: pageIndex + 1 })}
          </span>
        </div>

        <div className="mb-4 rounded-xl bg-primary px-5 py-4">
          {/* h2, not h3: this is a top-level report section, a sibling of the
              Attachments/Unsplit Text h2s below -- keeping it h3 skipped a
              level under the page h1 (aexa-frontend round-9 audit #463). */}
          <h2 className="text-lg leading-snug font-bold text-primary-foreground">
            {page.title}
          </h2>
        </div>

        {questions.map((question: any, qi: number) => {
          const entry = answerMap.get(`${pageIndex}-${qi}`)
          const relatedActions = actionsByQuestion[question.question] || []

          return (
            <QuestionCard
              key={`${pageIndex}-${qi}`}
              question={question}
              questionIndex={qi}
              answer={entry?.answer ?? ""}
              note={entry?.note ?? ""}
              mediaFiles={entry?.mediaFiles ?? []}
              relatedActions={relatedActions}
              onMediaClick={onMediaClick}
            />
          )
        })}
      </div>
    )
  }
)

// Renders a full HTML document string (built by buildInspectionPdfHtml) into a
// downloaded, multi-page PDF. The builder lays out one `.page` div per A4-sized
// section (see its shared CSS), so — unlike TemplateReportPage's single tall
// canvas sliced at fixed heights — each section is captured and placed as its
// own PDF page, giving correct, non-mid-content page breaks.
async function renderHtmlToPdf(html: string, filename: string) {
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.top = "-10000px"
  iframe.style.left = "-10000px"
  iframe.style.width = "210mm"
  iframe.style.height = "297mm"
  document.body.appendChild(iframe)

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve()
      iframe.onerror = () => reject(new Error("Report frame failed to load"))
      iframe.srcdoc = html
    })

    const doc = iframe.contentDocument
    if (!doc) throw new Error("Could not access report frame")

    const pageEls = Array.from(doc.querySelectorAll<HTMLElement>(".page"))
    if (pageEls.length === 0) throw new Error("Report has no pages to render")

    const pdf = new jsPDF("p", "mm", "a4")

    for (let i = 0; i < pageEls.length; i++) {
      const canvas = await html2canvas(pageEls[i], {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      })
      const imgData = canvas.toDataURL("image/png")
      const { imgHeightMm, positionsMm } = computePdfPagePlacements(
        canvas.width,
        canvas.height
      )
      positionsMm.forEach((positionMm, slice) => {
        if (i > 0 || slice > 0) pdf.addPage()
        pdf.addImage(imgData, "PNG", 0, positionMm, A4_WIDTH_MM, imgHeightMm)
      })
    }

    pdf.save(filename)
  } finally {
    document.body.removeChild(iframe)
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

const InspectionReport = () => {
  const { t } = useTranslation()
  const { id } = useParams()

  const { data: inspectionRaw } = useGetSingleInspectionQuery(id ?? "")

  const inspection = inspectionRaw?.data
  const template = inspection?.template
  // `InspectionDetail` (types/inspection.ts) deliberately doesn't declare
  // `actions` — GET /inspection/:id (inspection.service.ts's
  // get_single_inspection_from_db) never `include`s that relation, so this
  // is `[]` for every real response today. This whole "Actions" section
  // (and its legacy `action._id`/`action.state` field references below,
  // which don't match the real Action model's `id`/`status` either) reads
  // as pre-existing, not-yet-wired-up functionality rather than something
  // this typing pass (issue #108) should take on rewiring — fetching real
  // findings here would be via useFindingsForInspection, same as
  // RunInspection.tsx. Cast (not deleted) so this stays visibly a known gap
  // for a follow-up rather than silently disabled.
  const actions = (inspection as { actions?: any[] } | undefined)?.actions ?? []

  const templatePages: PageDef[] = template?.pages ?? []
  const templateName =
    template?.templateName ?? t("organization.inspection.reportTitleFallback")

  const actionsByQuestion = useMemo(() => {
    const map: Record<string, any[]> = {}
    actions.forEach((action: any) => {
      if (action.question) {
        map[action.question] = map[action.question] || []
        map[action.question].push(action)
      }
    })
    return map
  }, [actions])

  const answerMap = useMemo(() => {
    const map = new Map<
      string,
      { answer: any; note: string; mediaFiles: any[] }
    >()

    if (!inspection?.questionAnswers || !templatePages.length) return map

    const qaById = new Map<string, any>()
    inspection.questionAnswers.forEach((qa: any) => {
      if (qa.questionId) qaById.set(qa.questionId, qa)
    })

    templatePages.forEach((page: any, pi: number) => {
      ;(page.questions ?? []).forEach((q: any, qi: number) => {
        const matched = qaById.get(q.id)
        map.set(`${pi}-${qi}`, {
          answer: matched?.answer ?? "",
          note: matched?.note ?? "",
          mediaFiles: matched?.mediaFiles ?? [],
        })
      })
    })

    return map
  }, [inspection?.questionAnswers, templatePages])

  const [activePageIndex, setActivePageIndex] = useState(0)
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  // aexa-frontend#490 -- role="dialog"/focus-trap/Escape for the media
  // lightbox, same pattern KriDashboardPage uses (round 10, #487).
  const mediaLightboxRef = useModalA11y(!!selectedMedia, () =>
    setSelectedMedia(null)
  )
  const pageSectionRefs = useRef<(HTMLDivElement | null)[]>([])

  const { totalAnswered, totalQuestions } = useMemo(() => {
    let answered = 0
    answerMap.forEach((v) => {
      if (v.answer !== "" && v.answer != null) answered++
    })
    const totalQ = templatePages.reduce(
      (sum, p) => sum + (p.questions?.length ?? 0),
      0
    )
    return { totalAnswered: answered, totalQuestions: totalQ }
  }, [answerMap, templatePages])

  // Intersection Observer for Active Section
  useEffect(() => {
    if (!templatePages.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = pageSectionRefs.current.indexOf(
              entry.target as HTMLDivElement
            )
            if (idx !== -1) setActivePageIndex(idx)
          }
        })
      },
      { threshold: 0.4, rootMargin: "-80px 0px -20% 0px" }
    )

    pageSectionRefs.current.forEach((el) => el && observer.observe(el))

    return () => observer.disconnect()
  }, [templatePages.length])

  const scrollToPage = useCallback((idx: number) => {
    pageSectionRefs.current[idx]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }, [])

  const [isDownloading, setIsDownloading] = useState(false)

  const downloadPdf = useCallback(async () => {
    if (!inspection) return
    setIsDownloading(true)
    try {
      const labels: PdfLabels = {
        section: (num) => t("organization.inspection.section", { num }),
        sectionOfTotal: (num, total) =>
          t("organization.inspection.sectionOfTotal", { num, total }),
        generatedOn: (date) =>
          t("organization.inspection.pdfGeneratedOn", { date }),
        actionsCount: (count) =>
          t("organization.inspection.actionsCount", { count }),
        relatedActionsCount: (count) =>
          t("organization.inspection.pdfRelatedActionsCount", { count }),
        mediaFilesAttached: (count) =>
          t("organization.inspection.pdfMediaFilesAttached", { count }),
        organizationName: t("organization.inspection.pdfOrganizationName"),
        authorName: t("organization.inspection.pdfAuthorName"),
        date: t("organization.inspection.pdfDateLabel"),
        site: t("organization.inspection.siteLabel"),
        status: t("organization.inspection.statusLabel"),
        reportId: t("organization.inspection.pdfReportId"),
        type: t("organization.inspection.pdfTypeLabel"),
        answer: t("organization.inspection.pdfAnswerHeading"),
        noAnswerPlaceholder: t("organization.inspection.answerLabel"),
        noAnswerProvided: t("organization.inspection.noAnswerProvided"),
        approvalSignOff: t("organization.inspection.pdfApprovalSignOff"),
        colAuthorizedSignature: t(
          "organization.inspection.pdfColAuthorizedSignature"
        ),
        colSignature: t("organization.inspection.pdfColSignature"),
        colDate: t("organization.inspection.pdfColDate"),
        colPrintName: t("organization.inspection.pdfColPrintName"),
        colPositionTitle: t("organization.inspection.pdfColPositionTitle"),
        colTitle: t("organization.inspection.colTitle"),
        colPriority: t("organization.inspection.colPriority"),
        colDueDate: t("organization.inspection.colDueDate"),
        colQuestion: t("organization.inspection.pdfColQuestion"),
        colStatus: t("organization.inspection.colStatus"),
        signOffDisclaimerTemplate: t(
          "organization.inspection.pdfSignOffDisclaimerTemplate"
        ),
        signOffDisclaimerInspection: t(
          "organization.inspection.pdfSignOffDisclaimerInspection"
        ),
        reportTitleFallback: t("organization.inspection.reportTitleFallback"),
        yes: t("organization.inspection.yes"),
        no: t("organization.inspection.no"),
      }
      const html = buildInspectionPdfHtml({
        inspectionId: inspection.id,
        templateName,
        logoBase64: template?.templateLogo ?? null,
        siteName: inspection.site?.name ?? "",
        status: getInspectionStatusLabel(t, inspection.status),
        createdAt: inspection.createdAt,
        updatedAt: inspection.updatedAt,
        templatePages,
        questionAndAnswers: inspection.questionAnswers ?? [],
        actions,
        labels,
      })
      await renderHtmlToPdf(html, `${templateName}-report.pdf`)
    } catch (err: any) {
      toast.error(
        err?.message || t("organization.inspection.pdfGenerateFailedToast")
      )
    } finally {
      setIsDownloading(false)
    }
  }, [inspection, template, templateName, templatePages, actions, t])

  if (!inspection) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {t("organization.inspection.loadingReport")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="">
      {/* HEADER */}
      <div className="bg-card px-6 py-7">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {getInspectionStatusLabel(t, inspection.status)}
            </span>

            <h1 className="mb-1 text-2xl font-black tracking-tight text-foreground">
              {templateName}
            </h1>

            {inspection.site?.name && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                {t("organization.inspection.siteLabel")}{" "}
                <Globe className="h-3.5 w-3.5 text-primary" />{" "}
                {inspection.site.name}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: t("organization.inspection.sections"),
                  value: templatePages.length,
                  icon: FileText,
                },
                {
                  label: t("organization.inspection.questions"),
                  value: `${totalAnswered}/${totalQuestions}`,
                  icon: Hash,
                },
                {
                  label: t("organization.inspection.colActions"),
                  value: actions.length,
                  icon: AlertTriangle,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs leading-none text-muted-foreground">
                      {label}
                    </p>
                    <p className="text-sm font-bold text-foreground">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={downloadPdf}
              disabled={isDownloading}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />{" "}
                  {t("organization.inspection.generating")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />{" "}
                  {t("organization.inspection.downloadPdf")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-9xl mx-auto flex items-start gap-6 px-6 py-10">
        {/* Sidebar */}
        <aside className="sticky top-6 hidden h-fit max-h-[calc(100vh-1.5rem)] w-72 flex-col overflow-y-auto lg:flex">
          <p className="mb-2 px-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">
            {t("organization.inspection.sections")}
          </p>
          <nav
            className="space-y-1"
            aria-label={t("organization.inspection.sections")}
          >
            {templatePages.map((page: PageDef, idx: number) => {
              const isActive = activePageIndex === idx
              return (
                <button
                  key={idx}
                  onClick={() => scrollToPage(idx)}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-card hover:text-foreground hover:shadow-sm"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="line-clamp-2 flex-1 text-xs leading-tight font-medium">
                    {page.title}
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1 space-y-10">
          {templatePages.map((page: PageDef, pi: number) => (
            <div
              key={pi}
              ref={(el) => {
                pageSectionRefs.current[pi] = el
              }}
              className="scroll-mt-6"
            >
              <PageSection
                page={page}
                pageIndex={pi}
                templateName={templateName}
                answerMap={answerMap}
                actionsByQuestion={actionsByQuestion}
                onMediaClick={setSelectedMedia}
              />
            </div>
          ))}

          {/* Inspection-level attachments (not per-question mediaFiles) */}
          {inspection.attachments?.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <Paperclip className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {t("organization.inspection.attachments")}
                </h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                  {inspection.attachments.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {inspection.attachments.map((url: string) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="max-w-64 truncate rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm hover:underline"
                  >
                    {attachmentFileName(url)}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Unsplit Text & Actions remain the same */}
          {inspection.unSplitText && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {t("organization.inspection.unsplitText")}
                </h2>
              </div>
              <div className="rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {inspection.unSplitText}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Media Lightbox */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            ref={mediaLightboxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-lightbox-title"
            className="max-h-[90vh] max-w-3xl overflow-auto rounded-2xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3
                id="media-lightbox-title"
                className="text-sm font-bold text-foreground"
              >
                {t("organization.inspection.mediaPreview")}
              </h3>
              <button
                onClick={() => setSelectedMedia(null)}
                aria-label={t("organization.inspection.closeMediaPreview")}
                className="flex h-7 w-7 items-center justify-center rounded-full font-bold text-muted-foreground transition-colors hover:bg-muted"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              {fileType(selectedMedia) === "video" ? (
                <video controls className="h-auto max-w-full rounded-xl">
                  <source src={selectedMedia} />
                  {t("organization.inspection.videoUnsupported")}
                </video>
              ) : fileType(selectedMedia) === "document" ||
                fileType(selectedMedia) === "file" ? (
                <a
                  href={selectedMedia}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <FileText className="h-5 w-5" />
                  {attachmentFileName(selectedMedia)}
                </a>
              ) : (
                <img
                  src={selectedMedia}
                  alt={t("organization.inspection.uploadedMediaAlt")}
                  className="h-auto max-w-full rounded-xl"
                  onError={(e) =>
                    (e.currentTarget.src = PLACEHOLDER_IMAGE_SRC)
                  }
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InspectionReport
