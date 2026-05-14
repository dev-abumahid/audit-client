/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useGetSingleInspectionQuery } from "@/redux/apis/organization/inspection.api"
import type { IPage } from "@/types/template"
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  CopyCheck,
  Download,
  FileText,
  Globe,
  Hash,
  MessageSquare,
  PlayCircle,
  ToggleLeft,
  ToggleRight,
  XCircle,
} from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPriorityColor = (p: string) => {
  switch (p?.toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-700 border-red-200"
    case "high":
      return "bg-red-100 text-red-700 border-red-200"
    case "medium":
      return "bg-amber-100 text-amber-700 border-amber-200"
    case "low":
      return "bg-green-100 text-green-700 border-green-200"
    default:
      return "bg-gray-100 text-gray-600 border-gray-200"
  }
}

const getStateColor = (s: string) => {
  switch (s) {
    case "Completed":
    case "Complete":
      return "bg-primary text-primary-foreground"
    case "In Progress":
      return "bg-blue-100 text-blue-700"
    case "To do":
      return "bg-gray-100 text-gray-600"
    case "can't do":
      return "bg-red-100 text-red-700"
    default:
      return "bg-gray-100 text-gray-600"
  }
}

const getStateIcon = (s: string) => {
  switch (s) {
    case "Completed":
    case "Complete":
      return <CheckCircle className="h-3 w-3" />
    case "In Progress":
      return <PlayCircle className="h-3 w-3" />
    case "can't do":
      return <XCircle className="h-3 w-3" />
    default:
      return <Clock className="h-3 w-3" />
  }
}

const formatShortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

const renderAnswerValue = (
  answer: any,
  answerType: string
): React.ReactNode => {
  if (answer === null || answer === undefined || answer === "") {
    return (
      <span className="text-sm text-muted-foreground italic">
        No answer provided
      </span>
    )
  }

  switch (answerType) {
    case "checkbox":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            answer
              ? "bg-primary text-primary-foreground"
              : "bg-gray-200 text-red-500"
          }`}
        >
          {answer ? (
            <>
              <ToggleRight className="h-4 w-4" /> Yes
            </>
          ) : (
            <>
              <ToggleLeft className="h-4 w-4" /> No
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
          {answer}
        </span>
      )

    case "multipleSelect":
    case "media":
    default:
      return (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {String(answer)}
        </p>
      )
  }
}

// ─── Sub Components ───────────────────────────────────────────────────────────

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
          <p className="mb-1.5 text-xs text-muted-foreground">Answer:</p>
          <div className="min-h-17.5 w-full rounded-lg border border-border bg-muted/50 px-4 py-3">
            {renderAnswerValue(answer, answerType)}
          </div>

          {hasNote && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
              <p className="text-sm font-medium text-amber-700">Note:</p>
              <p className="text-sm text-amber-800">{note}</p>
            </div>
          )}

          {hasMedia && (
            <div className="mt-3 flex flex-wrap gap-2">
              {mediaFiles.map((media, i) => (
                <button
                  key={i}
                  onClick={() => onMediaClick(media.url)}
                  className="h-14 w-14 overflow-hidden rounded-lg border border-border transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  <img
                    src={media.url}
                    alt={`media-${i}`}
                    className="h-full w-full object-cover"
                    onError={(e) =>
                      (e.currentTarget.src =
                        "https://via.placeholder.com/56?text=?")
                    }
                  />
                </button>
              ))}
            </div>
          )}

          {relatedActions.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3 text-orange-500" />
                Actions ({relatedActions.length})
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
    const questions = page?.questions ?? []

    return (
      <div>
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="border-b border-primary pb-0.5 text-sm font-medium text-primary">
            {templateName}
          </span>
          <span className="text-sm text-muted-foreground">
            Section {pageIndex + 1}
          </span>
        </div>

        <div className="mb-4 rounded-xl bg-primary px-5 py-4">
          <h3 className="text-lg leading-snug font-bold text-primary-foreground">
            {page.title}
          </h3>
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

// ─── Main Component ───────────────────────────────────────────────────────────

const InspectionReport = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: inspectionRaw } = useGetSingleInspectionQuery(id)

  const inspection = inspectionRaw?.data
  const template = inspection?.template
  const actions = inspection?.actions ?? []

  const templatePages: IPage[] = template?.pages ?? []
  const templateName = template?.templateName ?? "Inspection Report"

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

  if (!inspection) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading report…</p>
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
              {inspection.status}
            </span>

            <h1 className="mb-1 text-2xl font-black tracking-tight text-foreground">
              {templateName}
            </h1>

            {inspection.site?.name && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                Site: <Globe className="h-3.5 w-3.5 text-primary" />{" "}
                {inspection.site.name}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: "Sections",
                  value: templatePages.length,
                  icon: FileText,
                },
                {
                  label: "Questions",
                  value: `${totalAnswered}/${totalQuestions}`,
                  icon: Hash,
                },
                {
                  label: "Actions",
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

            <button className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.985]">
              <Download className="h-4 w-4" /> Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-9xl mx-auto flex items-start gap-6 px-6 py-10">
        {/* Sidebar */}
        <aside className="sticky top-6 hidden h-fit max-h-[calc(100vh-1.5rem)] w-72 flex-col overflow-y-auto lg:flex">
          <p className="mb-2 px-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Sections
          </p>
          <div className="space-y-1">
            {templatePages.map((page: IPage, idx: number) => {
              const isActive = activePageIndex === idx
              return (
                <button
                  key={idx}
                  onClick={() => scrollToPage(idx)}
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
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1 space-y-10">
          {templatePages.map((page: IPage, pi: number) => (
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

          {/* Unsplit Text & Actions remain the same */}
          {inspection.unSplit_text && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Unsplit Text
                </h2>
              </div>
              <div className="rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {inspection.unSplit_text}
                </p>
              </div>
            </div>
          )}

          {/* Actions Table - same as before */}
          {actions.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-orange-100 p-2.5">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Actions</h2>
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-600">
                  {actions.length}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      {["#", "Title", "Priority", "Status", "Due Date"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-bold tracking-wide text-muted-foreground uppercase"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {actions.map((action: any, i: number) => (
                      <tr
                        key={action._id}
                        onClick={() =>
                          navigate(`/dashboard/single-action/${action._id}`)
                        }
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                      >
                        <td className="px-4 py-3 text-xs font-medium text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="max-w-50 truncate px-4 py-3 font-semibold text-foreground">
                          {action.actionTitle}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getPriorityColor(action.priority)}`}
                          >
                            {action.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${getStateColor(action.state)}`}
                          >
                            {getStateIcon(action.state)} {action.state}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                          {formatShortDate(action.dueDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            className="max-h-[90vh] max-w-3xl overflow-auto rounded-2xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-sm font-bold text-foreground">
                Media Preview
              </h3>
              <button
                onClick={() => setSelectedMedia(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full font-bold text-muted-foreground transition-colors hover:bg-muted"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <img
                src={selectedMedia}
                alt="preview"
                className="h-auto max-w-full rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InspectionReport
