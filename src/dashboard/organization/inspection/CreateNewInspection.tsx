/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useUploadAnyFileAwsMutation } from "@/redux/apis/common.api"
import { useCreateNewInspectionMutation } from "@/redux/apis/organization/inspection.api"
import { useGetSingleTemplateQuery } from "@/redux/apis/organization/template.api"
import { isHttpUrl } from "@/utils/isHttpUrl"
import { parseSliderDefault } from "@/utils/parseSliderDefault"
import { PLACEHOLDER_IMAGE_SRC } from "@/utils/placeholderImage"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  FileText,
  Globe,
  Trash,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"
import { toast } from "sonner"

type AnswerEntry = {
  answer: any
  note: string
  mediaFiles: { url: string; type: string }[]
}

export default function CreateNewInspection() {
  const { t } = useTranslation()
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
  const [uploadFileAws] = useUploadAnyFileAwsMutation()

  const template = templateData?.data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pages = template?.pages || []

  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerEntry>>({})

  const [visibleNotes, setVisibleNotes] = useState<Record<string, boolean>>({})
  const [isAnswerMediaUploading, setIsAnswerMediaUploading] = useState<
    string | null
  >(null)
  const [externalMediaUploading, setExternalMediaUploading] = useState<
    string | null
  >(null)

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
        if (q.answerType === "slider")
          defaultAnswer = parseSliderDefault(q.value)

        initial[q.id] = {
          answer: defaultAnswer,
          note: "",
          mediaFiles: [],
        }
      })
    })

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

  // checkbox/slider questions always carry a real default value (false / 5)
  // once initialized, so an "empty" answer there would mean init hasn't run
  // yet, not that the user skipped it -- only guard against null/undefined.
  // Every other answer type defaults to "" and genuinely means unanswered.
  const isAnswerEmpty = (answerType: string, answer: any) => {
    if (answerType === "checkbox" || answerType === "slider") {
      return answer === undefined || answer === null
    }
    return answer === undefined || answer === null || answer === ""
  }

  const findFirstMissingRequiredQuestion = () => {
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex]
      for (const question of page.questions || []) {
        if (!question.isRequired) continue
        const answer = answers[question.id]?.answer
        if (isAnswerEmpty(question.answerType, answer)) {
          return { pageIndex, question }
        }
      }
    }
    return null
  }

  const handleSubmit = async () => {
    if (!templateId || !siteId) {
      toast.error(t("organization.inspection.missingInfoToast"))
      return
    }

    const missingRequired = findFirstMissingRequiredQuestion()
    if (missingRequired) {
      toast.error(
        t("organization.inspection.requiredAnswerMissingToast", {
          question: missingRequired.question.question,
        })
      )
      scrollToPage(missingRequired.pageIndex)
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

    try {
      await createInspection(payload).unwrap()
      toast.success(t("organization.inspection.submittedToast"))
      navigate("/organization/audit/inspections")
    } catch (error: any) {
      toast.error(
        error?.data?.message || t("organization.inspection.submitFailedToast")
      )
    }
  }

  const handleAnswerMediaUpload = async (questionId: string, file: File) => {
    // validation
    if (!file || !questionId) return

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("organization.inspection.fileSizeError"))
      return
    }

    // Check file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "application/pdf",
    ]
    if (!allowedTypes.includes(file.type)) {
      toast.error(t("organization.inspection.fileTypeError"))
      return
    }

    setIsAnswerMediaUploading(questionId)

    try {
      const formdata = new FormData()
      formdata.append("file", file)
      const res = await uploadFileAws(formdata).unwrap()

      if (res?.success && res?.data) {
        handleAnswerChange(questionId, res.data)
        toast.success(t("organization.inspection.mediaUploadedToast"))
      } else {
        toast.error(t("organization.inspection.mediaUploadFailedToast"))
      }
    } catch (error: any) {
      toast.error(
        error?.message || t("organization.inspection.mediaUploadFailedToast")
      )
    } finally {
      setIsAnswerMediaUploading(null)
    }
  }

  // for media file

  const handleExternalMediaUpload = async (
    questionId: string,
    files: FileList | File[]
  ) => {
    if (!questionId || !files || files.length === 0) return

    // Convert FileList to array if needed
    const fileArray = Array.isArray(files) ? files : Array.from(files)

    // Set uploading state for this question
    setExternalMediaUploading(questionId)

    try {
      // Upload all files in parallel
      const uploadPromises = fileArray.map(async (file) => {
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(
            t("organization.inspection.fileTooLargeNamed", { name: file.name })
          )
          return null
        }

        // Validate file type
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "video/mp4",
          "application/pdf",
        ]
        if (!allowedTypes.includes(file.type)) {
          toast.error(
            t("organization.inspection.fileTypeNamedError", { name: file.name })
          )
          return null
        }

        const formdata = new FormData()
        formdata.append("file", file)
        const res = await uploadFileAws(formdata).unwrap()

        if (res?.success && res?.data) {
          return { url: res.data, type: "image" }
        }
        return null
      })

      // Wait for all uploads to complete
      const uploadedFiles = await Promise.all(uploadPromises)
      const validFiles = uploadedFiles.filter((file) => file !== null)

      if (validFiles.length > 0) {
        // Get existing media files
        const existingMediaFiles = answers[questionId]?.mediaFiles || []

        // Append new files
        const updatedMediaFiles = [...existingMediaFiles, ...validFiles]

        // Update answers with new mediaFiles array
        setAnswers((prev) => ({
          ...prev,
          [questionId]: {
            ...prev[questionId],
            mediaFiles: updatedMediaFiles,
          },
        }))

        toast.success(
          t("organization.inspection.filesUploadedToast", {
            count: validFiles.length,
          })
        )
      } else {
        toast.error(t("organization.inspection.filesUploadFailedToast"))
      }
    } catch (error: any) {
      toast.error(
        error?.message ||
          t("organization.inspection.mediaFilesUploadFailedToast")
      )
    } finally {
      setExternalMediaUploading(null)
    }
  }

  // Function to remove a specific media file
  const handleRemoveMediaFile = (questionId: string, fileIndex: number) => {
    const currentMediaFiles = answers[questionId]?.mediaFiles || []
    const updatedMediaFiles = currentMediaFiles.filter(
      (_, index) => index !== fileIndex
    )

    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        mediaFiles: updatedMediaFiles,
      },
    }))

    toast.success(t("organization.inspection.mediaRemovedToast"))
  }

  const renderQuestionInput = (question: any) => {
    const value = answers[question.id]?.answer
    const answerType = question.answerType

    switch (answerType) {
      case "checkbox":
        return (
          // quality-bar-loop round 2 (mobile, round-1 finding): the
          // native checkbox's own visual box (h-5, 20px) is well under
          // the 44px touch-target guideline, and unlike a Button the
          // fix isn't a className override on the input itself -- WCAG's
          // target-size rule is about the clickable AREA, not the visual
          // indicator, so `min-h-11` on the wrapping <label> (which
          // already toggles the checkbox on click via native label
          // association) extends the real tappable area to 44px while
          // keeping the checkbox's own visual size unchanged.
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) =>
                handleAnswerChange(question.id, e.target.checked)
              }
              className="h-5 w-5 accent-primary"
            />
            <span>
              {value
                ? t("organization.inspection.yes")
                : t("organization.inspection.no")}
            </span>
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
            <option value="">
              {t("organization.inspection.selectOption")}
            </option>
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
          <>
            {isAnswerMediaUploading === question.id ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                <p className="text-sm text-muted-foreground">
                  {t("organization.inspection.uploadingMedia")}
                </p>
              </div>
            ) : value && !isHttpUrl(value) ? (
              // quality-bar-loop (Inspections, round 3, security finding):
              // `value` is client-supplied and rendered straight into
              // <img src> below -- guard the same way InspectionReport.tsx/
              // UpdateInspection.tsx do before it reaches that sink.
              <p className="text-sm text-muted-foreground italic">
                {t("organization.inspection.unsafeAttachment")}
              </p>
            ) : value ? (
              <div className="group relative flex w-full items-center justify-center overflow-hidden rounded-lg border">
                <img
                  src={value}
                  alt={t("organization.inspection.uploadedMediaAlt")}
                  className="max-h-96 max-w-full object-contain transition-transform group-hover:scale-105"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE_SRC
                  }}
                />
                <button
                  onClick={() => handleAnswerChange(question.id, "")}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <span className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white">
                    {t("organization.inspection.deleteMedia")}
                  </span>
                </button>
              </div>
            ) : (
              <label htmlFor={`dropzone-file-${question.id}`}>
                <Button
                  asChild
                  variant="outline"
                  className="flex w-full cursor-pointer items-center gap-2 py-6"
                >
                  <span>
                    <CloudUpload className="h-5 w-5" />
                    {t("organization.inspection.uploadMediaDocuments")}
                  </span>
                </Button>
                <input
                  onChange={(e) => {
                    const file = (e.target as HTMLInputElement)?.files?.[0]
                    if (file) {
                      handleAnswerMediaUpload(question.id, file)
                    }
                    // Reset input value so same file can be uploaded again
                    e.target.value = ""
                  }}
                  id={`dropzone-file-${question.id}`}
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  // quality-bar-loop (Inspections, round 7, accessibility
                  // finding): `hidden`/`display:none` removes the input
                  // from the tab order entirely -- this whole upload
                  // control was keyboard-unreachable (WCAG 2.1.1). `sr-only`
                  // keeps it visually hidden but focusable, so Tab reaches
                  // it and Enter/Space opens the native file picker (a real
                  // `<input type="file">`'s own built-in keyboard behavior).
                  className="sr-only"
                />
              </label>
            )}
          </>
        )

      default:
        return (
          <textarea
            value={value ?? ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            rows={5}
            className="min-h-30 w-full resize-y rounded-lg border border-input px-4 py-3 focus:ring-2 focus:ring-primary"
            placeholder={t("organization.inspection.answerPlaceholder")}
          />
        )
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {t("organization.inspection.loadingTemplate")}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <div className="sticky top-0 z-50 border-b bg-card">
        {/* quality-bar-loop round 2 (mobile, round-1 finding): same
            wrap fix as UpdateInspection.tsx's identical header
            structure -- a long template name pushes the h1 to multiple
            lines, and this row had no flex-wrap/items-start to handle
            that gracefully. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)} className="h-11">
              <ArrowLeft className="mr-2 h-5 w-5" />{" "}
              {t("organization.inspection.back")}
            </Button>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{template?.templateName}</h1>
              {siteName && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" /> {siteName}
                </p>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {t("organization.inspection.pageOf", {
              current: currentPageIndex + 1,
              total: pages.length,
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto flex gap-8 px-6 py-8">
        {/* Sticky Left Navigation - Using Only Index */}
        <div className="hidden w-72 lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 px-3 text-sm font-semibold text-muted-foreground">
              {t("organization.inspection.pages")}
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
                <p className="text-muted-foreground">
                  {t("organization.inspection.section", { num: pageIndex + 1 })}
                </p>
              </Card>

              <div className="space-y-8">
                {page.questions?.map((question: any, questionIndex: number) => {
                  const hasNote =
                    visibleNotes[question.id] || !!answers[question.id]?.note
                  const hasMediaFiles = answers[question.id]?.mediaFiles

                  return (
                    <Card key={question.id} className="p-6">
                      <div className="mb-4 flex justify-between">
                        <p className="leading-tight font-medium">
                          {question.question}
                          {question.isRequired && (
                            <span className="ml-1 text-destructive">*</span>
                          )}
                        </p>
                        {/* Found by review (quality-bar-loop round 2,
                            live-confirmed with 3 distinct questions on
                            one page): this badge used `pageIndex + 1`,
                            so every question on a page showed the same
                            "Q1" regardless of its real position --
                            InspectionReport.tsx's QuestionCard already
                            numbers by questionIndex + 1 correctly. */}
                        <span className="text-xs text-muted-foreground">
                          {t("organization.inspection.questionBadge", {
                            num: questionIndex + 1,
                          })}
                        </span>
                      </div>

                      <div className="mb-6">
                        {renderQuestionInput(question)}
                      </div>
                      {hasMediaFiles && (
                        <div className="flex items-center gap-5">
                          {hasMediaFiles.map((mediaFile: any, idx: number) => (
                            <div key={idx} className="relative">
                              {/* Found by review (quality-bar-loop round
                                  2): this was a `<span onClick>` -- no
                                  role/tabIndex/keyboard handler, a genuine
                                  keyboard trap (couldn't be focused or
                                  activated from the keyboard at all).
                                  UpdateInspection.tsx's equivalent control
                                  already uses a real `<button
                                  aria-label>`; this brings the two in
                                  line, including the dark-mode colors
                                  that file already has and this one
                                  didn't. */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveMediaFile(question.id, idx)
                                }
                                aria-label={t(
                                  "organization.inspection.removeMedia"
                                )}
                                className="absolute -top-2 -right-2 rounded-full bg-amber-100 p-1 text-red-500 dark:bg-amber-900 dark:text-red-400"
                              >
                                <Trash className="size-4" />
                              </button>
                              {isHttpUrl(mediaFile.url) ? (
                                <img
                                  className="h-12 w-12"
                                  src={mediaFile.url}
                                  alt=""
                                />
                              ) : (
                                // quality-bar-loop (Inspections, round 3,
                                // security finding): same render-sink guard
                                // as the single-answer media case above.
                                <div className="flex h-12 w-12 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground">
                                  {t("organization.inspection.unsafeAttachment")}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {hasNote && (
                        <div className="mt-4">
                          <p className="mb-2 text-sm font-medium">
                            {t("organization.inspection.note")}
                          </p>
                          <textarea
                            value={answers[question.id]?.note || ""}
                            onChange={(e) =>
                              handleNoteChange(question.id, e.target.value)
                            }
                            className="min-h-22.5 w-full rounded-lg border border-input px-4 py-3"
                            placeholder={t(
                              "organization.inspection.notePlaceholder"
                            )}
                          />
                        </div>
                      )}

                      {/* quality-bar-loop round 2 (mobile, round-1
                          finding): `size="sm"` resolves to `h-6` (24px
                          tall), well under the 44px touch-target
                          guideline -- same bug class fixed on 9+ pages
                          this session. */}
                      <div className="mt-6 flex gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleNote(question.id)}
                          className="h-11"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {hasNote
                            ? t("organization.inspection.hideNote")
                            : t("organization.inspection.addNote")}
                        </Button>

                        {externalMediaUploading == question.id ? (
                          <p className="flex items-center gap-1 text-xs text-yellow-600">
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-yellow-600 border-t-transparent"></span>
                            {t("organization.inspection.uploading")}
                          </p>
                        ) : (
                          <label htmlFor={`external-media-${question.id}`}>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-11"
                            >
                              <span>
                                <CloudUpload className="mr-2 h-4 w-4" />
                                {t("organization.inspection.addMedia")}
                              </span>
                            </Button>
                            <input
                              onChange={(e) => {
                                const files = (e.target as HTMLInputElement)
                                  ?.files
                                if (files) {
                                  handleExternalMediaUpload(question.id, files)
                                }
                                e.target.value = ""
                              }}
                              id={`external-media-${question.id}`}
                              type="file"
                              multiple
                              accept="image/*,video/*,application/pdf"
                              // quality-bar-loop round 7 (accessibility) --
                              // see the comment on the other file input in
                              // this file.
                              className="sr-only"
                            />
                          </label>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Bottom Navigation. quality-bar-loop round 2 (mobile,
              round-1 finding): even the largest shared Button size
              (`lg`) only reaches h-8 (32px), still under the 44px
              touch-target guideline -- these are the primary submit
              controls of the entire feature, so `h-11` matters most
              here. Also `sticky bottom-0`: on a phone this bottom nav
              was previously plain in-flow, so reaching Next/Submit
              meant scrolling past every question on the current page
              first -- pinning it keeps the primary action reachable
              from anywhere on a long question page, matching the
              header's existing `sticky top-0` treatment one level up. */}
          <div className="sticky bottom-0 mt-12 flex justify-between border-t bg-background py-4">
            <Button
              variant="outline"
              onClick={() => scrollToPage(currentPageIndex - 1)}
              disabled={currentPageIndex === 0}
              className="h-11"
            >
              <ChevronLeft className="mr-2" />{" "}
              {t("organization.inspection.previous")}
            </Button>

            {currentPageIndex === pages.length - 1 ? (
              <Button
                onClick={handleSubmit}
                size="lg"
                disabled={isSubmitting}
                className="h-11"
              >
                {isSubmitting
                  ? t("organization.inspection.submitting")
                  : t("organization.inspection.submitInspection")}
              </Button>
            ) : (
              <Button
                onClick={() => scrollToPage(currentPageIndex + 1)}
                size="lg"
                className="h-11"
              >
                {t("organization.inspection.nextPage")}
                <ChevronRight className="ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
