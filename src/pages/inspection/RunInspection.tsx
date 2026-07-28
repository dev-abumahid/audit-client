import { useFindingsForInspection } from "@/hooks/useFindingsForInspection"
import {
  useGetSingleInspectionQuery,
  useUpdateInspectionMutation,
  useUpdateInspectionQuestionAnswerMutation,
} from "@/redux/apis/organization/inspection.api"
import type {
  InspectionDetail,
  PageDef,
  QuestionAnswer,
} from "@/types/inspection"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Sparkles,
  ListChecks,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import { QuestionInput } from "./QuestionInput"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

type SaveState = "idle" | "saving" | "saved" | "error"

export default function RunInspection() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [completing, setCompleting] = useState(false)

  // Local answer cache for optimistic updates — stored in state so render can read it
  const [answerCache, setAnswerCache] = useState<
    Record<string, QuestionAnswer>
  >({})
  // Tracks which inspection *identity* (by id) the cache above was last
  // seeded from, so we can re-seed it once per inspection load (e.g. initial
  // load or navigating to a different inspection) without calling setState
  // synchronously inside a useEffect (adjusts state during render instead —
  // see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  // Deliberately keyed on `inspection.id` rather than the `inspection`
  // object reference: RTK Query returns a new object reference on every
  // refetch (including the background refetch triggered by
  // updateInspectionQuestionAnswer's autosave invalidating the INSPECTION
  // tag), even when it's the same inspection. Keying on the object
  // reference would re-seed — and clobber — answerCache on every autosave,
  // wiping out in-progress edits to other questions that hadn't saved yet.
  const [seededFromId, setSeededFromId] = useState<string | null>(null)

  const {
    data: inspectionResponse,
    isLoading: loading,
    isError: hasLoadError,
  } = useGetSingleInspectionQuery(id!, { skip: !id })
  const inspection: InspectionDetail | null = inspectionResponse?.data ?? null
  const error = hasLoadError ? t("pages.inspection.run.loadError") : null

  const [updateInspectionQuestionAnswer] =
    useUpdateInspectionQuestionAnswerMutation()
  const [updateInspection] = useUpdateInspectionMutation()

  if (inspection && inspection.id !== seededFromId) {
    const initial: Record<string, QuestionAnswer> = {}
    inspection.questionAnswers.forEach((qa) => {
      initial[qa.questionId] = qa
    })
    setAnswerCache(initial)
    setSeededFromId(inspection.id)
  }

  const { findings, isLoading: findingsLoading } = useFindingsForInspection<{
    inspectionId: string
  }>(id)
  const actionCount = findingsLoading ? null : findings.length

  const pages: PageDef[] = useMemo(
    () =>
      (inspection?.template?.pages ?? [])
        .slice()
        .sort((a, b) => a.pageIndex - b.pageIndex),
    [inspection]
  )

  const qaByQuestionId = useMemo(() => {
    const map: Record<string, QuestionAnswer> = {}
    inspection?.questionAnswers.forEach((qa) => {
      map[qa.questionId] = qa
    })
    return map
  }, [inspection])

  // Debounced autosave timers, keyed by qaId — each question gets its own
  // independent timer (and remembers the answer it's about to save) so
  // answering question A doesn't clear/cancel a still-pending save for
  // question B (a normal fast-tapping pattern where the user answers
  // multiple questions within the 600ms debounce window).
  const saveTimeouts = useRef<
    Map<string, { timeout: ReturnType<typeof setTimeout>; answer: unknown }>
  >(new Map())

  useEffect(() => {
    const timeouts = saveTimeouts.current
    return () => {
      timeouts.forEach(({ timeout }) => clearTimeout(timeout))
      timeouts.clear()
    }
  }, [])

  const handleAnswerChange = useCallback(
    (qaId: string, answer: unknown) => {
      // optimistically update cache
      setAnswerCache((prev) => {
        const existing = Object.values(prev).find((qa) => qa.id === qaId)
        if (!existing) return prev
        return { ...prev, [existing.questionId]: { ...existing, answer } }
      })

      setSaveState("saving")
      const existing = saveTimeouts.current.get(qaId)
      if (existing) clearTimeout(existing.timeout)

      const timeout = setTimeout(() => {
        saveTimeouts.current.delete(qaId)
        updateInspectionQuestionAnswer({ id: qaId, data: { answer } })
          .unwrap()
          .then(() => setSaveState("saved"))
          .catch(() => setSaveState("error"))
      }, 600)
      saveTimeouts.current.set(qaId, { timeout, answer })
    },
    [updateInspectionQuestionAnswer]
  )

  // Fires and awaits every pending debounced save immediately, so that
  // completing the inspection right after answering a question (within the
  // 600ms debounce window) never loses that answer. The flushed saves are
  // independent of each other (different qaIds, no shared state) so they run
  // concurrently rather than serially — but we use allSettled (not
  // Promise.all) so one broken save can't block the others from persisting,
  // then explicitly check the results: any rejection means an answer failed
  // to save, so we surface saveState "error" and throw to abort completion,
  // rather than silently proceeding to mark the inspection COMPLETED with a
  // lost answer (the exact bug this flush exists to prevent).
  async function flushPendingSaves() {
    const pending = Array.from(saveTimeouts.current.entries())
    if (pending.length === 0) return

    saveTimeouts.current.clear()
    const results = await Promise.allSettled(
      pending.map(([qaId, { timeout, answer }]) => {
        clearTimeout(timeout)
        return updateInspectionQuestionAnswer({
          id: qaId,
          data: { answer },
        }).unwrap()
      })
    )

    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    )
    if (failures.length > 0) {
      // Logged distinctly from the completion mutation's own failure so
      // it's possible to tell, from logs/monitoring alone, whether an
      // aborted "complete" action was caused by a lost answer here or by
      // the updateInspection call itself failing.
      console.error(
        "Failed to flush pending answer save(s) before completing inspection:",
        failures.map((f) => f.reason)
      )
      setSaveState("error")
      throw new Error("Failed to save one or more pending answers")
    }
  }

  async function handleComplete() {
    if (!id) return
    setCompleting(true)
    try {
      await flushPendingSaves()
      await updateInspection({ id, data: { status: "COMPLETED" } }).unwrap()
      navigate("/organization/audit/inspections")
    } catch {
      setCompleting(false)
    }
  }

  const isCompleted = inspection?.status === "COMPLETED"
  const currentPage = pages[currentPageIdx]
  const isLastPage = currentPageIdx === pages.length - 1

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !inspection) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? t("pages.inspection.run.notFound")}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/organization/audit/inspections"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("pages.inspection.run.breadcrumb")}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">
            {inspection.template?.templateName ?? t("pages.inspection.run.defaultTitle")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {saveState === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {t("pages.inspection.run.saving")}
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" /> {t("pages.inspection.run.saved")}
            </span>
          )}
          {saveState === "error" && (
            <span className="text-xs text-destructive">
              {t("pages.inspection.run.saveFailed")}
            </span>
          )}
          <Link
            to={`/organization/audit/inspections/${id}/note`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FileText className="h-4 w-4" />
            {inspection.note
              ? t("pages.inspection.run.viewNotes")
              : t("pages.inspection.run.uploadNotes")}
          </Link>
          <Link
            to={`/organization/audit/inspections/${id}/recommendations`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Sparkles className="h-4 w-4" />
            {t("pages.inspection.run.recommendations")}
          </Link>
          <Link
            to={`/organization/audit/inspections/${id}/actions`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ListChecks className="h-4 w-4" />
            {t("pages.inspection.run.findings")}
            {actionCount !== null && actionCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {actionCount}
              </span>
            )}
          </Link>

          {!isCompleted && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {t("pages.inspection.run.markComplete")}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card p-4 lg:block">
          <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {t("pages.inspection.run.pagesLabel")}
          </p>
          <nav className="flex flex-col gap-1">
            {pages.map((page, idx) => {
              const answered = page.questions.filter((q) => {
                const qa = qaByQuestionId[q.id] ?? answerCache[q.id]
                if (!qa) return false
                const a = qa.answer
                return (
                  a !== null &&
                  a !== undefined &&
                  a !== "" &&
                  !(Array.isArray(a) && a.length === 0)
                )
              }).length
              const total = page.questions.length
              const done = total > 0 && answered === total

              return (
                <button
                  key={page.id}
                  onClick={() => setCurrentPageIdx(idx)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    idx === currentPageIdx
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                      done
                        ? "bg-green-100 text-green-700"
                        : idx === currentPageIdx
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? "✓" : idx + 1}
                  </span>
                  <span className="truncate">{page.title}</span>
                </button>
              )
            })}
          </nav>

          {inspection.site && (
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {t("pages.inspection.run.siteLabel")}
              </p>
              <p className="text-sm font-medium text-foreground">
                {inspection.site.name}
              </p>
            </div>
          )}
        </aside>

        {/* Questions */}
        <main className="flex-1 overflow-y-auto p-6">
          {!currentPage ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-muted-foreground">
                {t("pages.inspection.run.noPages")}
              </p>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="mb-6">
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">
                    {currentPage.title}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {t("pages.inspection.run.pageOf", {
                      current: currentPageIdx + 1,
                      total: pages.length,
                    })}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${((currentPageIdx + 1) / pages.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Question cards */}
              <div className="flex flex-col gap-5">
                {currentPage.questions
                  .slice()
                  .sort((a, b) => a.index - b.index)
                  .map((question) => {
                    const qa =
                      qaByQuestionId[question.id] ?? answerCache[question.id]
                    const mediaFiles = qa?.mediaFiles
                    const files: string[] = Array.isArray(mediaFiles)
                      ? (mediaFiles as unknown[])
                          .map((f) =>
                            typeof f === "string"
                              ? f
                              : (f as { url?: string })?.url
                          )
                          .filter((u): u is string => Boolean(u))
                      : []

                    return (
                      <div
                        key={question.id}
                        className="rounded-lg border border-border bg-card p-5"
                      >
                        <p className="mb-3 text-sm font-medium text-foreground">
                          {question.question}
                          {question.isRequired && (
                            <span
                              className="ml-1 text-destructive"
                              aria-label={t("pages.inspection.run.required")}
                            >
                              *
                            </span>
                          )}
                        </p>
                        <QuestionInput
                          question={question}
                          answer={qa}
                          onChange={handleAnswerChange}
                          disabled={isCompleted || completing}
                        />
                        {files.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {files.map((url, i) => {
                              const fullUrl = url.startsWith("http")
                                ? url
                                : `${BASE_URL}${url}`
                              const isImage =
                                /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)
                              return isImage ? (
                                <img
                                  key={i}
                                  src={fullUrl}
                                  alt={t("pages.inspection.run.attachment", {
                                    index: i + 1,
                                  })}
                                  className="h-20 w-20 rounded-md border border-border object-cover"
                                />
                              ) : (
                                <a
                                  key={i}
                                  href={fullUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  {t("pages.inspection.run.attachment", {
                                    index: i + 1,
                                  })}
                                </a>
                              )
                            })}
                          </div>
                        )}
                        {!isCompleted && (
                          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                            <Link
                              to={`/organization/audit/inspections/${id}/actions?new=1`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              + {t("pages.inspection.run.addFinding")}
                            </Link>
                            {actionCount !== null && actionCount > 0 && (
                              <Link
                                to={`/organization/audit/inspections/${id}/actions`}
                                className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              >
                                {t("pages.inspection.run.entered", {
                                  count: actionCount,
                                })}
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>

              {/* Page navigation */}
              <div className="mt-8 flex items-center justify-between">
                <button
                  disabled={currentPageIdx === 0}
                  onClick={() => setCurrentPageIdx((p) => p - 1)}
                  className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />{" "}
                  {t("pages.inspection.run.previous")}
                </button>

                {isLastPage ? (
                  !isCompleted ? (
                    <button
                      onClick={handleComplete}
                      disabled={completing}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      {completing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {t("pages.inspection.run.completeInspection")}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                      <CheckCircle2 className="h-4 w-4" />{" "}
                      {t("pages.inspection.run.completed")}
                    </span>
                  )
                ) : (
                  <button
                    onClick={() => setCurrentPageIdx((p) => p + 1)}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t("pages.inspection.run.next")}{" "}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
