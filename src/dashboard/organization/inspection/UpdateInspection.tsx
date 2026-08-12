// UpdateInspection.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import MediaThumbnail from "@/components/shared/MediaThumbnail"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUploadAnyFileAwsMutation } from "@/redux/apis/common.api"
import {
  useGetSingleInspectionQuery,
  useUpdateInspectionMutation,
  useUpdateInspectionQuestionAnswerMutation,
} from "@/redux/apis/organization/inspection.api"
import type { InspectionStatus } from "@/types/inspection"
import { attachmentFileName } from "@/utils/attachmentFileName"
import { getMediaKindFromMime } from "@/utils/fileType"
import { validateInspectionFile } from "@/utils/inspectionFileValidation"
import {
  getInspectionStatusLabel,
  getInspectionStatusSeverity,
} from "@/utils/inspectionStatus"
import { isHttpUrl } from "@/utils/isHttpUrl"
import { parseSliderDefault } from "@/utils/parseSliderDefault"
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  CopyCheck,
  Eye,
  FileQuestion,
  FileText,
  Globe,
  Loader2,
  Paperclip,
  Pencil,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"
import { severityBadgeClasses } from "@/utils/severityStyles"
import type { TFunction } from "i18next"
import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import TextareaAutosize from "react-textarea-autosize"
import { toast } from "sonner"
import CreateNewFindingModal from "../findings/CreateNewFindingModal"
import ViewAndEditRecommendation from "../recommendation/ViewAndEditRecommendation"
import UploadNotesModal from "./UploadNotesModal"
import UnSplitText from "./UnSplitText"

type AnswerEntry = {
  answer: any
  note: string
  mediaFiles: { url: string; type: string }[]
  questionAnswerId?: string // Store the question answer ID for updates
}
const initialFindingModalState = {
  open: false,
  additionalData: {
    questionId: "",
    inspectionId: "",
    actionTitle: "",
    actionDisc: "",
  },
}

// quality-bar-loop (Inspections, round 10, efficiency finding): this whole
// per-question Card used to be inlined in the parent's page.questions.map,
// so editing ANY question's answer re-rendered the entire question tree on
// every keystroke -- same class of issue InspectionReport.tsx's own
// memoized QuestionCard/PageSection already avoids, and the same fix
// already applied to CreateNewInspection.tsx's identical structure in this
// round. `question` is a stable reference from the loaded template, `t` is
// react-i18next's own stable function reference, and every callback prop
// is wrapped in useCallback with stable deps in the parent below, so
// React.memo's shallow prop comparison actually blocks a re-render for
// every sibling question whose own answer/note/mediaFiles/saving/uploading
// state didn't change.
const QuestionCard = memo(
  ({
    question,
    answer,
    note,
    mediaFiles,
    isSaving,
    isNoteVisible,
    isAnswerMediaUploading,
    isExternalMediaUploading,
    onAnswerChange,
    onNoteChange,
    onToggleNote,
    onAnswerMediaUpload,
    onExternalMediaUpload,
    onRemoveMediaFile,
    onAddFinding,
    t,
  }: {
    question: any
    answer: any
    note: string
    mediaFiles: { url: string; type: string }[]
    isSaving: boolean
    isNoteVisible: boolean
    isAnswerMediaUploading: boolean
    isExternalMediaUploading: boolean
    onAnswerChange: (questionId: string, value: any) => void
    onNoteChange: (questionId: string, note: string) => void
    onToggleNote: (questionId: string) => void
    onAnswerMediaUpload: (questionId: string, file: File) => void
    onExternalMediaUpload: (questionId: string, files: FileList) => void
    onRemoveMediaFile: (questionId: string, fileIndex: number) => void
    onAddFinding: (questionId: string, questionText: string) => void
    t: TFunction
  }) => {
    const hasNote = isNoteVisible || !!note
    const hasMediaFiles = mediaFiles?.length > 0

    const renderQuestionInput = () => {
      const answerType = question.answerType

      switch (answerType) {
        case "checkbox":
          return (
            // quality-bar-loop round 2 (mobile, round-1 finding): same
            // fix as CreateNewInspection.tsx's identical control -- WCAG's
            // target-size rule is about the clickable AREA, not the
            // visual indicator, so `min-h-11` on the wrapping <label>
            // extends the real tappable area to 44px while keeping the
            // checkbox's own visual size unchanged.
            // quality-bar-loop (Inspections, round 31, accessibility
            // finding): the wrapping <label> only ever gave this control
            // an accessible name of "Yes"/"No" -- never the question text
            // -- so a screen reader on a page with multiple checkbox
            // questions heard indistinguishable "Yes, checkbox"/"No,
            // checkbox" controls. aria-labelledby on the input itself
            // combines the sibling question <p>'s id with this state
            // span's own id, same combining pattern already proven for
            // the closed-status case in CreateNewFindingModal.tsx.
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
            // finding): same fix as CreateNewInspection.tsx's identical
            // control -- aria-labelledby points at the sibling question
            // <p>'s id rather than duplicating the question text into a
            // new aria-label string.
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
                // CreateNewInspection.tsx, twice each -- extracted to
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
                    // finding): same fix as CreateNewInspection.tsx's
                    // identical control -- `sr-only` clips any focus ring on
                    // the input itself, leaving keyboard focus reachable but
                    // invisible (WCAG 2.4.7). `peer` lets the sibling Button
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

        default: {
          // quality-bar-loop (Inspections, round 31, accessibility
          // finding): the free-text answer -- the single most common
          // question type -- had no accessible name at all (no id/label/
          // aria-label/aria-labelledby), unlike every other answer type
          // in this switch.
          return (
            <TextareaAutosize
              value={answer ?? ""}
              onChange={(e: any) => onAnswerChange(question.id, e.target.value)}
              rows={2}
              aria-labelledby={`question-label-${question.id}`}
              className="w-full resize-y rounded-lg border border-input px-4 py-3 focus:ring-2 focus:ring-primary"
              placeholder={t("organization.inspection.answerPlaceholder")}
            />
          )
        }
      }
    }

    return (
      // quality-bar-loop (Inspections, round 48, UX finding): same anchor
      // pattern as CreateNewInspection.tsx's QuestionCard -- lets
      // handleStatusChange focus the actual offending card after scrolling,
      // bringing this file's completion-gate error surfacing up to parity
      // with the create flow's submit-gate error surfacing.
      <Card
        id={`question-card-${question.id}`}
        tabIndex={-1}
        // quality-bar-loop (Inspections, round 52, accessibility finding):
        // same fix as CreateNewInspection.tsx's QuestionCard -- reuses the
        // sibling <p>'s existing id so a screen reader landing here via
        // programmatic focus has something to announce.
        aria-labelledby={`question-label-${question.id}`}
        // quality-bar-loop (Inspections, round 50, visual-polish finding):
        // matches the softened ring-opacity convention this app's other
        // error indicators use (input.tsx/textarea.tsx/select.tsx's
        // `aria-invalid:` variants pair `border-destructive` with
        // `ring-destructive/20`, `/40` dark) instead of round 48's original
        // full-opacity ring. This card DOES have a real border (unlike
        // CreateNewInspection.tsx's), so it gets the full pairing.
        //
        // quality-bar-loop (Inspections, round 52, accessibility finding):
        // in light mode the full-opacity `border-destructive` alone already
        // clears WCAG 1.4.11's 3:1 non-text-contrast floor (~6:1, computed
        // against the white card), so the softer `/20` ring there is fine
        // as a supplementary accent. In DARK mode neither `border/50`
        // (~2.3:1) nor `ring/40` (~1.9:1) cleared 3:1 on their own -- both
        // bumped to `/70` (computed ~3.3-3.4:1 against the dark card),
        // still visibly softer than round 48's full-opacity original.
        className="rounded-xl border border-border bg-card p-6 focus:border-destructive focus:ring-2 focus:ring-destructive/20 focus:outline-none dark:focus:border-destructive/70 dark:focus:ring-destructive/70"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p
              id={`question-label-${question.id}`}
              className="leading-tight font-medium"
            >
              {question.question}
              {question.isRequired && (
                <span className="ml-1 text-destructive">*</span>
              )}
            </p>
            {isSaving && (
              <p className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-yellow-600 border-t-transparent dark:border-yellow-400"></span>
                {t("organization.inspection.saving")}
              </p>
            )}
          </div>
        </div>

        <div className="">{renderQuestionInput()}</div>

        {hasMediaFiles && (
          <div className="flex items-center gap-5">
            {mediaFiles.map((mediaFile: any, idx: number) => (
              <MediaThumbnail
                key={idx}
                url={mediaFile.url}
                variant="thumbnail"
                onDelete={() => onRemoveMediaFile(question.id, idx)}
                deleteLabel={t("organization.inspection.remove")}
                t={t}
              />
            ))}
          </div>
        )}
        {hasNote && (
          <div className="">
            {/* quality-bar-loop (Inspections, round 31, accessibility
                finding): this label was a visual-only sibling of the
                textarea below -- no id/htmlFor tying them together. */}
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
            this session, and on CreateNewInspection.tsx's identical
            controls in this same round. */}
        <div className="flex gap-3">
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
            <p className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-yellow-600 border-t-transparent dark:border-yellow-400"></span>
              {t("organization.inspection.uploading")}
            </p>
          ) : (
            <label htmlFor={`update-external-media-${question.id}`}>
              <input
                onChange={(e) => {
                  const files = (e.target as HTMLInputElement)?.files
                  if (files) {
                    onExternalMediaUpload(question.id, files)
                  }
                  e.target.value = ""
                }}
                id={`update-external-media-${question.id}`}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                // quality-bar-loop round 7 (accessibility) -- see the
                // comment on the other file inputs in this file. `peer` --
                // round 52's accessibility fix -- lets the sibling Button
                // react to this input's focus state, since `sr-only` clips
                // any focus ring on the input itself.
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

          <div className="flex items-center justify-end px-6 pb-4">
            <button
              onClick={() => onAddFinding(question.id, question.question)}
              type="button"
              className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
            >
              <CopyCheck className="w-4" />{" "}
              {t("organization.inspection.addFinding")}
            </button>
          </div>
        </div>
      </Card>
    )
  }
)

export default function UpdateInspection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<Record<string, string>>()
  const inspectionId = id
  const [savingQuestions, setSavingQuestions] = useState<
    Record<string, boolean>
  >({})
  const [openUploadNoteModal, setOpenUploadNoteModal] = useState(false)

  const [findingModalState, setFindingModalState] = useState(
    initialFindingModalState
  )

  // quality-bar-loop (Inspections, round 10, efficiency finding): wrapped
  // in useCallback (deps only on the essentially-static `inspectionId`)
  // so QuestionCard's onAddFinding prop stays stable -- see the
  // QuestionCard component above.
  const handleAddFinding = useCallback(
    (questionId: string, questionText: string) => {
      setFindingModalState({
        open: true,
        additionalData: {
          questionId,
          inspectionId: inspectionId ?? "",
          actionTitle: questionText,
          actionDisc: "",
        },
      })
    },
    [inspectionId]
  )
  // quality-bar-loop (Inspections, round 12, resilience finding): never
  // checked isError, only isLoading -- a real fetch failure showed the
  // same "not found" message as a genuine 404, unlike
  // InspectionReport.tsx's identical query, which round 5 already fixed
  // to distinguish the two.
  const {
    data: inspectionData,
    isLoading: isLoadingInspection,
    isError: isInspectionError,
  } = useGetSingleInspectionQuery(inspectionId ?? "", { skip: !inspectionId })

  const [updateInspection] = useUpdateInspectionMutation()
  const [updateQuestionAnswer] = useUpdateInspectionQuestionAnswerMutation()
  const [uploadFileAws] = useUploadAnyFileAwsMutation()

  const inspection = inspectionData?.data
  const template = inspection?.template
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pages = template?.pages || []

  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerEntry>>({})
  // quality-bar-loop (Inspections, round 46, UX finding): see
  // CreateNewInspection.tsx's identical field for the full rationale --
  // checkbox/slider always carry a real default value indistinguishable
  // from a genuine answer, so "was this question actually answered" has
  // to be tracked separately from the answer value itself. Starts empty
  // here (nothing loaded yet); the init effect below pre-populates it
  // from the loaded inspection's existing answers where that's actually
  // derivable -- see that effect's own comment for how.
  const [touchedQuestionIds, setTouchedQuestionIds] = useState<Set<string>>(
    new Set()
  )
  const [visibleNotes, setVisibleNotes] = useState<Record<string, boolean>>({})
  const [selectedStatus, setSelectedStatus] = useState(inspection?.status)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [removingAttachmentUrl, setRemovingAttachmentUrl] = useState<
    string | null
  >(null)
  // Serialize inspection-attachment mutations while any one is in flight —
  // same lost-update race this codebase already hit and fixed on findings'
  // attachments (both handlers PATCH from a closure-captured attachments
  // array that's only fresh again after the refetch lands).
  const isMutatingAttachments = isUploadingAttachment || removingAttachmentUrl !== null
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const initialized = useRef(false)
  // quality-bar-loop (Inspections, round 48): id of the question card to
  // focus once the status dropdown's own close-focus-restore is redirected
  // -- see DropdownMenuContent's onCloseAutoFocus and handleStatusChange.
  const pendingFocusIdRef = useRef<string | null>(null)
  const [isAnswerMediaUploading, setIsAnswerMediaUploading] = useState<
    string | null
  >(null)
  const [externalMediaUploading, setExternalMediaUploading] = useState<
    string | null
  >(null)

  // quality-bar-loop (Inspections, round 10, efficiency finding): mirrors
  // `answers` so the handlers below can read the CURRENT value of a
  // question's other fields (needed because the save mutation always
  // sends the full answer/note/mediaFiles trio, never a partial patch)
  // without putting `answers` itself in their own dependency arrays --
  // `answers` changes on every keystroke, which would make every handler
  // (and every QuestionCard they're passed to) unstable and defeat
  // React.memo below.
  const answersRef = useRef(answers)
  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  // Initialize answers from fetched inspection data
  useEffect(() => {
    setSelectedStatus(inspection?.status)
    if (!pages.length || !inspection?.questionAnswers || initialized.current)
      return

    const initial: Record<string, AnswerEntry> = {}

    // First, initialize all questions with default values
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

    // Then, populate with existing answers from the API
    const touchedFromLoad = new Set<string>()
    inspection.questionAnswers.forEach((qa: any) => {
      if (initial[qa.questionId]) {
        initial[qa.questionId] = {
          answer: qa.answer,
          note: qa.note || "",
          mediaFiles: qa.mediaFiles || [],
          questionAnswerId: qa.id,
        }
      }
    })

    // quality-bar-loop (Inspections, round 46, UX finding): a checkbox/
    // slider's persisted value is indistinguishable from its computed
    // default when it happens to equal that default -- there's no
    // persisted "was this actually touched" flag anywhere in this data
    // model (see handleStatusChange's comment for the full history). But
    // when the persisted value *differs* from the default, that's a real,
    // derivable signal the question genuinely was answered in a past
    // session -- pre-populate touchedQuestionIds from that signal so
    // re-opening an already-filled-out inspection doesn't force the user
    // to re-touch every checkbox/slider that's already correctly answered.
    // A required checkbox/slider still sitting at its exact default (the
    // one case this can't distinguish from "never touched") correctly
    // stays blocked, which is the actual bug every round since 40 lived-
    // reproduced.
    pages.forEach((page: any) => {
      page.questions?.forEach((q: any) => {
        if (!q.id) return
        if (q.answerType !== "checkbox" && q.answerType !== "slider") return
        // `persisted` comes from a Json column typed `any` -- normalize
        // before comparing so a backend that serializes booleans/numbers as
        // strings (e.g. "false", "5") doesn't get misread as "differs from
        // default" and wrongly pre-populate touched state.
        const persisted = initial[q.id]?.answer
        const isDefault =
          q.answerType === "checkbox"
            ? persisted === false || persisted === "false"
            : Number(persisted) === parseSliderDefault(q.value)
        if (!isDefault) touchedFromLoad.add(q.id)
      })
    })

    setTouchedQuestionIds(touchedFromLoad)
    setAnswers(initial)

    // quality-bar-loop (Inspections, round 9, efficiency finding): this
    // used to be a separate effect keyed on `[answers]`, so it re-ran a
    // full Object.entries().forEach() over every question on every single
    // keystroke (setAnswers always produces a new object reference), and
    // then unconditionally overwrote the ENTIRE visibleNotes state -- an
    // O(totalQuestions) tax on every keystroke, and a real correctness
    // bug: if a user manually hid a note via toggleNote while its text
    // remained non-empty, editing any OTHER question's answer would
    // silently reopen it, since this recompute never looked at the
    // current visibleNotes state at all. Seeding this once here, from the
    // same data the answers themselves are seeded from, is both correct
    // (matches this effect's own "initialize" comment/intent) and doesn't
    // re-run on every edit -- no code path in this file adds a note
    // programmatically after initial load, every note change goes through
    // handleNoteChangeWithSave, which only fires while that note's field
    // is already visible.
    const initialNotes: Record<string, boolean> = {}
    Object.entries(initial).forEach(([questionId, data]) => {
      if (data.note && data.note.trim() !== "") {
        initialNotes[questionId] = true
      }
    })
    setVisibleNotes(initialNotes)

    initialized.current = true
  }, [pages, inspection])

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

  const toggleNote = useCallback((questionId: string) => {
    setVisibleNotes((prev) => ({ ...prev, [questionId]: !prev[questionId] }))
  }, [])

  // Update individual question answer
  const handleUpdateQuestion = useCallback(
    async (questionId: string, data: AnswerEntry) => {
      const questionAnswerId = data.questionAnswerId
      if (!questionAnswerId) return

      try {
        await updateQuestionAnswer({
          id: questionAnswerId,
          data: {
            answer: data.answer,
            note: data.note?.trim() || "",
            mediaFiles: data.mediaFiles,
          },
        }).unwrap()
      } catch (error: any) {
        toast.error(
          t("organization.inspection.updateQuestionFailedToast", {
            questionId,
            message: error?.data?.message || error?.message || "",
          })
        )
        throw error
      }
    },
    [updateQuestionAnswer, t]
  )

  // Auto-save when answer changes (debounced)
  const saveTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  )

  const debouncedUpdateQuestion = useCallback(
    (questionId: string, data: AnswerEntry) => {
      if (saveTimeoutRef.current[questionId]) {
        clearTimeout(saveTimeoutRef.current[questionId])
      }
      setSavingQuestions((prev) => ({ ...prev, [questionId]: true }))

      saveTimeoutRef.current[questionId] = setTimeout(async () => {
        try {
          await handleUpdateQuestion(questionId, data)
          toast.success(t("organization.inspection.answerSavedToast"))
        } catch {
          // quality-bar-loop (Inspections, round 19, resilience finding):
          // handleUpdateQuestion already toasts a specific error (with the
          // backend's actual message) before re-throwing -- this used to
          // catch that same rethrown error and toast a second, generic
          // "Failed to save answer" on top of it, so every single
          // auto-save failure surfaced as two stacked toasts. This
          // try/finally only needs to reset the saving indicator now; the
          // error itself was already reported.
        } finally {
          setSavingQuestions((prev) => ({ ...prev, [questionId]: false }))
        }
      }, 1000)
    },
    [handleUpdateQuestion, t]
  )

  // quality-bar-loop (Inspections, round 10, efficiency finding): each of
  // these four handlers used to read `answers[questionId]` directly from
  // the outer closure to build the save payload (the mutation always
  // sends the full answer/note/mediaFiles trio, never a partial patch) --
  // that read is now against `answersRef.current` instead, so the
  // `setAnswers` state update stays a pure functional updater and none of
  // these handlers need `answers` in a dependency array. See the
  // QuestionCard component below for why that stability matters.

  // Handle answer change with auto-save
  const handleAnswerChangeWithSave = useCallback(
    (questionId: string, value: any) => {
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

      const questionAnswerId = answersRef.current[questionId]?.questionAnswerId
      if (questionAnswerId) {
        debouncedUpdateQuestion(questionId, {
          ...answersRef.current[questionId],
          answer: value,
          questionAnswerId,
        })
      }
    },
    [debouncedUpdateQuestion]
  )

  const handleMediaFileChangeWithSave = useCallback(
    (questionId: string, newMediaFiles: { url: string; type: string }[]) => {
      const existingMediaFiles =
        answersRef.current[questionId]?.mediaFiles || []
      const updatedMediaFiles = [...existingMediaFiles, ...newMediaFiles]

      setAnswers((prev) => ({
        ...prev,
        [questionId]: { ...prev[questionId], mediaFiles: updatedMediaFiles },
      }))

      const questionAnswerId = answersRef.current[questionId]?.questionAnswerId
      if (questionAnswerId) {
        debouncedUpdateQuestion(questionId, {
          ...answersRef.current[questionId],
          mediaFiles: updatedMediaFiles,
          questionAnswerId,
        })
      }
    },
    [debouncedUpdateQuestion]
  )

  // Handle note change with auto-save
  const handleNoteChangeWithSave = useCallback(
    (questionId: string, note: string) => {
      setAnswers((prev) => ({
        ...prev,
        [questionId]: { ...prev[questionId], note },
      }))

      const questionAnswerId = answersRef.current[questionId]?.questionAnswerId
      if (questionAnswerId) {
        debouncedUpdateQuestion(questionId, {
          ...answersRef.current[questionId],
          note,
          questionAnswerId,
        })
      }
    },
    [debouncedUpdateQuestion]
  )

  const handleStatusChange = async (newStatus: InspectionStatus) => {
    if (!inspectionId || newStatus === selectedStatus) return

    // quality-bar-loop (Inspections, round 18, UX finding): marking an
    // inspection COMPLETED had zero required-field validation -- a user
    // could flip status to Completed with required questions still
    // unanswered, with no warning at all.
    //
    // Two false starts before round 46's actual fix, both worth recording
    // so a future round doesn't re-try them:
    // 1. `answer === "" || answer == null` (InspectionReport.tsx's own
    //    totalAnswered convention) doesn't work here -- the init effect
    //    above seeds every checkbox question with a local default of
    //    `false` and every slider with a non-empty default
    //    (parseSliderDefault), so a never-touched required checkbox/slider
    //    already reads as "answered."
    // 2. `!questionAnswerId` (only set once a real QuestionAnswer record
    //    exists) looked like the fix, but aexa-server's
    //    create_inspection_into_db creates a QuestionAnswer row for EVERY
    //    question in the template at inspection-creation time (the
    //    frontend's create payload always includes one entry per question,
    //    seeded with its default value, not just touched ones) --
    //    `questionAnswerId` is therefore present for every question from
    //    the moment an inspection is created, checkbox/slider included,
    //    making this check never block anything in practice.
    //
    // round 46: `touchedQuestionIds` (tracked in handleAnswerChangeWithSave
    // above) is the real "was this actually answered" signal for
    // checkbox/slider, entirely separate from the answer value itself --
    // doesn't require a data-model/payload change (the submitted answer
    // is still always a real false/number, never null/undefined, so
    // aexa-server's non-nullable QuestionAnswer.answer column is
    // unaffected). Every other answer type's blank default genuinely is
    // `""`, so their existing value-based check is untouched.
    if (newStatus === "COMPLETED") {
      // quality-bar-loop (Inspections, round 48, UX finding): this used to
      // only report a bare count, unlike CreateNewInspection.tsx's submit
      // gate which names the missing question, scrolls to it, and focuses
      // it -- editing an existing inspection is the more common real-world
      // completion path, so it deserves at least the same guidance. Still
      // reports the full count (more informative here than the create
      // flow's single-question toast, since a user completing an inspection
      // may have several pages to revisit), but now also names and
      // navigates to the first one.
      const missingByPage: { pageIndex: number; question: any }[][] =
        pages.map((page: any, pageIndex: number) => {
          const pageQuestions = page.questions ?? []
          return pageQuestions
            .filter((q: any) => {
              if (!q.isRequired) return false
              if (q.answerType === "checkbox" || q.answerType === "slider") {
                return !touchedQuestionIds.has(q.id)
              }
              const answer = answersRef.current[q.id]?.answer
              return answer === "" || answer == null
            })
            .map((question: any) => ({ pageIndex, question }))
        })
      const missing = missingByPage.flat()
      const unansweredRequiredCount = missing.length

      if (unansweredRequiredCount > 0) {
        const { pageIndex, question } = missing[0]
        toast.error(
          t("organization.inspection.cannotCompleteRequiredUnanswered", {
            count: unansweredRequiredCount,
            question: question.question,
          })
        )
        scrollToPage(pageIndex)
        // "Completed" is picked from a Radix dropdown menu, unlike
        // CreateNewInspection.tsx's plain Submit button -- Radix returns
        // focus to the dropdown trigger when the menu closes, which would
        // otherwise override a direct .focus() call here. Stash the target
        // and let the DropdownMenuContent's onCloseAutoFocus redirect
        // Radix's own restore instead of racing it.
        pendingFocusIdRef.current = `question-card-${question.id}`
        return
      }
    }

    setIsUpdatingStatus(true)
    setSelectedStatus(newStatus) // Optimistic update

    try {
      await updateInspection({
        id: inspectionId,
        data: {
          status: newStatus,
        },
      }).unwrap()
      toast.success(
        t("organization.inspection.statusUpdatedToast", { status: newStatus })
      )
    } catch (error: any) {
      // Revert on error
      setSelectedStatus(selectedStatus)
      toast.error(
        error?.data?.message || t("organization.inspection.statusUpdateFailedToast")
      )
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // inspection-level attachments (as opposed to per-question mediaFiles below)
  const handleUploadAttachment = async (file: File) => {
    if (!inspectionId || !inspection) return
    setIsUploadingAttachment(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await uploadFileAws(formData).unwrap()
      const url: string | undefined = uploadRes?.data
      if (!uploadRes?.success || !url) {
        toast.error(t("organization.inspection.attachmentUploadFailedToast"))
        return
      }
      // Separate try/catch from the upload above: by this point the file
      // itself has genuinely been uploaded, so a failure here is a partial
      // success, not a full failure -- it needs its own toast rather than
      // falling into the shared catch below, which would tell the user the
      // upload itself failed even though only attaching the URL to the
      // inspection was lost (#123, same pattern as #170).
      //
      // `url` isn't persisted anywhere on this failure -- there's no
      // retry-attach path that skips a fresh upload, so the message says so
      // explicitly rather than implying the already-uploaded file can be
      // reattached without re-uploading it.
      try {
        await updateInspection({
          id: inspectionId,
          data: { attachments: [...(inspection.attachments ?? []), url] },
        }).unwrap()
      } catch (attachErr: any) {
        toast.error(
          attachErr?.data?.message ||
            t("organization.inspection.attachmentAttachFailedToast")
        )
        return
      }
      toast.success(t("organization.inspection.attachmentUploadedToast"))
    } catch (error: any) {
      toast.error(
        error?.data?.message ||
          t("organization.inspection.attachmentUploadFailedToast")
      )
    } finally {
      setIsUploadingAttachment(false)
    }
  }

  const handleRemoveAttachment = async (url: string) => {
    if (!inspectionId || !inspection) return
    setRemovingAttachmentUrl(url)
    try {
      await updateInspection({
        id: inspectionId,
        data: {
          attachments: (inspection.attachments ?? []).filter(
            (existing: string) => existing !== url
          ),
        },
      }).unwrap()
      toast.success(t("organization.inspection.attachmentRemovedToast"))
    } catch (error: any) {
      toast.error(
        error?.data?.message ||
          t("organization.inspection.attachmentRemoveFailedToast")
      )
    } finally {
      setRemovingAttachmentUrl(null)
    }
  }

  // media file management
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
          handleAnswerChangeWithSave(questionId, res.data)
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
    [uploadFileAws, t, handleAnswerChangeWithSave]
  )

  const handleRemoveMediaFile = useCallback(
    (questionId: string, fileIndex: number) => {
      const currentMediaFiles = answersRef.current[questionId]?.mediaFiles || []
      const updatedMediaFiles = currentMediaFiles.filter(
        (_, index) => index !== fileIndex
      )

      setAnswers((prev) => ({
        ...prev,
        [questionId]: { ...prev[questionId], mediaFiles: updatedMediaFiles },
      }))

      const questionAnswerId = answersRef.current[questionId]?.questionAnswerId
      if (questionAnswerId) {
        debouncedUpdateQuestion(questionId, {
          ...answersRef.current[questionId],
          mediaFiles: updatedMediaFiles,
          questionAnswerId,
        })
      }

      toast.success(t("organization.inspection.mediaRemovedToast"))
    },
    [debouncedUpdateQuestion, t]
  )

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
          handleMediaFileChangeWithSave(questionId, validFiles)
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
    [uploadFileAws, t, handleMediaFileChangeWithSave]
  )

  if (isLoadingInspection) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {t("organization.inspection.loadingInspection")}
      </div>
    )
  }

  if (isInspectionError || !inspection) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p role="alert" className="text-lg text-muted-foreground">
          {isInspectionError
            ? t("organization.inspection.inspectionLoadError")
            : t("organization.inspection.notFound")}
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
      <div className="border-b bg-card">
        {/* quality-bar-loop round 2 (mobile, round-1 finding): a long
            template name makes the h1 wrap to multiple lines, but this
            row had no flex-wrap and stayed `items-center` -- Back/Upload
            Note ended up vertically centered against the now much
            taller title block instead of sitting predictably. flex-wrap
            + items-start lets the whole row reflow into two lines on a
            narrow viewport instead of misaligning in place. */}
        <div className="mx-auto flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)} className="h-11">
              <ArrowLeft className="mr-2 h-5 w-5" />{" "}
              {t("organization.inspection.back")}
            </Button>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                {t("organization.inspection.editTitle", {
                  name: template?.templateName,
                })}
              </h1>
              {inspection?.site && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />{" "}
                  {/* aexa-frontend#552: same site cross-link as
                      InspectionReport.tsx -- reuses the established
                      ?siteId=&search= pattern (#533/#541). */}
                  <Link
                    to={`/organization/sites?siteId=${encodeURIComponent(inspection.site.id)}&search=${encodeURIComponent(inspection.site.name)}`}
                    className="focus-ring text-primary hover:underline"
                  >
                    {inspection.site.name}
                  </Link>
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("organization.inspection.statusLabel")}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* quality-bar-loop round 2 (mobile, round-1
                        finding): this pill-styled trigger is a real
                        interactive control (opens the status-change
                        menu), not just a badge -- `h-7` -> `h-11` for
                        the same 44px touch-target guideline as every
                        other button this round, same fix pattern. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-11 px-2 text-xs font-medium ${severityBadgeClasses(
                        // quality-bar-loop round 14 review finding:
                        // selectedStatus's lazy useState initializer only
                        // sees inspection.status if it's already loaded on
                        // mount -- on the render where `inspection` first
                        // becomes truthy, selectedStatus can still be one
                        // effect-tick behind. Falling back to inspection's
                        // own status (guaranteed real here, since this JSX
                        // only renders once inspection is truthy) avoids a
                        // one-frame wrong-color flash.
                        getInspectionStatusSeverity(
                          selectedStatus ?? inspection.status
                        ),
                        { border: true }
                      )}`}
                      disabled={isUpdatingStatus}
                    >
                      {isUpdatingStatus ? (
                        <>
                          <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                          {t("organization.inspection.updating")}
                        </>
                      ) : (
                        <>
                          {selectedStatus === "COMPLETED" && (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          {selectedStatus === "CANCELLED" && (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {selectedStatus === "DRAFT" && (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                          {selectedStatus === "IN_PROGRESS" && (
                            <Pencil className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1">
                            {getInspectionStatusLabel(t, selectedStatus ?? "")}
                          </span>
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    // quality-bar-loop (Inspections, round 48, UX finding):
                    // Radix returns focus to this dropdown's own trigger
                    // when it closes, which would otherwise unconditionally
                    // override handleStatusChange's focus-the-missing-
                    // question call below (that call runs synchronously
                    // inside the same click, before Radix's close-focus
                    // effect fires). Redirect Radix's own restore instead
                    // of racing a timeout against it.
                    onCloseAutoFocus={(e) => {
                      // Review finding on PR #726: only override Radix's
                      // default restoration once the target actually
                      // exists -- same guard as SignInModal.tsx's identical
                      // pattern (aexa-frontend#477). If the id lookup ever
                      // misses (stale ref, DOM change), fall through and let
                      // Radix's own restore run rather than silently
                      // dropping focus.
                      const target = pendingFocusIdRef.current
                        ? document.getElementById(pendingFocusIdRef.current)
                        : null
                      if (target) {
                        e.preventDefault()
                        target.focus()
                      }
                      pendingFocusIdRef.current = null
                    }}
                  >
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("IN_PROGRESS")}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />{" "}
                      {t("organization.inspection.statusInProgress")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("COMPLETED")}
                    >
                      <CheckCircle2 className="mr-2 h-3.5 w-3.5" />{" "}
                      {t("organization.inspection.statusCompleted")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("CANCELLED")}
                    >
                      <XCircle className="mr-2 h-3.5 w-3.5" />{" "}
                      {t("organization.inspection.statusCancelled")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("DRAFT")}
                    >
                      <FileText className="mr-2 h-3.5 w-3.5" />{" "}
                      {t("organization.inspection.statusDraft")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <Button onClick={() => setOpenUploadNoteModal(true)} className="h-11">
            {inspection?.note?.id ? (
              <>
                <Eye /> {t("organization.inspection.viewNote")}
              </>
            ) : (
              <>
                <Upload /> {t("organization.inspection.uploadNote")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Inspection-level attachments (not per-question mediaFiles) */}
      <div className="border-b bg-card">
        <div className="mx-auto flex flex-col gap-3 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* h2, not h3: this renders right after the page h1 and, when
                pages.length === 0, is the only heading before the "no pages"
                h3 below -- keeping it h3 skipped a level in that render path
                (aexa-frontend round-9 audit #463). */}
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Paperclip className="h-4 w-4" />{" "}
              {t("organization.inspection.attachments")}
            </h2>
            {/* quality-bar-loop round 7 (mobile, round-3 finding): this raw
                label measured 114x32px live -- unlike the other upload
                triggers in this file, it never went through the shared
                Button, so it was missed by the earlier touch-target sweep.
                `min-h-11` fixes it the same way a wrapping label's hit area
                was fixed elsewhere this loop. */}
            <label className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30">
              {isUploadingAttachment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t("organization.inspection.uploadFile")}
              <input
                type="file"
                // quality-bar-loop round 7 (accessibility) -- see the
                // comment on the other file inputs in this file/
                // CreateNewInspection.tsx.
                //
                // quality-bar-loop (Inspections, round 52, accessibility
                // finding): `sr-only` clips any focus ring on the input
                // itself, leaving keyboard focus reachable but invisible
                // (WCAG 2.4.7). Unlike the other file inputs in this file,
                // this input's label wraps its own visible content directly
                // (no separate Button sibling), so `has-[:focus-visible]`
                // on the label above works instead of the `peer` pattern.
                className="sr-only"
                disabled={isMutatingAttachments}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUploadAttachment(file)
                  e.target.value = ""
                }}
              />
            </label>
          </div>
          {(inspection?.attachments ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(inspection?.attachments ?? []).map((url: string) => (
                <div
                  key={url}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs"
                >
                  {isHttpUrl(url) ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="max-w-50 truncate text-foreground hover:underline"
                    >
                      {attachmentFileName(url)}
                    </a>
                  ) : (
                    // quality-bar-loop (Inspections, round 3, security
                    // finding, review follow-up): the backend already
                    // validates Inspection.attachments' scheme on write
                    // (aexa-server's httpUrl check), but a pre-existing
                    // record from before that check landed could still
                    // carry an unsafe value -- same defense-in-depth guard
                    // as the answer/mediaFiles sinks above.
                    <span className="max-w-50 truncate text-muted-foreground italic">
                      {t("organization.inspection.unsafeAttachment")}
                    </span>
                  )}
                  {/* quality-bar-loop (Inspections, round 13, mobile
                      finding): the visible icon is 14x14 with zero padding
                      -- `p-2.5 -m-2.5` extends the real tappable area to
                      34x34 without growing the chip's own visual size
                      (this row wraps several small chips side by side, so
                      a full 44px box here would break that compact
                      layout). Not the full 44px guideline, but a real,
                      proportionate improvement over a bare icon. */}
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(url)}
                    disabled={isMutatingAttachments}
                    title={t("organization.inspection.remove")}
                    className="-m-2.5 p-2.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                  >
                    {removingAttachmentUrl === url ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex gap-8 px-6 py-8">
        {/* Sticky Left Navigation */}
        <div className="hidden w-72 lg:block">
          <div className="sticky top-2 space-y-1">
            <p className="mb-3 px-3 text-sm font-semibold text-muted-foreground">
              {t("organization.inspection.pages")}
            </p>
            {pages.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {t("organization.inspection.noPagesTitle")}
              </p>
            ) : (
              <nav aria-label={t("organization.inspection.pages")}>
                {pages.map((page: any, index: number) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => scrollToPage(index)}
                    aria-current={
                      currentPageIndex === index ? "true" : undefined
                    }
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
              </nav>
            )}
            <hr />
            <Button
              variant="outline"
              onClick={() => {
                document
                  .getElementById("recommendation-page")
                  ?.scrollIntoView({ behavior: "smooth" })
              }}
              size="lg"
              className="mt-5 w-full"
            >
              {t("organization.inspection.viewRecommendation")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                document
                  .getElementById("unsplit-page")
                  ?.scrollIntoView({ behavior: "smooth" })
              }}
              size="lg"
              className="mt-5 w-full"
            >
              {t("organization.inspection.viewUnsplitText")}
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          {pages.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-md border border-border bg-card/30 py-24 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileQuestion size={24} className="text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-foreground">
                {t("organization.inspection.noPagesTitle")}
              </h3>
              <p className="max-w-md text-sm text-muted-foreground">
                {t("organization.inspection.noPagesDescription")}
              </p>
            </div>
          )}
          {pages.map((page: any, pageIndex: number) => (
            <div
              key={pageIndex}
              ref={(el) => {
                pageRefs.current[pageIndex] = el
              }}
              data-page-index={pageIndex}
              className="animate-fade-in mb-12 scroll-mt-24 rounded-md border border-border bg-card/30 p-4"
            >
              <div className="py-6">
                <h2 className="mb-1 font-heading text-2xl font-semibold">{page.title}</h2>
                <p className="text-muted-foreground">
                  {t("organization.inspection.section", { num: pageIndex + 1 })}
                </p>
              </div>

              <div className="space-y-8">
                {page.questions?.map((question: any) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    answer={answers[question.id]?.answer}
                    note={answers[question.id]?.note || ""}
                    mediaFiles={answers[question.id]?.mediaFiles || []}
                    isSaving={!!savingQuestions[question.id]}
                    isNoteVisible={!!visibleNotes[question.id]}
                    isAnswerMediaUploading={isAnswerMediaUploading === question.id}
                    isExternalMediaUploading={externalMediaUploading === question.id}
                    onAnswerChange={handleAnswerChangeWithSave}
                    onNoteChange={handleNoteChangeWithSave}
                    onToggleNote={toggleNote}
                    onAnswerMediaUpload={handleAnswerMediaUpload}
                    onExternalMediaUpload={handleExternalMediaUpload}
                    onRemoveMediaFile={handleRemoveMediaFile}
                    onAddFinding={handleAddFinding}
                    t={t}
                  />
                ))}
              </div>
            </div>
          ))}
          <ViewAndEditRecommendation inspectionId={inspection.id} />
          <UnSplitText unSplitText={inspection?.unSplitText ?? ""} />
        </div>
      </div>
      <CreateNewFindingModal
        open={findingModalState.open}
        onClose={() => setFindingModalState(initialFindingModalState)}
        additionalData={findingModalState.additionalData}
      />
      <UploadNotesModal
        open={openUploadNoteModal}
        setOpen={setOpenUploadNoteModal}
        inspectionId={inspectionId as string}
      />
    </div>
  )
}
