/* eslint-disable @typescript-eslint/no-unused-vars */
// UpdateInspection.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { getInspectionStatusLabel } from "@/utils/inspectionStatus"
import { PLACEHOLDER_IMAGE_SRC } from "@/utils/placeholderImage"
import {
  ArrowLeft,
  CloudUpload,
  CopyCheck,
  Eye,
  FileQuestion,
  FileText,
  Globe,
  Loader2,
  Paperclip,
  Trash,
  Trash2,
  Upload,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router"
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
  // Fetch inspection data
  const { data: inspectionData, isLoading: isLoadingInspection } =
    useGetSingleInspectionQuery(inspectionId ?? "", { skip: !inspectionId })

  const [updateInspection] = useUpdateInspectionMutation()
  const [updateQuestionAnswer] = useUpdateInspectionQuestionAnswerMutation()
  const [uploadFileAws] = useUploadAnyFileAwsMutation()

  const inspection = inspectionData?.data
  const template = inspection?.template
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pages = template?.pages || []

  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerEntry>>({})
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
  const [isAnswerMediaUploading, setIsAnswerMediaUploading] = useState<
    string | null
  >(null)
  const [externalMediaUploading, setExternalMediaUploading] = useState<
    string | null
  >(null)

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
        if (q.answerType === "slider") defaultAnswer = q.value || 5

        initial[q.id] = {
          answer: defaultAnswer,
          note: "",
          mediaFiles: [],
        }
      })
    })

    // Then, populate with existing answers from the API
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

    setAnswers(initial)
    initialized.current = true
  }, [pages, inspection])

  // Initialize visible notes based on existing notes
  useEffect(() => {
    if (!Object.keys(answers).length) return

    const initialNotes: Record<string, boolean> = {}
    Object.entries(answers).forEach(([questionId, data]) => {
      if (data.note && data.note.trim() !== "") {
        initialNotes[questionId] = true
      }
    })
    setVisibleNotes(initialNotes)
  }, [answers])

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

  const toggleNote = (questionId: string) => {
    setVisibleNotes((prev) => ({ ...prev, [questionId]: !prev[questionId] }))
  }

  // Update individual question answer
  const handleUpdateQuestion = async (
    questionId: string,
    data: AnswerEntry
  ) => {
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
  }

  // Auto-save when answer changes (debounced)
  const saveTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  )

  const debouncedUpdateQuestion = (questionId: string, data: AnswerEntry) => {
    if (saveTimeoutRef.current[questionId]) {
      clearTimeout(saveTimeoutRef.current[questionId])
    }
    setSavingQuestions((prev) => ({ ...prev, [questionId]: true }))

    saveTimeoutRef.current[questionId] = setTimeout(async () => {
      try {
        await handleUpdateQuestion(questionId, data)
        toast.success(t("organization.inspection.answerSavedToast"))
      } catch (error) {
        toast.error(t("organization.inspection.answerSaveFailedToast"))
      } finally {
        setSavingQuestions((prev) => ({ ...prev, [questionId]: false }))
      }
    }, 1000)
  }

  // Handle answer change with auto-save
  const handleAnswerChangeWithSave = (questionId: string, value: any) => {
    const updatedAnswer = { ...answers[questionId], answer: value }
    setAnswers((prev) => ({
      ...prev,
      [questionId]: updatedAnswer,
    }))

    if (updatedAnswer.questionAnswerId) {
      debouncedUpdateQuestion(questionId, updatedAnswer)
    }
  }
  const handleMediaFileChangeWithSave = (
    questionId: string,
    newMediaFiles: { url: string; type: string }[]
  ) => {
    // Get existing media files
    const existingMediaFiles = answers[questionId]?.mediaFiles || []

    // Append new files
    const updatedMediaFiles = [...existingMediaFiles, ...newMediaFiles]

    // Create updated answer object
    const updatedAnswer = {
      ...answers[questionId],
      mediaFiles: updatedMediaFiles,
    }

    setAnswers((prev) => ({
      ...prev,
      [questionId]: updatedAnswer,
    }))

    if (updatedAnswer.questionAnswerId) {
      debouncedUpdateQuestion(questionId, updatedAnswer)
    }
  }

  // Handle note change with auto-save
  const handleNoteChangeWithSave = (questionId: string, note: string) => {
    const updatedAnswer = { ...answers[questionId], note }
    setAnswers((prev) => ({
      ...prev,
      [questionId]: updatedAnswer,
    }))

    if (updatedAnswer.questionAnswerId) {
      debouncedUpdateQuestion(questionId, updatedAnswer)
    }
  }

  const handleStatusChange = async (newStatus: InspectionStatus) => {
    if (!inspectionId || newStatus === selectedStatus) return

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
        handleAnswerChangeWithSave(questionId, res.data)
        toast.success(t("organization.inspection.mediaUploadedToast"))
      } else {
        toast.error(t("organization.inspection.mediaUploadFailedToast"))
      }
    } catch (error:any) {
      toast.error(
        error?.message || t("organization.inspection.mediaUploadFailedToast")
      )
    } finally {
      setIsAnswerMediaUploading(null)
    }
  }

  const handleRemoveMediaFile = (questionId: string, fileIndex: number) => {
    const currentMediaFiles = answers[questionId]?.mediaFiles || []
    const updatedMediaFiles = currentMediaFiles.filter(
      (_, index) => index !== fileIndex
    )

    // Create updated answer object
    const updatedAnswer = {
      ...answers[questionId],
      mediaFiles: updatedMediaFiles,
    }

    setAnswers((prev) => ({
      ...prev,
      [questionId]: updatedAnswer,
    }))

    if (updatedAnswer.questionAnswerId) {
      debouncedUpdateQuestion(questionId, updatedAnswer)
    }

    toast.success(t("organization.inspection.mediaRemovedToast"))
  }
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
        handleMediaFileChangeWithSave(questionId, validFiles)
        toast.success(
          t("organization.inspection.filesUploadedToast", {
            count: validFiles.length,
          })
        )
      } else {
        toast.error(t("organization.inspection.filesUploadFailedToast"))
      }
    } catch (error:any) {
      toast.error(
        error?.message ||
          t("organization.inspection.mediaFilesUploadFailedToast")
      )
    } finally {
      setExternalMediaUploading(null)
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
                handleAnswerChangeWithSave(question.id, e.target.checked)
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
                handleAnswerChangeWithSave(
                  question.id,
                  parseFloat(e.target.value)
                )
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
            onChange={(e) =>
              handleAnswerChangeWithSave(question.id, e.target.value)
            }
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
            onChange={(e) =>
              handleAnswerChangeWithSave(question.id, e.target.value)
            }
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
                  onClick={() => handleAnswerChangeWithSave(question.id, "")}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
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
                  className="hidden"
                />
              </label>
            )}
          </>
        )

      default: {
        return (
          <TextareaAutosize
            value={value ?? ""}
            onChange={(e: any) =>
              handleAnswerChangeWithSave(question.id, e.target.value)
            }
            rows={2}
            className="w-full resize-y rounded-lg border border-input px-4 py-3 focus:ring-2 focus:ring-primary"
            placeholder={t("organization.inspection.answerPlaceholder")}
          />
        )
      }
    }
  }

  if (isLoadingInspection) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {t("organization.inspection.loadingInspection")}
      </div>
    )
  }

  if (!inspection) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">
          {t("organization.inspection.notFound")}
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
        <div className="mx-auto flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-5 w-5" />{" "}
              {t("organization.inspection.back")}
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {t("organization.inspection.editTitle", {
                  name: template?.templateName,
                })}
              </h1>
              {inspection?.site && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" /> {inspection.site.name}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("organization.inspection.statusLabel")}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-7 px-2 text-xs font-medium ${
                        selectedStatus === "COMPLETED"
                          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : selectedStatus === "CANCELLED"
                            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            : selectedStatus === "DRAFT"
                              ? "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                              : "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                      } `}
                      disabled={isUpdatingStatus}
                    >
                      {isUpdatingStatus ? (
                        <>
                          <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                          {t("organization.inspection.updating")}
                        </>
                      ) : (
                        <>
                          {selectedStatus === "COMPLETED" && "✅"}
                          {selectedStatus === "CANCELLED" && "❌"}
                          {selectedStatus === "DRAFT" && "📄"}
                          {selectedStatus === "IN_PROGRESS" && "📝"}
                          <span className="ml-1">
                            {getInspectionStatusLabel(t, selectedStatus ?? "")}
                          </span>
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("IN_PROGRESS")}
                    >
                      <span className="mr-2">📝</span>{" "}
                      {t("organization.inspection.statusInProgress")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("COMPLETED")}
                    >
                      <span className="mr-2">✅</span>{" "}
                      {t("organization.inspection.statusCompleted")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("CANCELLED")}
                    >
                      <span className="mr-2">❌</span>{" "}
                      {t("organization.inspection.statusCancelled")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("DRAFT")}
                    >
                      <span className="mr-2">📄</span>{" "}
                      {t("organization.inspection.statusDraft")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <Button onClick={() => setOpenUploadNoteModal(true)}>
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
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
              {isUploadingAttachment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t("organization.inspection.uploadFile")}
              <input
                type="file"
                className="hidden"
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
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="max-w-50 truncate text-foreground hover:underline"
                  >
                    {attachmentFileName(url)}
                  </a>
                  <button
                    onClick={() => handleRemoveAttachment(url)}
                    disabled={isMutatingAttachments}
                    title={t("organization.inspection.remove")}
                    className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
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
              pages.map((page: any, index: number) => (
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
              ))
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
              className="mb-12 scroll-mt-24 rounded-md border border-border bg-card/30 p-4"
            >
              <div className="py-6">
                <h2 className="mb-1 text-2xl font-semibold">{page.title}</h2>
                <p className="text-muted-foreground">
                  {t("organization.inspection.section", { num: pageIndex + 1 })}
                </p>
              </div>

              <div className="space-y-8">
                {page.questions?.map((question: any) => {
                  const hasNote =
                    visibleNotes[question.id] || !!answers[question.id]?.note

                  const hasMediaFiles = answers[question.id]?.mediaFiles

                  return (
                    <Card
                      key={question.id}
                      className="border-none p-6 shadow-none"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="leading-tight font-medium">
                            {question.question}
                            {question.isRequired && (
                              <span className="ml-1 text-destructive">*</span>
                            )}
                          </p>
                          {savingQuestions[question.id] && (
                            <p className="flex items-center gap-1 text-xs text-yellow-600">
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-yellow-600 border-t-transparent"></span>
                              {t("organization.inspection.saving")}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="">{renderQuestionInput(question)}</div>

                      {hasMediaFiles && (
                        <div className="flex items-center gap-5">
                          {hasMediaFiles.map((mediaFile: any, idx: number) => (
                            <div key={idx} className="relative">
                              <span
                                onClick={() =>
                                  handleRemoveMediaFile(question.id, idx)
                                }
                                className="absolute -top-2 -right-2 cursor-pointer rounded-full bg-amber-100 p-1 text-red-500"
                              >
                                <Trash className="size-4" />
                              </span>
                              <img
                                className="h-12 w-12"
                                src={mediaFile.url}
                                alt=""
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {hasNote && (
                        <div className="">
                          <p className="mb-2 text-sm font-medium">
                            {t("organization.inspection.note")}
                          </p>
                          <textarea
                            value={answers[question.id]?.note || ""}
                            onChange={(e) =>
                              handleNoteChangeWithSave(
                                question.id,
                                e.target.value
                              )
                            }
                            className="min-h-22.5 w-full rounded-lg border border-input px-4 py-3"
                            placeholder={t(
                              "organization.inspection.notePlaceholder"
                            )}
                          />
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleNote(question.id)}
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
                          <label
                            htmlFor={`update-external-media-${question.id}`}
                          >
                            <Button asChild variant="outline" size="sm">
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
                              id={`update-external-media-${question.id}`}
                              type="file"
                              multiple
                              accept="image/*,video/*,application/pdf"
                              className="hidden"
                            />
                          </label>
                        )}

                        <div className="flex items-center justify-end px-6 pb-4">
                          <button
                            onClick={() =>
                              setFindingModalState({
                                open: true,
                                additionalData: {
                                  questionId: question.id!,
                                  inspectionId: inspectionId!,
                                  actionTitle: question.question as string,
                                  actionDisc: "",
                                },
                              })
                            }
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
                })}
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
