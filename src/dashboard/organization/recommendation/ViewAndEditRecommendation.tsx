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
import { Controller, useFieldArray, useForm } from "react-hook-form"

interface ResultItem {
  observation: string
  recommendation: string
  question?: string
  standard: string
  id?: string
}

interface EditFormData {
  questions: ResultItem[]
  summary: string
}

export default function ViewAndEditRecommendation({
  inspectionId,
}: {
  inspectionId: string
}) {
  console.log(inspectionId)
  // State
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error" | "saving" | null
    message: string
  }>({ type: null, message: "" })
  const [isGenerating, setIsGenerating] = useState(false)

  // Refs to track previous values for each question
  const previousQuestionsRef = useRef<ResultItem[]>([])
  const previousSummaryRef = useRef<string>("")

  // Refs for debounced functions
  const autoSaveSingleQuestionRef = useRef<
    Record<number, ReturnType<typeof debounce>>
  >({})
  const autoSaveSummaryRef = useRef<any>(null)

  // Track which question is being saved
  const [savingQuestionIndex, setSavingQuestionIndex] = useState<number | null>(
    null
  )

  // RTQ State
  const { data, isLoading } =
    useGetRecommendationByInspectionIdQuery(inspectionId)
  const [updateRecommendationQuestion] =
    useUpdateRecommendationQuestionByIdMutation()
  const [updateRecommendationSummary] = useUpdateRecommendationSummaryMutation()
  const [generateRecommendation] = useGenerateRecommendationFromAiMutation()

  // Local variable
  const recommendation = data?.data
  const hasRecommendation = !!recommendation?.questions?.length

  // Hook Form
  const { control, reset, watch } = useForm<EditFormData>({
    defaultValues: { questions: [], summary: "" },
  })

  const { fields } = useFieldArray({ control, name: "questions" })

  // Watch for form changes
  const formValues = watch()

  // Function to check if a specific question has changed
  const hasQuestionChanged = (
    currentQuestion: ResultItem,
    previousQuestion: ResultItem
  ): boolean => {
    // Check if previousQuestion exists
    if (!previousQuestion) return true

    return (
      currentQuestion.observation !== previousQuestion.observation ||
      currentQuestion.recommendation !== previousQuestion.recommendation ||
      currentQuestion.standard !== previousQuestion.standard
    )
  }

  // Save function for a single question
  const saveSingleQuestion = useCallback(
    async (index: number, questionData: ResultItem) => {
      console.log("API HIT", index, questionData)
      if (!recommendation?.id || !hasRecommendation) return

      try {
        setSavingQuestionIndex(index)
        setSaveStatus({
          type: "saving",
          message: `Saving question ${index + 1}...`,
        })

        // Call API with single question data
        await updateRecommendationQuestion({
          id: questionData.id,
          data: {
            observation: questionData.observation || "",
            standard: questionData.standard || "",
            recommendation: questionData.recommendation || "",
          },
        }).unwrap()

        // Update previous value for this question
        if (previousQuestionsRef.current[index]) {
          previousQuestionsRef.current[index] = { ...questionData }
        }

        setSaveStatus({
          type: "success",
          message: `Question ${index + 1} saved successfully!`,
        })
        setTimeout(() => setSaveStatus({ type: null, message: "" }), 2000)
      } catch (error: any) {
        console.error("Save question error:", error)
        setSaveStatus({
          type: "error",
          message:
            error?.data?.message || `Failed to save question ${index + 1}`,
        })
        setTimeout(() => setSaveStatus({ type: null, message: "" }), 3000)
      } finally {
        setSavingQuestionIndex(null)
      }
    },
    [recommendation?.id, hasRecommendation, updateRecommendationQuestion]
  )

  // Create debounced version of save function
  useEffect(() => {
    fields.forEach((_, index) => {
      autoSaveSingleQuestionRef.current[index] =
        autoSaveSingleQuestionRef.current[index] ||
        debounce((questionData: ResultItem) => {
          saveSingleQuestion(index, questionData)
        }, 1000)
    })
  }, [fields, fields.length, saveSingleQuestion])

  // Save function for summary
  const saveSummary = useCallback(
    async (summary: string) => {
      if (!recommendation?.id || !hasRecommendation) return

      try {
        setSaveStatus({ type: "saving", message: "Saving summary changes..." })

        await updateRecommendationSummary({
          id: recommendation.id,
          data: { summary },
        }).unwrap()

        previousSummaryRef.current = summary

        setSaveStatus({
          type: "success",
          message: "Summary saved successfully!",
        })
        setTimeout(() => setSaveStatus({ type: null, message: "" }), 2000)
      } catch (error: any) {
        console.error("Save summary error:", error)
        setSaveStatus({
          type: "error",
          message: error?.data?.message || "Failed to save summary",
        })
        setTimeout(() => setSaveStatus({ type: null, message: "" }), 3000)
      }
    },
    [recommendation?.id, hasRecommendation, updateRecommendationSummary]
  )

  // Create debounced version of save summary
  useEffect(() => {
    autoSaveSummaryRef.current = debounce((summary: string) => {
      saveSummary(summary)
    }, 1000)

    return () => {
      if (autoSaveSummaryRef.current) {
        autoSaveSummaryRef.current.cancel()
      }
    }
  }, [saveSummary])

  // Monitor each question individually with a different approach
  useEffect(() => {
    if (!hasRecommendation) return

    formValues.questions?.forEach((currentQuestion, index) => {
      const previousQuestion = previousQuestionsRef.current[index]

      const changed = hasQuestionChanged(currentQuestion, previousQuestion)

      console.log({
        index,
        changed,
        current: currentQuestion,
        previous: previousQuestion,
      })

      if (changed) {
        console.log("calling debounce")

        autoSaveSingleQuestionRef.current[index]?.(currentQuestion)
      }
    })
  }, [formValues.questions, hasRecommendation])

  // Monitor summary changes
  useEffect(() => {
    if (!hasRecommendation || formValues.summary === undefined) return

    const currentSummary = formValues.summary
    const previousSummary = previousSummaryRef.current

    if (currentSummary !== previousSummary) {
      console.log("Summary changed, saving...")
      if (autoSaveSummaryRef.current) {
        autoSaveSummaryRef.current(currentSummary)
      }
    }
  }, [formValues.summary, hasRecommendation])

  // Reset form when data loads
  useEffect(() => {
    if (data?.data && hasRecommendation) {
      const questions = data.data.questions || []
      const summary = data.data.summary || ""

      console.log("Loading data:", { questions, summary })

      reset({
        questions: questions,
        summary: summary,
      })

      // Initialize refs with initial values - deep clone to avoid reference issues
      previousQuestionsRef.current = questions.map((q: any) => ({
        ...q,
      }))
      previousSummaryRef.current = summary
    }
  }, [data, reset, hasRecommendation])

  const handleGenerateRecommendation = async () => {
    setIsGenerating(true)
    setSaveStatus({ type: "saving", message: "Generating recommendation..." })

    try {
      const response = await generateRecommendation({ inspectionId }).unwrap()
      if (response.success) {
        setSaveStatus({
          type: "success",
          message: "Recommendation generated successfully!",
        })
        setTimeout(() => setSaveStatus({ type: null, message: "" }), 2000)
      }
    } catch (error: any) {
      setSaveStatus({
        type: "error",
        message: error?.data?.message || "Failed to generate recommendation",
      })
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 3000)
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) return null

  // Show generate button if no recommendation exists
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

            <div className="p-6 md:p-8">
              <div className="rounded-lg border border-secondary bg-secondary p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="mb-1 font-medium text-blue-800">
                      What happens next?
                    </h4>
                    <ul className="space-y-1 text-sm text-blue-700">
                      <li>• AI will analyze all inspection findings</li>
                      <li>• Generate observations and recommendations</li>
                      <li>• Reference applicable standards</li>
                      <li>• Create an executive summary</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalFindings = recommendation?.questions?.length || 0

  return (
    <div className="min-h-screen rounded-md p-4 md:p-6 lg:p-8">
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">
                View and Edit Recommendation
              </h1>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              {/* Save Status Indicator */}
              {saveStatus.type === "saving" && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-blue-700">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-700"></div>
                  <span className="text-sm font-medium">
                    {saveStatus.message}
                  </span>
                </div>
              )}

              {saveStatus.type === "success" && (
                <div className="flex animate-in items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-green-700 fade-in slide-in-from-top-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">
                    {saveStatus.message}
                  </span>
                </div>
              )}

              {saveStatus.type === "error" && (
                <div className="flex animate-in items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-700 fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">
                    {saveStatus.message}
                  </span>
                </div>
              )}
            </div>
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
                  <p className="text-xl font-semibold">{totalFindings}</p>
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
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="text-sm font-medium text-green-600">
                    Auto-save enabled
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column - All findings directly visible */}
          <div className="space-y-4 lg:col-span-2">
            {fields.map((field, index) => (
              <Controller
                key={field.id}
                control={control}
                name={`questions.${index}`}
                render={({ field: { value, onChange } }) => {
                  const isSavingThisQuestion = savingQuestionIndex === index

                  return (
                    <div
                      className={`overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md ${
                        isSavingThisQuestion ? "border-blue-400 shadow-md" : ""
                      }`}
                    >
                      {/* Card Header */}
                      <div className="w-full cursor-text border-b border-[#6EC075]/20 bg-[#6EC075]/5 px-6 py-4 transition-colors hover:bg-[#6EC075]/10">
                        <div className="flex items-center justify-between">
                          <div className="flex w-full items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                              <span className="text-sm font-bold text-white">
                                {index + 1}
                              </span>
                            </div>
                            <div className="flex-1">
                              <input
                                value={value.question || ""}
                                onChange={(e) =>
                                  onChange({
                                    ...value,
                                    question: e.target.value,
                                  })
                                }
                                type="text"
                                className="w-full border-none bg-transparent text-lg font-semibold outline-none focus:ring-0"
                                disabled
                              />
                            </div>
                            {isSavingThisQuestion && (
                              <div className="flex items-center gap-1 text-xs text-blue-600">
                                <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-blue-600"></div>
                                <span>Saving...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 p-4 md:p-6">
                        {/* Observation */}
                        <div>
                          <div className="mb-3 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-[#6EC075]" />
                            <h4 className="font-semibold text-gray-900 dark:text-gray-200">
                              AI Observation
                            </h4>
                          </div>
                          <div className="rounded-lg border border-[#6EC075]/20 bg-[#6EC075]/5 p-4">
                            <textarea
                              value={value.observation || ""}
                              onChange={(e) =>
                                onChange({
                                  ...value,
                                  observation: e.target.value,
                                })
                              }
                              rows={2}
                              className="w-full border-none bg-transparent outline-none focus:ring-0"
                              placeholder="Enter observation..."
                            />
                          </div>
                        </div>

                        {/* Recommendation */}
                        <div>
                          <div className="mb-3 flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-[#6EC075]" />
                            <h4 className="font-semibold text-gray-900 dark:text-gray-200">
                              AI Recommendation
                            </h4>
                          </div>
                          <div className="rounded-lg border border-[#6EC075]/20 bg-[#6EC075]/5 p-4">
                            <textarea
                              value={value.recommendation || ""}
                              onChange={(e) =>
                                onChange({
                                  ...value,
                                  recommendation: e.target.value,
                                })
                              }
                              rows={3}
                              className="w-full border-none bg-transparent outline-none focus:ring-0"
                              placeholder="Enter recommendation..."
                            />
                          </div>
                        </div>

                        {/* Standard Reference */}
                        <div>
                          <div className="mb-3 flex items-center gap-2">
                            <Star className="h-5 w-5 text-[#6EC075]" />
                            <h4 className="font-semibold text-gray-900 dark:text-gray-200">
                              Applicable Standard
                            </h4>
                          </div>
                          <div className="rounded-lg border border-[#6EC075]/20 bg-[#6EC075]/5 p-4">
                            <textarea
                              value={value.standard || ""}
                              rows={1}
                              onChange={(e) =>
                                onChange({
                                  ...value,
                                  standard: e.target.value,
                                })
                              }
                              className="w-full border-none bg-transparent leading-relaxed outline-none focus:ring-0"
                              placeholder="Enter standard reference..."
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end px-6 pb-4">
                        <button
                          type="button"
                          className="flex w-fit items-center justify-center gap-1 text-sm text-primary transition-colors hover:text-primary/80"
                        >
                          <CopyCheck className="w-4" /> Add To Finding
                        </button>
                      </div>
                    </div>
                  )
                }}
              />
            ))}
          </div>

          {/* Right Column - Summary */}
          <div>
            <div className="sticky top-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 bg-gray-50 p-4 md:p-6">
                <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
                  Executive Summary
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Edits are auto-saved as you type
                </p>
              </div>

              <div className="p-4 md:p-6">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Summary Text
                </label>
                <Controller
                  control={control}
                  name="summary"
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={20}
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-3 font-mono text-sm text-gray-700 transition-all focus:border-transparent focus:ring-2 focus:ring-[#6EC075] focus:outline-none"
                      placeholder="Enter executive summary..."
                    />
                  )}
                />

                <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-blue-900">
                        Auto-Save Features
                      </h4>
                      <ul className="space-y-1 text-xs text-blue-700">
                        <li>✓ Each question saves independently</li>
                        <li>✓ Only changed questions trigger API calls</li>
                        <li>✓ Summary saves separately</li>
                        <li>
                          ✓ Visual indicator shows which question is saving
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
