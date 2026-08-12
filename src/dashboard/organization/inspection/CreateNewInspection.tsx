/* eslint-disable @typescript-eslint/no-explicit-any */
import MediaThumbnail from "@/components/shared/MediaThumbnail"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useUploadAnyFileAwsMutation } from "@/redux/apis/common.api"
import { useCreateNewInspectionMutation } from "@/redux/apis/organization/inspection.api"
import { useGetSingleTemplateQuery } from "@/redux/apis/organization/template.api"
import { getMediaKindFromMime } from "@/utils/fileType"
import { validateInspectionFile } from "@/utils/inspectionFileValidation"
import { parseSliderDefault } from "@/utils/parseSliderDefault"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  FileText,
  Globe,
} from "lucide-react"
import type { TFunction } from "i18next"
import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"
import { toast } from "sonner"

type AnswerEntry = {
  answer: any
  note: string
  mediaFiles: { url: string; type: string }[]
}

// quality-bar-loop (Inspections, round 10, efficiency finding): this whole
// per-question Card used to be inlined in the parent's page.questions.map,
// so editing ANY question's answer re-rendered the entire question tree on
// every keystroke (same class of issue InspectionReport.tsx's own memoized
// QuestionCard/PageSection already avoids). Extracted here as a memoized
// component with only primitive/stable props -- `question` is a stable
// reference from the loaded template, `t` is react-i18next's own stable
// function reference (same convention InspectionReport.tsx already relies
// on), and every callback prop is wrapped in useCallback with no/stable
// deps in the parent below, so React.memo's shallow prop comparison
// actually blocks a re-render for every sibling question whose own
// answer/note/mediaFiles/uploading state didn't change.
const QuestionCard = memo(
  ({
    question,
    questionIndex,
    answer,
    note,
    mediaFiles,
    isNoteVisible,
    isAnswerMediaUploading,
    isExternalMediaUploading,
    onAnswerChange,
    onNoteChange,
    onToggleNote,
    onAnswerMediaUpload,
    onExternalMediaUpload,
    onRemoveMediaFile,
    t,
  }: {
    question: any
    questionIndex: number
    answer: any
    note: string
    mediaFiles: { url: string; type: string }[]
    isNoteVisible: boolean
    isAnswerMediaUploading: boolean
    isExternalMediaUploading: boolean
    onAnswerChange: (questionId: string, value: any) => void
    onNoteChange: (questionId: string, note: string) => void
    onToggleNote: (questionId: string) => void
    onAnswerMediaUpload: (questionId: string, file: File) => void
    onExternalMediaUpload: (questionId: string, files: FileList) => void
    onRemoveMediaFile: (questionId: string, fileIndex: number) => void
    t: TFunction
  }) => {
    const hasNote = isNoteVisible || !!note
    const hasMediaFiles = mediaFiles?.length > 0

    const renderQuestionInput = () => {
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
            // quality-bar-loop (Inspections, round 31, accessibility
            // finding): same fix as UpdateInspection.tsx's identical
            // control -- aria-labelledby combines the sibling question
            // <p>'s id with this state span's own id, so the accessible
            // name is "<question text> Yes/No" rather than just "Yes"/
            // "No" with no question context.
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={!!answer}
                onChange={(e) =>
                  onAnswerChange(question.id, e.target.checked)
                }
                aria-labelledby={`question-label-${question.id} checkbox-state-${question.id}`}
                className="h-5 w-5 accent-primary"
              />
              <span id={`checkbox-state-${question.id}`}>
                {answer
                  ? t("organization.inspection.yes")
                  : t("organization.inspection.no")}
              </span>
            </label>
          )

        case "slider":
          return (
            // quality-bar-loop (Inspections, round 21, accessibility
            // finding): this range input had no id/label/aria-label
            // tying it to the question text rendered in the sibling <p>
            // below -- a screen-reader user tabbing here heard only
            // "slider" with no name at all. aria-labelledby points at
            // that <p>'s id (already unique per question) rather than
            // duplicating the question text into a new aria-label
            // string, so a copy edit in one place stays in sync with the
            // other -- same fix as the date/multipleSelect cases below.
            <div className="space-y-3">
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={answer ?? 5}
                onChange={(e) =>
                  onAnswerChange(question.id, parseFloat(e.target.value))
                }
                aria-labelledby={`question-label-${question.id}`}
                className="w-full accent-primary"
              />
              <div className="text-center text-xl font-semibold text-primary">
                {answer ?? 5}
              </div>
            </div>
          )

        case "date":
          return (
            <input
              type="date"
              value={answer ?? ""}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              aria-labelledby={`question-label-${question.id}`}
              className="w-full rounded-lg border border-input px-4 py-3 focus:ring-2 focus:ring-primary"
            />
          )

        case "multipleSelect": {
          const options = question.value
            ? String(question.value).replace(/['"]/g, "").split(",")
            : []
          return (
            <select
              value={answer ?? ""}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              aria-labelledby={`question-label-${question.id}`}
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

        case "media": {
          return (
            <>
              {isAnswerMediaUploading ? (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                  <p className="text-sm text-muted-foreground">
                    {t("organization.inspection.uploadingMedia")}
                  </p>
                </div>
              ) : answer ? (
                // quality-bar-loop (Inspections, round 45, code-quality
                // finding): this video/document/image branch was
                // independently copy-pasted across this file and
                // UpdateInspection.tsx, twice each -- extracted to
                // MediaThumbnail (round 41's PR review first recommended
                // this, round 43 made the duplication worse by porting a
                // fourth copy instead).
                <MediaThumbnail
                  url={answer}
                  variant="answer"
                  onDelete={() => onAnswerChange(question.id, "")}
                  deleteLabel={t("organization.inspection.deleteMedia")}
                  t={t}
                />
              ) : (
                <label htmlFor={`dropzone-file-${question.id}`}>
                  <input
                    onChange={(e) => {
                      const file = (e.target as HTMLInputElement)?.files?.[0]
                      if (file) {
                        onAnswerMediaUpload(question.id, file)
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
                    // control was keyboard-unreachable (WCAG 2.1.1).
                    // `sr-only` keeps it visually hidden but focusable, so
                    // Tab reaches it and Enter/Space opens the native file
                    // picker (a real `<input type="file">`'s own built-in
                    // keyboard behavior).
                    //
                    // quality-bar-loop (Inspections, round 52, accessibility
                    // finding): `sr-only` clips the input to 1x1px, so a
                    // focus ring on the input itself would never render --
                    // this left keyboard focus with NO visible indicator at
                    // all (WCAG 2.4.7), reachable but invisible. `peer`
                    // lets the sibling Button (the actual visible control)
                    // react to this input's focus state instead.
                    className="peer sr-only"
                  />
                  <Button
                    asChild
                    variant="outline"
                    className="flex w-full cursor-pointer items-center gap-2 py-6 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/30 peer-focus-visible:outline-none"
                  >
                    <span>
                      <CloudUpload className="h-5 w-5" />
                      {t("organization.inspection.uploadMediaDocuments")}
                    </span>
                  </Button>
                </label>
              )}
            </>
          )
        }

        default:
          // quality-bar-loop (Inspections, round 31, accessibility
          // finding): the free-text answer -- the single most common
          // question type -- had no accessible name at all.
          return (
            <textarea
              value={answer ?? ""}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              rows={5}
              aria-labelledby={`question-label-${question.id}`}
              className="min-h-30 w-full resize-y rounded-lg border border-input px-4 py-3 focus:ring-2 focus:ring-primary"
              placeholder={t("organization.inspection.answerPlaceholder")}
            />
          )
      }
    }

    return (
      // quality-bar-loop (Inspections, round 48, UX finding): the missing-
      // required-question error already named the question and scrolled its
      // page into view, but never moved focus there -- id + tabIndex={-1}
      // lets handleSubmit call .focus() on the actual card after scrolling,
      // same anchor for every answer type (not just checkbox/slider).
      <Card
        id={`question-card-${question.id}`}
        tabIndex={-1}
        // quality-bar-loop (Inspections, round 52, accessibility finding):
        // programmatic .focus() on this card previously had nothing to
        // announce -- no role/aria-label pointed at why a screen reader
        // landed here. aria-labelledby reuses the sibling <p>'s existing id
        // (already the accessible name source for this question's own
        // answer input) so a copy edit in one place stays in sync.
        aria-labelledby={`question-label-${question.id}`}
        // quality-bar-loop (Inspections, round 50, visual-polish finding):
        // round 48 shipped this at full ring opacity, visibly harsher than
        // every other error indicator in the design system, which pairs
        // `border-destructive` with a softened `ring-destructive/20`
        // (`/40` dark) -- see input.tsx/textarea.tsx/select.tsx's
        // `aria-invalid:` variants. Card has no border utility of its own
        // (only its default `ring-1 ring-foreground/10`), so match the
        // opacity convention on the ring alone rather than bolting on an
        // unrelated border.
        //
        // quality-bar-loop (Inspections, round 52, accessibility finding):
        // round 50's `/20`/`/40` values matched the *convention*, but this
        // Card has no border to share the burden with -- the ring is its
        // ONLY error indicator, and at that opacity it computed to ~1.4:1
        // against the white card background (measured via the actual
        // --destructive/--card HSL tokens), well under WCAG 1.4.11's 3:1
        // non-text-contrast floor. `/70` computes to ~4.6:1 in light mode
        // and clears 3:1 in dark mode too -- still visibly softer than
        // round 48's full-opacity original (a real contrast/harshness
        // trade-off, resolved in contrast's favor since this ring is this
        // card's sole visual error signal, not a supplementary one).
        //
        // quality-bar-loop (Inspections, round 50, mobile finding): this
        // page's `sticky top-0` header can reach ~129px tall at the 375px
        // mobile viewport this was measured at (long template name wraps
        // to 2 lines), and a browser's native "scroll the newly-focused
        // element into view" aligns this card's top edge with the
        // viewport's top edge -- landing the question text this whole
        // mechanism exists to surface right under the sticky header.
        // `scroll-mt-40` (160px) gives the native scroll a safe offset to
        // respect, with headroom beyond the 375px-measured height for a
        // narrower device (e.g. 320px) wrapping the header's page-count
        // badge onto its own row as well.
        className="scroll-mt-40 p-6 focus:ring-2 focus:ring-destructive/70 focus:outline-none dark:focus:ring-destructive/70"
      >
        <div className="mb-4 flex justify-between">
          <p
            id={`question-label-${question.id}`}
            className="leading-tight font-medium"
          >
            {question.question}
            {question.isRequired && (
              <span className="ml-1 text-destructive">*</span>
            )}
          </p>
          {/* Found by review (quality-bar-loop round 2, live-confirmed
              with 3 distinct questions on one page): this badge used
              `pageIndex + 1`, so every question on a page showed the same
              "Q1" regardless of its real position -- InspectionReport.tsx's
              QuestionCard already numbers by questionIndex + 1 correctly. */}
          <span className="text-xs text-muted-foreground">
            {t("organization.inspection.questionBadge", {
              num: questionIndex + 1,
            })}
          </span>
        </div>

        <div className="mb-6">{renderQuestionInput()}</div>
        {hasMediaFiles && (
          <div className="flex items-center gap-5">
            {mediaFiles.map((mediaFile: any, idx: number) => (
              <MediaThumbnail
                key={idx}
                url={mediaFile.url}
                variant="thumbnail"
                onDelete={() => onRemoveMediaFile(question.id, idx)}
                deleteLabel={t("organization.inspection.removeMedia")}
                t={t}
              />
            ))}
          </div>
        )}
        {hasNote && (
          <div className="mt-4">
            {/* quality-bar-loop (Inspections, round 31, accessibility
                finding): same fix as UpdateInspection.tsx's identical
                note field -- this label was a visual-only sibling with
                no id/htmlFor. */}
            <p
              id={`note-label-${question.id}`}
              className="mb-2 text-sm font-medium"
            >
              {t("organization.inspection.note")}
            </p>
            <textarea
              value={note || ""}
              onChange={(e) => onNoteChange(question.id, e.target.value)}
              aria-labelledby={`note-label-${question.id}`}
              className="min-h-22.5 w-full rounded-lg border border-input px-4 py-3"
              placeholder={t("organization.inspection.notePlaceholder")}
            />
          </div>
        )}

        {/* quality-bar-loop round 2 (mobile, round-1 finding): `size="sm"`
            resolves to `h-6` (24px tall), well under the 44px
            touch-target guideline -- same bug class fixed on 9+ pages
            this session. */}
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleNote(question.id)}
            className="h-11"
          >
            <FileText className="mr-2 h-4 w-4" />
            {hasNote
              ? t("organization.inspection.hideNote")
              : t("organization.inspection.addNote")}
          </Button>

          {isExternalMediaUploading ? (
            <p className="flex items-center gap-1 text-xs text-yellow-600">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-yellow-600 border-t-transparent"></span>
              {t("organization.inspection.uploading")}
            </p>
          ) : (
            <label htmlFor={`external-media-${question.id}`}>
              <input
                onChange={(e) => {
                  const files = (e.target as HTMLInputElement)?.files
                  if (files) {
                    onExternalMediaUpload(question.id, files)
                  }
                  e.target.value = ""
                }}
                id={`external-media-${question.id}`}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                // quality-bar-loop round 7 (accessibility) -- see the
                // comment on the other file input in this file. `peer` --
                // round 52's accessibility fix, same file -- lets the
                // sibling Button react to this input's focus state, since
                // `sr-only` clips any focus ring on the input itself.
                className="peer sr-only"
              />
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-11 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/30 peer-focus-visible:outline-none"
              >
                <span>
                  <CloudUpload className="mr-2 h-4 w-4" />
                  {t("organization.inspection.addMedia")}
                </span>
              </Button>
            </label>
          )}
        </div>
      </Card>
    )
  }
)

export default function CreateNewInspection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state } = useLocation()

  const templateId = state?.templateId
  const siteId = state?.siteId
  const siteName = state?.siteName

  // quality-bar-loop (Inspections, round 12, resilience finding): never
  // checked isError, only isLoading -- a failed template fetch rendered a
  // fully-styled, zero-section inspection form, indistinguishable from a
  // legitimately empty template. Same bug class round 5 already fixed for
  // InspectionReport.tsx/StartInspectionModal.tsx, missed here.
  const {
    data: templateData,
    isLoading,
    isError: isTemplateError,
  } = useGetSingleTemplateQuery(templateId, { skip: !templateId })

  const [createInspection, { isLoading: isSubmitting }] =
    useCreateNewInspectionMutation()
  const [uploadFileAws] = useUploadAnyFileAwsMutation()

  const template = templateData?.data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pages = template?.pages || []

  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerEntry>>({})
  // quality-bar-loop (Inspections, round 46, UX finding): checkbox/slider
  // questions are seeded below with a real default value (false / a
  // numeric default), same as every other answer type, so the payload
  // this page submits always carries a real value for them -- changing
  // that seeding to null/undefined would send a missing `answer` field
  // for an untouched question, and aexa-server's QuestionAnswer.answer
  // column is a non-nullable Json with no default (confirmed in
  // inspection.prisma/inspection.service.ts's create_inspection_into_db),
  // so that would break inspection creation outright for any untouched
  // non-required checkbox/slider. Tracking "has this question actually
  // been interacted with in this session" separately, rather than trying
  // to encode it in the answer value itself, fixes the required-field
  // gate below without touching the submission payload or the backend at
  // all. Deliberately never pre-populated from anything -- there's no way
  // to know in retrospect whether an already-loaded answer was ever
  // really touched, so treating every checkbox/slider as untouched until
  // this session's own onChange fires is the honest, safe default.
  const [touchedQuestionIds, setTouchedQuestionIds] = useState<Set<string>>(
    new Set()
  )

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

  // quality-bar-loop (Inspections, round 10, efficiency finding): these
  // three all already used the functional setState-updater form, so none
  // of them actually needed `answers`/`visibleNotes` in a dependency array
  // -- wrapping in useCallback with an empty dep array makes them
  // referentially stable forever, a prerequisite for QuestionCard's
  // React.memo below to actually prevent re-rendering sibling questions.
  const handleAnswerChange = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], answer: value },
    }))
    setTouchedQuestionIds((prev) => {
      if (prev.has(questionId)) return prev
      const next = new Set(prev)
      next.add(questionId)
      return next
    })
  }, [])

  const handleNoteChange = useCallback((questionId: string, note: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], note },
    }))
  }, [])

  const toggleNote = useCallback((questionId: string) => {
    setVisibleNotes((prev) => ({ ...prev, [questionId]: !prev[questionId] }))
  }, [])

  // quality-bar-loop (Inspections, round 46, UX finding): checkbox/slider
  // questions are seeded with a real default value (false / 5) that's
  // indistinguishable from a genuine answer -- `answer === undefined ||
  // answer === null` here was true precisely never in practice, so a
  // required checkbox/slider the user never touched silently passed this
  // check. `touchedQuestionIds` (tracked in handleAnswerChange above) is
  // the real "was this actually answered" signal for these two types;
  // every other answer type's blank default genuinely is `""`, so their
  // existing check is untouched.
  const isAnswerEmpty = (
    answerType: string,
    answer: any,
    questionId: string
  ) => {
    if (answerType === "checkbox" || answerType === "slider") {
      return !touchedQuestionIds.has(questionId)
    }
    return answer === undefined || answer === null || answer === ""
  }

  const findFirstMissingRequiredQuestion = () => {
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex]
      for (const question of page.questions || []) {
        if (!question.isRequired) continue
        const answer = answers[question.id]?.answer
        if (isAnswerEmpty(question.answerType, answer, question.id)) {
          return { pageIndex, question }
        }
      }
    }
    return null
  }

  const handleSubmit = async () => {
    if (!templateId || !siteId) {
      toast.error(t("organization.inspection.missingInfoToast"), {
        position: "top-center",
      })
      return
    }

    const missingRequired = findFirstMissingRequiredQuestion()
    if (missingRequired) {
      // quality-bar-loop (Inspections, round 48, mobile finding): the
      // default bottom-anchored toast position fully covered this page's
      // sticky bottom Submit button at mobile widths, hiding the exact
      // control the toast was telling the user to use next. This is the
      // only page in the feature with a sticky bottom action bar, so the
      // override is scoped to this call rather than changed globally.
      toast.error(
        t("organization.inspection.requiredAnswerMissingToast", {
          question: missingRequired.question.question,
        }),
        { position: "top-center" }
      )
      scrollToPage(missingRequired.pageIndex)
      document
        .getElementById(`question-card-${missingRequired.question.id}`)
        ?.focus()
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

  const handleAnswerMediaUpload = useCallback(
    async (questionId: string, file: File) => {
      // validation
      if (!file || !questionId) return

      const validation = validateInspectionFile(file)
      if (!validation.valid) {
        toast.error(
          t(
            validation.reason === "size"
              ? "organization.inspection.fileSizeError"
              : "organization.inspection.fileTypeError"
          )
        )
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
    },
    [uploadFileAws, t, handleAnswerChange]
  )

  // for media file

  const handleExternalMediaUpload = useCallback(
    async (questionId: string, files: FileList | File[]) => {
      if (!questionId || !files || files.length === 0) return

      // Convert FileList to array if needed
      const fileArray = Array.isArray(files) ? files : Array.from(files)

      // Set uploading state for this question
      setExternalMediaUploading(questionId)

      try {
        // Upload all files in parallel
        const uploadPromises = fileArray.map(async (file) => {
          const validation = validateInspectionFile(file)
          if (!validation.valid) {
            toast.error(
              t(
                validation.reason === "size"
                  ? "organization.inspection.fileTooLargeNamed"
                  : "organization.inspection.fileTypeNamedError",
                { name: file.name }
              )
            )
            return null
          }

          const formdata = new FormData()
          formdata.append("file", file)
          const res = await uploadFileAws(formdata).unwrap()

          if (res?.success && res?.data) {
            return { url: res.data, type: getMediaKindFromMime(file.type) }
          }
          return null
        })

        // Wait for all uploads to complete
        const uploadedFiles = await Promise.all(uploadPromises)
        const validFiles = uploadedFiles.filter((file) => file !== null)

        if (validFiles.length > 0) {
          // quality-bar-loop (Inspections, round 10, efficiency finding):
          // reads `prev[questionId]` inside the functional updater instead
          // of closing over the outer `answers` state -- keeps this
          // callback's own dependency array free of `answers`, which
          // changes on every keystroke and would otherwise make this
          // handler (and every QuestionCard it's passed to) unstable.
          setAnswers((prev) => {
            const existingMediaFiles = prev[questionId]?.mediaFiles || []
            const updatedMediaFiles = [...existingMediaFiles, ...validFiles]
            return {
              ...prev,
              [questionId]: {
                ...prev[questionId],
                mediaFiles: updatedMediaFiles,
              },
            }
          })

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
    },
    [uploadFileAws, t]
  )

  // Function to remove a specific media file. Reads `prev[questionId]`
  // inside the functional updater for the same reason as
  // handleExternalMediaUpload above -- keeps this useCallback's deps free
  // of `answers`.
  const handleRemoveMediaFile = useCallback(
    (questionId: string, fileIndex: number) => {
      setAnswers((prev) => {
        const currentMediaFiles = prev[questionId]?.mediaFiles || []
        const updatedMediaFiles = currentMediaFiles.filter(
          (_, index) => index !== fileIndex
        )
        return {
          ...prev,
          [questionId]: {
            ...prev[questionId],
            mediaFiles: updatedMediaFiles,
          },
        }
      })
      toast.success(t("organization.inspection.mediaRemovedToast"))
    },
    [t]
  )

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {t("organization.inspection.loadingTemplate")}
      </div>
    )
  }

  if (isTemplateError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p role="alert" className="text-lg text-muted-foreground">
          {t("organization.inspection.templateLoadError")}
        </p>
        <Button onClick={() => navigate("/organization/audit/inspections")}>
          {t("organization.inspection.backToInspections")}
        </Button>
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
                type="button"
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
                {page.questions?.map((question: any, questionIndex: number) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    questionIndex={questionIndex}
                    answer={answers[question.id]?.answer}
                    note={answers[question.id]?.note || ""}
                    mediaFiles={answers[question.id]?.mediaFiles || []}
                    isNoteVisible={!!visibleNotes[question.id]}
                    isAnswerMediaUploading={isAnswerMediaUploading === question.id}
                    isExternalMediaUploading={externalMediaUploading === question.id}
                    onAnswerChange={handleAnswerChange}
                    onNoteChange={handleNoteChange}
                    onToggleNote={toggleNote}
                    onAnswerMediaUpload={handleAnswerMediaUpload}
                    onExternalMediaUpload={handleExternalMediaUpload}
                    onRemoveMediaFile={handleRemoveMediaFile}
                    t={t}
                  />
                ))}
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
