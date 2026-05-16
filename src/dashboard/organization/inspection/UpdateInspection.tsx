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
import { useNavigate, useParams } from "react-router"
import { toast } from "sonner"

type AnswerEntry = {
  answer: any
  note: string
  mediaFiles: { url: string; type: string }[]
  questionAnswerId?: string // Store the question answer ID for updates
}

export default function UpdateInspection() {
  const navigate = useNavigate()
  const { id } = useParams<Record<string, string>>()
  const inspectionId = id
  const [savingQuestions, setSavingQuestions] = useState<
    Record<string, boolean>
  >({})

  // Fetch inspection data
  const { data: inspectionData, isLoading: isLoadingInspection } =
    useGetSingleInspectionQuery(inspectionId, { skip: !inspectionId })

  const [updateInspection, { isLoading: isUpdatingInspection }] =
    useUpdateInspectionMutation()
  const [updateQuestionAnswer] = useUpdateInspectionQuestionAnswerMutation()
  const [uploadFileAws] = useUploadAnyFileAwsMutation()

  const inspection = inspectionData?.data
  const template = inspection?.template
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pages = template?.pages || []

  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerEntry>>({})
  const [visibleNotes, setVisibleNotes] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(inspection?.status)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
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
      console.error(`Failed to update question ${questionId}:`, error)
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
        toast.success("Answer saved successfully")
      } catch (error) {
        toast.error("Failed to save answer")
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

  // Final submit - update inspection status and site if needed
  const handleSubmit = async () => {
    if (!inspectionId) {
      toast.error("Missing inspection information")
      return
    }

    setIsSubmitting(true)

    try {
      // First, save any pending answers
      const savePromises = Object.entries(answers)
        .filter(([_, data]) => data.questionAnswerId)
        .map(([questionId, data]) => handleUpdateQuestion(questionId, data))

      await Promise.all(savePromises)

      // Then update inspection status to COMPLETED
      await updateInspection({
        id: inspectionId,
        data: {
          status: "COMPLETED",
          // Only include siteId if you want to change it
          // siteId: inspection?.siteId,
        },
      }).unwrap()

      toast.success("Inspection completed successfully!")
      navigate("/organization/audit/inspections")
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to submit inspection")
    } finally {
      setIsSubmitting(false)
    }
  }
  const handleStatusChange = async (newStatus: string) => {
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
      toast.success(`Status updated to ${newStatus}`)
    } catch (error: any) {
      // Revert on error
      setSelectedStatus(selectedStatus)
      toast.error(error?.data?.message || "Failed to update status")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // media file management
  const handleAnswerMediaUpload = async (questionId: string, file: File) => {
    // validation
    if (!file || !questionId) return

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size should be less than 5MB")
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
      toast.error("Only images, MP4 videos, and PDF files are allowed")
      return
    }

    setIsAnswerMediaUploading(questionId)

    try {
      const formdata = new FormData()
      formdata.append("file", file)
      const res = await uploadFileAws(formdata).unwrap()

      if (res?.success && res?.data) {
        handleAnswerChangeWithSave(questionId, res.data)
        toast.success("Media uploaded successfully!")
      } else {
        toast.error("Failed to upload media")
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("Failed to upload media")
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

    toast.success("Media file removed")
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
          toast.error(`${file.name} is larger than 5MB`)
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
            `${file.name} is not supported. Only images, MP4 videos, and PDF files are allowed`
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
        toast.success(`${validFiles.length} file(s) uploaded successfully!`)
      } else {
        toast.error("Failed to upload files")
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("Failed to upload media files")
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
          <>
            {isAnswerMediaUploading === question.id ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                <p className="text-sm text-muted-foreground">
                  Uploading media...
                </p>
              </div>
            ) : value ? (
              <div className="group relative flex w-full items-center justify-center overflow-hidden rounded-lg border">
                <img
                  src={value}
                  alt="Uploaded media"
                  className="max-h-96 max-w-full object-contain transition-transform group-hover:scale-105"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src =
                      "/placeholder-image.jpg"
                  }}
                />
                <button
                  onClick={() => handleAnswerChangeWithSave(question.id, "")}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <span className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white">
                    Delete Media
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
                    Upload Media / Documents
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
        // Handle input and textarea
        const isTextarea = answerType === "textarea" || answerType === "input"
        if (isTextarea) {
          return (
            <textarea
              value={value ?? ""}
              onChange={(e) =>
                handleAnswerChangeWithSave(question.id, e.target.value)
              }
              rows={5}
              className="min-h-30 w-full resize-y rounded-lg border border-input px-4 py-3 focus:ring-2 focus:ring-primary"
              placeholder="Type your answer here..."
            />
          )
        }
        return (
          <input
            type="text"
            value={value ?? ""}
            onChange={(e) =>
              handleAnswerChangeWithSave(question.id, e.target.value)
            }
            className="w-full rounded-lg border border-input px-4 py-3 focus:ring-2 focus:ring-primary"
            placeholder="Type your answer here..."
          />
        )
      }
    }
  }

  if (isLoadingInspection) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading inspection data...
      </div>
    )
  }

  if (!inspection) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">Inspection not found</p>
        <Button onClick={() => navigate("/organization/audit/inspections")}>
          Back to Inspections
        </Button>
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
              <h1 className="text-2xl font-bold">
                Edit: {template?.templateName}
              </h1>
              {inspection?.site && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" /> {inspection.site.name}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
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
                          Updating...
                        </>
                      ) : (
                        <>
                          {selectedStatus === "COMPLETED" && "✅"}
                          {selectedStatus === "CANCELLED" && "❌"}
                          {selectedStatus === "DRAFT" && "📄"}
                          {selectedStatus === "IN_PROGRESS" && "📝"}
                          <span className="ml-1">{selectedStatus}</span>
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("IN_PROGRESS")}
                    >
                      <span className="mr-2">📝</span> IN PROGRESS
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("COMPLETED")}
                    >
                      <span className="mr-2">✅</span> COMPLETED
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("CANCELLED")}
                    >
                      <span className="mr-2">❌</span> CANCELLED
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("DRAFT")}
                    >
                      <span className="mr-2">📄</span> DRAFT
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex gap-8 px-6 py-8">
        {/* Sticky Left Navigation */}
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

                  const hasMediaFiles = answers[question.id]?.mediaFiles

                  return (
                    <Card key={question.id} className="p-6">
                      <div className="mb-4 flex items-start justify-between">
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
                              Saving...
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Q{pageIndex + 1}
                        </span>
                      </div>

                      <div className="mb-6">
                        {renderQuestionInput(question)}
                      </div>

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
                        <div className="mt-4">
                          <p className="mb-2 text-sm font-medium">Note</p>
                          <textarea
                            value={answers[question.id]?.note || ""}
                            onChange={(e) =>
                              handleNoteChangeWithSave(
                                question.id,
                                e.target.value
                              )
                            }
                            className="min-h-22.5 w-full rounded-lg border border-input px-4 py-3"
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

                        {externalMediaUploading == question.id ? (
                          <p className="flex items-center gap-1 text-xs text-yellow-600">
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-yellow-600 border-t-transparent"></span>
                            Uploading...
                          </p>
                        ) : (
                          <label
                            htmlFor={`update-external-media-${question.id}`}
                          >
                            <Button asChild variant="outline" size="sm">
                              <span>
                                <CloudUpload className="mr-2 h-4 w-4" />
                                Add Media
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

            {inspection.status !== "COMPLETED" && (
              <Button
                onClick={handleSubmit}
                size="lg"
                disabled={isSubmitting || isUpdatingInspection}
              >
                {isSubmitting ? "Completing..." : "Complete Inspection"}
              </Button>
            )}

            {currentPageIndex < pages.length - 1 && (
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
