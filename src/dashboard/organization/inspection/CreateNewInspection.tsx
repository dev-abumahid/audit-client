/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCreateNewInspectionMutation } from "@/redux/apis/organization/inspection.api"
import { useGetSingleTemplateQuery } from "@/redux/apis/organization/template.api"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  FileText,
  Globe,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { toast } from "sonner"

type AnswerEntry = {
  answer: any
  note: string
  mediaFiles: { url: string; type: string }[]
}

export default function CreateNewInspection() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const templateId = state?.templateId
  const siteId = state?.siteId
  const siteName = state?.siteName

  const { data: templateData, isLoading } = useGetSingleTemplateQuery(
    templateId,
    { skip: !templateId }
  )

  const [createInspection, { isLoading: isSubmitting }] =
    useCreateNewInspectionMutation()

  const template = templateData?.data
  const pages = template?.pages || []

  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerEntry>>({})
  const [visibleNotes, setVisibleNotes] = useState<Record<string, boolean>>({})

  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const initialized = useRef(false)

  // Initialize answers using question.id
  useEffect(() => {
    if (!pages.length || initialized.current) return

    const initial: Record<string, AnswerEntry> = {}

    pages.forEach((page: any) => {
      page.questions?.forEach((q: any) => {
        if (!q.id) return
        let defaultAnswer: any = ""
        if (q.answerType === "checkbox") defaultAnswer = false
        if (q.answerType === "slider") defaultAnswer = q.value || 5

        initial[q.id] = {
          answer: defaultAnswer,
          note: "",
          mediaFiles: [],
        }
      })
    })

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(initial)
    initialized.current = true
  }, [pages])

  useEffect(() => {
    if (!pages.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting)

        if (!visibleEntries.length) return

        const activeEntry = visibleEntries.reduce((prev, current) => {
          return prev.boundingClientRect.top < current.boundingClientRect.top
            ? prev
            : current
        })

        const index = Number(activeEntry.target.getAttribute("data-page-index"))

        setCurrentPageIndex(index)
      },
      {
        rootMargin: "-120px 0px -60% 0px",
        threshold: 0,
      }
    )

    pageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [pages])

  const scrollToPage = (index: number) => {
    if (pageRefs.current[index]) {
      pageRefs.current[index]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], answer: value },
    }))
  }

  const handleNoteChange = (questionId: string, note: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], note },
    }))
  }

  const toggleNote = (questionId: string) => {
    setVisibleNotes((prev) => ({ ...prev, [questionId]: !prev[questionId] }))
  }

  const handleSubmit = async () => {
    if (!templateId || !siteId) {
      toast.error("Missing template or site information")
      return
    }

    const questionAnswers = Object.entries(answers).map(
      ([questionId, data]) => ({
        questionId,
        answer: data.answer,
        note: data.note?.trim() || "",
        mediaFiles: data.mediaFiles,
      })
    )

    const payload = { templateId, siteId, questionAnswers }
    console.log("Final Payload:", payload)

    try {
      await createInspection(payload).unwrap()
      toast.success("Inspection submitted successfully!")
      navigate("/dashboard/inspections")
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to submit inspection")
    }
  }

  const renderQuestionInput = (question: any) => {
    const value = answers[question.id]?.answer
    const answerType = question.answerType

    switch (answerType) {
      case "checkbox":
        return (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) =>
                handleAnswerChange(question.id, e.target.checked)
              }
              className="h-5 w-5 accent-primary"
            />
            <span>{value ? "Yes" : "No"}</span>
          </label>
        )

      case "slider":
        return (
          <div className="space-y-3">
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={value ?? 5}
              onChange={(e) =>
                handleAnswerChange(question.id, parseFloat(e.target.value))
              }
              className="w-full accent-primary"
            />
            <div className="text-center text-xl font-semibold text-primary">
              {value ?? 5}
            </div>
          </div>
        )

      case "date":
        return (
          <input
            type="date"
            value={value ?? ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full rounded-lg border border-input px-4 py-3 focus:ring-2 focus:ring-primary"
          />
        )

      case "multipleSelect": {
        const options = question.value
          ? String(question.value).replace(/['"]/g, "").split(",")
          : []
        return (
          <select
            value={value ?? ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full rounded-lg border border-input px-4 py-3"
          >
            <option value="">Select option...</option>
            {options.map((opt: string, i: number) => (
              <option key={i} value={opt.trim()}>
                {opt.trim()}
              </option>
            ))}
          </select>
        )
      }

      case "media":
        return (
          <Button
            variant="outline"
            className="flex w-full items-center gap-2 py-6"
          >
            <CloudUpload className="h-5 w-5" />
            Upload Media / Documents
          </Button>
        )

      default:
        return (
          <textarea
            value={value ?? ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            rows={5}
            className="min-h-[120px] w-full resize-y rounded-lg border border-input px-4 py-3 focus:ring-2 focus:ring-primary"
            placeholder="Type your answer here..."
          />
        )
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading template...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <div className="sticky top-0 z-50 border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-5 w-5" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{template?.templateName}</h1>
              {siteName && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" /> {siteName}
                </p>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Page {currentPageIndex + 1} of {pages.length}
          </div>
        </div>
      </div>

      <div className="mx-auto flex gap-8 px-6 py-8">
        {/* Sticky Left Navigation - Using Only Index */}
        <div className="hidden w-72 lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 px-3 text-sm font-semibold text-muted-foreground">
              PAGES
            </p>
            {pages.map((page: any, index: number) => (
              <button
                key={index}
                onClick={() => scrollToPage(index)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all ${
                  currentPageIndex === index
                    ? "bg-primary font-medium text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-background/80 font-mono text-xs">
                  {index + 1}
                </div>
                <span className="line-clamp-2">{page.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          {pages.map((page: any, pageIndex: number) => (
            <div
              key={pageIndex}
              ref={(el) => {
                pageRefs.current[pageIndex] = el
              }}
              data-page-index={pageIndex}
              className="mb-12 scroll-mt-24"
            >
              <Card className="mb-8 p-6">
                <h2 className="mb-1 text-2xl font-semibold">{page.title}</h2>
                <p className="text-muted-foreground">Section {pageIndex + 1}</p>
              </Card>

              <div className="space-y-8">
                {page.questions?.map((question: any) => {
                  const hasNote =
                    visibleNotes[question.id] || !!answers[question.id]?.note

                  return (
                    <Card key={question.id} className="p-6">
                      <div className="mb-4 flex justify-between">
                        <p className="leading-tight font-medium">
                          {question.question}
                          {question.isRequired && (
                            <span className="ml-1 text-destructive">*</span>
                          )}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          Q{pageIndex + 1}
                        </span>
                      </div>

                      <div className="mb-6">
                        {renderQuestionInput(question)}
                      </div>

                      {hasNote && (
                        <div className="mt-4">
                          <p className="mb-2 text-sm font-medium">Note</p>
                          <textarea
                            value={answers[question.id]?.note || ""}
                            onChange={(e) =>
                              handleNoteChange(question.id, e.target.value)
                            }
                            className="min-h-[90px] w-full rounded-lg border border-input px-4 py-3"
                            placeholder="Add your note here..."
                          />
                        </div>
                      )}

                      <div className="mt-6 flex gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleNote(question.id)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {hasNote ? "Hide Note" : "Add Note"}
                        </Button>
                        <Button variant="outline" size="sm">
                          <CloudUpload className="mr-2 h-4 w-4" />
                          Add Media
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Bottom Navigation */}
          <div className="mt-12 flex justify-between border-t pt-8">
            <Button
              variant="outline"
              onClick={() => scrollToPage(currentPageIndex - 1)}
              disabled={currentPageIndex === 0}
            >
              <ChevronLeft className="mr-2" /> Previous
            </Button>

            {currentPageIndex === pages.length - 1 ? (
              <Button onClick={handleSubmit} size="lg" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Inspection"}
              </Button>
            ) : (
              <Button
                onClick={() => scrollToPage(currentPageIndex + 1)}
                size="lg"
              >
                Next Page
                <ChevronRight className="ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
