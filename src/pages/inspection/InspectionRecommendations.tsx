import {
  useGetRecommendationByInspectionIdQuery,
  useUpdateRecommendationQuestionByIdMutation,
  useUpdateRecommendationSummaryMutation,
} from "@/redux/apis/organization/recommendation.api"
import type { Recommendation } from "@/types/recommendation"
import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"

type SaveStatus = Record<string, "saving" | "saved" | "error">

export default function InspectionRecommendations() {
  const { id: inspectionId } = useParams<{ id: string }>()

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({})
  const [summaryDraft, setSummaryDraft] = useState("")
  const [savingSummary, setSavingSummary] = useState(false)
  // Tracks which recommendation's id auto-expand has already run for, so it
  // re-fires once per inspection instead of only ever once for the
  // component's lifetime. The route this page lives on
  // (audit/inspections/:id/recommendations) isn't remounted when navigating
  // between different inspections, so a plain one-shot boolean flag would
  // stay "initialized" forever after the first inspection visited, silently
  // breaking auto-expand for every subsequent one.
  const [expandedForId, setExpandedForId] = useState<string | null>(null)

  const {
    data: recResponse,
    isLoading: loading,
    error,
  } = useGetRecommendationByInspectionIdQuery(inspectionId!, {
    skip: !inspectionId,
  })

  const [updateRecommendationQuestionById] =
    useUpdateRecommendationQuestionByIdMutation()
  const [updateRecommendationSummary] = useUpdateRecommendationSummaryMutation()

  const rec: Recommendation | null = recResponse?.data ?? null
  const notFound =
    !loading &&
    !!error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 404
  const otherError =
    !loading && !!error && !notFound ? "Failed to load recommendations" : null

  // Seed the summary draft and default-expand the first result once the
  // recommendation loads (mirrors the old effect keyed on the fetched data).
  useEffect(() => {
    if (!rec) return
    setSummaryDraft(rec.summary)
    if (expandedForId !== rec.id && rec.questions[0]) {
      setExpanded({ [rec.questions[0].id]: true })
      setExpandedForId(rec.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec?.id])

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function saveResult(
    resultId: string,
    field: "observation" | "standard" | "recommendation",
    value: string
  ) {
    setSaveStatus((s) => ({ ...s, [resultId]: "saving" }))
    try {
      await updateRecommendationQuestionById({
        id: resultId,
        data: { [field]: value },
      }).unwrap()
      setSaveStatus((s) => ({ ...s, [resultId]: "saved" }))
    } catch {
      setSaveStatus((s) => ({ ...s, [resultId]: "error" }))
    }
  }

  async function saveSummary() {
    if (!rec) return
    setSavingSummary(true)
    try {
      await updateRecommendationSummary({
        id: rec.id,
        data: { summary: summaryDraft },
      }).unwrap()
    } finally {
      setSavingSummary(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/organization/audit/inspections"
          className="hover:text-foreground"
        >
          Inspections
        </Link>
        <span>/</span>
        <Link
          to={`/organization/audit/inspections/${inspectionId}`}
          className="hover:text-foreground"
        >
          Inspection
        </Link>
        <span>/</span>
        <span className="text-foreground">Recommendations</span>
      </div>

      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">
          AI Recommendations
        </h1>
      </div>

      {otherError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {otherError}
        </div>
      )}

      {notFound && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">
            No recommendations yet
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Recommendations are generated after the AI processes your inspection
            answers and notes. Complete the inspection and upload your notes
            first.
          </p>
          <div className="mt-2 flex gap-3">
            <Link
              to={`/organization/audit/inspections/${inspectionId}`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to inspection
            </Link>
            <Link
              to={`/organization/audit/inspections/${inspectionId}/note`}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Upload notes
            </Link>
          </div>
        </div>
      )}

      {rec && (
        <>
          {/* Summary card */}
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Executive summary
            </p>
            <textarea
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            />
            {summaryDraft !== rec.summary && (
              <div className="mt-2 flex justify-end">
                <button
                  onClick={saveSummary}
                  disabled={savingSummary}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {savingSummary ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : null}
                  Save summary
                </button>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              {rec.questions.length} finding
              {rec.questions.length !== 1 ? "s" : ""}
            </p>

            {rec.questions.map((result, idx) => (
              <div
                key={result.id}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                {/* Header */}
                <button
                  onClick={() => toggle(result.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {result.question}
                    </span>
                  </div>
                  {expanded[result.id] ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {/* Expanded fields */}
                {expanded[result.id] && (
                  <div className="flex flex-col gap-4 border-t border-border px-5 py-4">
                    {(
                      [
                        { key: "observation", label: "Observation" },
                        { key: "standard", label: "Applicable standard" },
                        { key: "recommendation", label: "Recommendation" },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key}>
                        <label className="mb-1.5 block text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                          {label}
                        </label>
                        <textarea
                          defaultValue={result[key]}
                          rows={3}
                          onBlur={(e) =>
                            saveResult(result.id, key, e.target.value)
                          }
                          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                        />
                      </div>
                    ))}

                    {saveStatus[result.id] && (
                      <p
                        className={`text-xs ${
                          saveStatus[result.id] === "saved"
                            ? "text-green-600"
                            : saveStatus[result.id] === "error"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {saveStatus[result.id] === "saving"
                          ? "Saving…"
                          : saveStatus[result.id] === "saved"
                            ? "Saved"
                            : "Save failed"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              to={`/organization/audit/inspections/${inspectionId}/actions`}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View corrective actions →
            </Link>
            <Link
              to={`/organization/audit/inspections/${inspectionId}`}
              className="rounded-md border border-border px-5 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Back to inspection
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
