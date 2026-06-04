/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button"
import { useGenerateRecommendationFromAiMutation } from "@/redux/apis/organization/ai.api"
import {
  useGetRecommendationByInspectionIdQuery,
  useUpdateRecommendationQuestionByIdMutation,
  useUpdateRecommendationSummaryMutation,
} from "@/redux/apis/organization/recommendation.api"
import { debounce } from "lodash"
import {
  AlertCircle,
  CheckCircle,
  CopyCheck,
  FileText,
  Sparkles,
  Star,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import TextareaAutosize from "react-textarea-autosize"
import CreateNewFindingModal from "../findings/CreateNewFindingModal"

interface ResultItem {
  observation: string
  recommendation: string
  question?: string
  standard: string
  id?: string
}

interface EditFormData {
  summary: string
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

export default function ViewAndEditRecommendation({
  inspectionId,
}: {
  inspectionId: string
}) {
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error" | "saving" | null
    message: string
  }>({ type: null, message: "" })
  const [isGenerating, setIsGenerating] = useState(false)
  const [questions, setQuestions] = useState<ResultItem[]>([])
  const [findingModalState, setFindingModalState] = useState(
    initialFindingModalState
  )

  // Fix #3: ID-based debounce ref (not index-based)
  const debouncedSaveQuestionRef = useRef<Record<string, any>>({})
  const debouncedSaveSummaryRef = useRef<any>(null)

  // Fix #4: Prevent duplicate API calls
  const lastSavedQuestionRef = useRef<Record<string, string>>({})
  const lastSavedSummaryRef = useRef<string>("")

  // APIs
  const { data, isLoading, refetch } =
    useGetRecommendationByInspectionIdQuery(inspectionId)
  const [updateRecommendationQuestion] =
    useUpdateRecommendationQuestionByIdMutation()
  const [updateRecommendationSummary] = useUpdateRecommendationSummaryMutation()
  const [generateRecommendation] = useGenerateRecommendationFromAiMutation()

  const { register, watch, setValue } = useForm<EditFormData>({
    defaultValues: { summary: "" },
  })

  const summaryValue = watch("summary")
  const recommendation = data?.data
  const hasRecommendation = !!recommendation?.questions?.length

  // Load data - reset everything when new data comes
  useEffect(() => {
    if (recommendation) {
      setQuestions(recommendation.questions || [])
      setValue("summary", recommendation.summary || "")

      // Reset last saved refs on new data load
      lastSavedSummaryRef.current = recommendation.summary || ""
      lastSavedQuestionRef.current = {}
      recommendation.questions?.forEach((q: any) => {
        if (q.id) {
          lastSavedQuestionRef.current[q.id] = JSON.stringify({
            observation: q.observation,
            recommendation: q.recommendation,
            standard: q.standard,
          })
        }
      })
    }
  }, [recommendation, setValue])

  // Fix #1 & #2: Stable summary debounce - creates ONLY ONCE
  useEffect(() => {
    if (!recommendation?.id) return

    // Create debounced function only once per recommendation id
    const fn = debounce(async (summary: string) => {
      // Prevent duplicate API calls
      if (lastSavedSummaryRef.current === summary) {
        console.log("Summary unchanged, skipping save")
        return
      }

      try {
        setSaveStatus({ type: "saving", message: "Saving summary..." })

        await updateRecommendationSummary({
          id: recommendation.id,
          data: { summary },
        }).unwrap()

        lastSavedSummaryRef.current = summary
        setSaveStatus({ type: "success", message: "Summary saved" })
        setTimeout(() => setSaveStatus({ type: null, message: "" }), 1500)
      } catch (error: any) {
        console.error("Summary save error:", error)
        setSaveStatus({ type: "error", message: "Failed to save summary" })
        setTimeout(() => setSaveStatus({ type: null, message: "" }), 2000)
      }
    }, 1500)

    debouncedSaveSummaryRef.current = fn

    return () => {
      fn.cancel()
    }
  }, [recommendation?.id, updateRecommendationSummary])

  // Stable summary change detection
  const prevSummaryRef = useRef<string>("")
  useEffect(() => {
    if (!recommendation?.id) return

    // Only trigger if actually changed by user
    if (summaryValue === prevSummaryRef.current) return

    prevSummaryRef.current = summaryValue
    debouncedSaveSummaryRef.current?.(summaryValue)
  }, [summaryValue, recommendation?.id])

  // Fix #3: Create debounced save for each question by ID
  const setupQuestionDebounce = useCallback(
    (questionId: string) => {
      if (debouncedSaveQuestionRef.current[questionId]) return

      debouncedSaveQuestionRef.current[questionId] = debounce(
        async (questionData: ResultItem) => {
          if (!questionData.id) return

          // Prevent duplicate API calls
          const currentState = JSON.stringify({
            observation: questionData.observation,
            recommendation: questionData.recommendation,
            standard: questionData.standard,
          })

          if (lastSavedQuestionRef.current[questionData.id] === currentState) {
            console.log("Question unchanged, skipping save")
            return
          }

          try {
            await updateRecommendationQuestion({
              id: questionData.id,
              data: {
                observation: questionData.observation || "",
                standard: questionData.standard || "",
                recommendation: questionData.recommendation || "",
              },
            }).unwrap()

            lastSavedQuestionRef.current[questionData.id] = currentState
            setSaveStatus({ type: "success", message: "Question saved" })
            setTimeout(() => setSaveStatus({ type: null, message: "" }), 1500)
          } catch (error: any) {
            console.error("Save error:", error)
            setSaveStatus({
              type: "error",
              message: error?.data?.message || "Save failed",
            })
            setTimeout(() => setSaveStatus({ type: null, message: "" }), 2000)
          }
        },
        1000
      )
    },
    [updateRecommendationQuestion]
  )

  // 🔥 FIX #2: ID-based question change handler (NOT index-based)
  const handleQuestionChange = useCallback(
    (questionId: string, field: keyof ResultItem, value: string) => {
      // Update state using ID (not index)
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, [field]: value } : q))
      )

      // Setup and use ID-based debounce
      if (questionId) {
        setupQuestionDebounce(questionId)

        // Get the updated question data
        const updatedQuestion = questions.find((q) => q.id === questionId)
        if (updatedQuestion) {
          const updatedData = { ...updatedQuestion, [field]: value }
          debouncedSaveQuestionRef.current[questionId]?.(updatedData)
        }
      }
    },
    [questions, setupQuestionDebounce]
  )

  const handleGenerateRecommendation = async () => {
    setIsGenerating(true)
    setSaveStatus({ type: "saving", message: "Generating recommendation..." })

    try {
      await generateRecommendation({ inspectionId }).unwrap()
      await refetch()
      setSaveStatus({
        type: "success",
        message: "Recommendation generated successfully!",
      })
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 2000)
    } catch (error: any) {
      setSaveStatus({
        type: "error",
        message: error?.data?.message || "Failed to generate",
      })
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 3000)
    } finally {
      setIsGenerating(false)
    }
  }

  // Cleanup all debounces on unmount
  useEffect(() => {
    return () => {
      Object.values(debouncedSaveQuestionRef.current).forEach((debounced) => {
        debounced?.cancel()
      })
      debouncedSaveSummaryRef.current?.cancel()
    }
  }, [])

  if (isLoading) return null

  // Generate button view
  if (!hasRecommendation) {
    return (
      <div className="min-h-screen rounded-md">
        <div className="mx-auto">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6 md:p-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 rounded-full bg-[#6EC075]/10 p-3">
                  <Sparkles className="h-8 w-8 text-[#6EC075]" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">
                  No Recommendation Available
                </h2>
                <p className="mb-6 text-gray-600">
                  Generate an AI-powered recommendation based on inspection
                  findings
                </p>
                <Button
                  size="lg"
                  onClick={handleGenerateRecommendation}
                  disabled={isGenerating}
                  className="cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Recommendation Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Validate all questions have IDs
  const hasValidIds = questions.every((q) => q.id)
  if (!hasValidIds) {
    console.error("Some questions are missing IDs:", questions)
  }

  return (
    <div id="recommendation-page" className="min-h-screen rounded-md p-4 md:p-6 lg:p-8">
      <div className="max-w-8xl mx-auto">
        {/* Header with Status */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold md:text-3xl">
              View and Edit Recommendation
            </h1>

            {/* Save Status */}
            {(saveStatus.type === "saving" ||
              saveStatus.type === "success" ||
              saveStatus.type === "error") && (
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-2 ${
                  saveStatus.type === "saving"
                    ? "border border-blue-200 bg-blue-50 text-blue-700"
                    : saveStatus.type === "success"
                      ? "border border-green-200 bg-green-50 text-green-700"
                      : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {saveStatus.type === "saving" && (
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
                )}
                {saveStatus.type === "success" && (
                  <CheckCircle className="h-4 w-4" />
                )}
                {saveStatus.type === "error" && (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {saveStatus.message}
                </span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6EC075]/10">
                  <FileText className="h-5 w-5 text-[#6EC075]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Findings</p>
                  <p className="text-xl font-semibold">{questions.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="text-sm font-medium">
                    {new Date(recommendation.createdAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Auto-Save</p>
                  <p className="text-sm font-medium text-green-600">Active</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Questions List */}
          <div className="space-y-4 lg:col-span-2">
            {/* 🔥 FIX #1: Using stable ID as key - NEVER use index */}
            {questions.map((question) => (
              <div
                key={question.id} // Using ID as stable key
                className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all"
              >
                {/* Header */}
                <div className="border-b border-[#6EC075]/20 bg-[#6EC075]/5 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex w-full items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                        <span className="text-sm font-bold text-white">
                          {/* Find index for display only */}
                          {questions.findIndex((q) => q.id === question.id) + 1}
                        </span>
                      </div>
                      <input
                        value={question.question || ""}
                        onChange={(e) =>
                          handleQuestionChange(
                            question.id!,
                            "question",
                            e.target.value
                          )
                        }
                        type="text"
                        className="flex-1 border-none bg-transparent text-lg font-semibold outline-none focus:ring-0"
                        disabled
                        placeholder="Question title"
                      />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-4 p-4 md:p-6">
                  {/* Observation */}
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-[#6EC075]" />
                      <h4 className="font-semibold">AI Observation</h4>
                    </div>
                    <TextareaAutosize
                      value={question.observation || ""}
                      onChange={(e: any) =>
                        handleQuestionChange(
                          question.id!,
                          "observation",
                          e.target.value
                        )
                      }
                      rows={1}
                      className="w-full rounded-lg border border-border p-4 outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter observation..."
                    />
                  </div>

                  {/* Recommendation */}
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-[#6EC075]" />
                      <h4 className="font-semibold">AI Recommendation</h4>
                    </div>
                    <TextareaAutosize
                      value={question.recommendation || ""}
                      onChange={(e) =>
                        handleQuestionChange(
                          question.id!,
                          "recommendation",
                          e.target.value
                        )
                      }
                      rows={2}
                      className="w-full rounded-lg border border-border p-4 outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter recommendation..."
                    />
                  </div>

                  {/* Standard */}
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Star className="h-5 w-5 text-[#6EC075]" />
                      <h4 className="font-semibold">Applicable Standard</h4>
                    </div>
                    <TextareaAutosize
                      value={question.standard || ""}
                      onChange={(e) =>
                        handleQuestionChange(
                          question.id!,
                          "standard",
                          e.target.value
                        )
                      }
                      rows={2}
                      className="w-full rounded-lg border border-border p-4 outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter standard reference..."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end px-6 pb-4">
                  <button
                    onClick={() =>
                      setFindingModalState({
                        open: true,
                        additionalData: {
                          questionId: question.id!,
                          inspectionId: inspectionId!,
                          actionTitle: question.question as string,
                          actionDisc:
                            question.recommendation + question.standard,
                        },
                      })
                    }
                    type="button"
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                  >
                    <CopyCheck className="w-4" /> Add To Finding
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Sidebar */}
          <div>
            <div className="sticky top-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border p-4 md:p-6">
                <h2 className="text-lg font-semibold md:text-xl">
                  Executive Summary
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Auto-saves as you type
                </p>
              </div>

              <div className="p-4 md:p-6">
                <TextareaAutosize
                  {...register("summary")}
                  rows={1}
                  className="w-full resize-none rounded-lg border border-border px-3 py-3 font-mono text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#6EC075]"
                  placeholder="Enter executive summary..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <CreateNewFindingModal
        open={findingModalState.open}
        onClose={() => setFindingModalState(initialFindingModalState)}
        additionalData={findingModalState.additionalData}
      />
    </div>
  )
}
