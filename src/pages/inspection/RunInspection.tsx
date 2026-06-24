import { api, ApiError } from '@/lib/api'
import type { InspectionDetail, PageDef, QuestionAnswer } from '@/types/inspection'
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Sparkles, ListChecks } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { QuestionInput } from './QuestionInput'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function RunInspection() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [inspection, setInspection] = useState<InspectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [completing, setCompleting] = useState(false)
  const [actionCount, setActionCount] = useState<number | null>(null)

  // Local answer cache for optimistic updates — stored in state so render can read it
  const [answerCache, setAnswerCache] = useState<Record<string, QuestionAnswer>>({})

  useEffect(() => {
    if (!id) return

    async function load() {
      setLoading(true)
      try {
        const data = await api.get<InspectionDetail>(`/api/inspection/${id}`)
        setInspection(data)
        const initial: Record<string, QuestionAnswer> = {}
        data.questionAnswers.forEach((qa) => {
          initial[qa.questionId] = qa
        })
        setAnswerCache(initial)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load inspection')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  useEffect(() => {
    if (!id) return
    api
      .get<{ inspectionId: string }[]>('/api/action')
      .then((res) => {
        setActionCount((res ?? []).filter((a) => a.inspectionId === id).length)
      })
      .catch(() => setActionCount(null))
  }, [id])

  const pages: PageDef[] = useMemo(
    () =>
      (inspection?.template?.pages ?? []).slice().sort((a, b) => a.pageIndex - b.pageIndex),
    [inspection],
  )

  const qaByQuestionId = useMemo(() => {
    const map: Record<string, QuestionAnswer> = {}
    inspection?.questionAnswers.forEach((qa) => {
      map[qa.questionId] = qa
    })
    return map
  }, [inspection])

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleAnswerChange = useCallback(
    (qaId: string, answer: unknown) => {
      // optimistically update cache
      setAnswerCache((prev) => {
        const existing = Object.values(prev).find((qa) => qa.id === qaId)
        if (!existing) return prev
        return { ...prev, [existing.questionId]: { ...existing, answer } }
      })

      setSaveState('saving')
      if (saveTimeout.current) clearTimeout(saveTimeout.current)

      saveTimeout.current = setTimeout(() => {
        api
          .put(`/api/inspection/${qaId}`, { answer })
          .then(() => setSaveState('saved'))
          .catch(() => setSaveState('error'))
      }, 600)
    },
    [],
  )

  async function handleComplete() {
    if (!id) return
    setCompleting(true)
    try {
      await api.patch(`/api/inspection/${id}`, { status: 'COMPLETED' })
      navigate('/organization/audit/inspections')
    } catch {
      setCompleting(false)
    }
  }

  const isCompleted = inspection?.status === 'COMPLETED'
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
          {error ?? 'Inspection not found'}
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
            ← Inspections
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">
            {inspection.template?.templateName ?? 'Inspection'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {saveState === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
          {saveState === 'error' && (
            <span className="text-xs text-destructive">Save failed</span>
          )}
          <Link
            to={`/organization/audit/inspections/${id}/note`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FileText className="h-4 w-4" />
            {inspection.note ? 'View notes' : 'Upload notes'}
          </Link>
          <Link
            to={`/organization/audit/inspections/${id}/recommendations`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Sparkles className="h-4 w-4" />
            Recommendations
          </Link>
          <Link
            to={`/organization/audit/inspections/${id}/actions`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ListChecks className="h-4 w-4" />
            Findings
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
              Mark complete
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card p-4 lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Pages
          </p>
          <nav className="flex flex-col gap-1">
            {pages.map((page, idx) => {
              const answered = page.questions.filter(
                (q) => {
                  const qa = qaByQuestionId[q.id] ?? answerCache[q.id]
                  if (!qa) return false
                  const a = qa.answer
                  return a !== null && a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0)
                },
              ).length
              const total = page.questions.length
              const done = total > 0 && answered === total

              return (
                <button
                  key={page.id}
                  onClick={() => setCurrentPageIdx(idx)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    idx === currentPageIdx
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                      done
                        ? 'bg-green-100 text-green-700'
                        : idx === currentPageIdx
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {done ? '✓' : idx + 1}
                  </span>
                  <span className="truncate">{page.title}</span>
                </button>
              )
            })}
          </nav>

          {inspection.site && (
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">Site</p>
              <p className="text-sm font-medium text-foreground">{inspection.site.name}</p>
            </div>
          )}
        </aside>

        {/* Questions */}
        <main className="flex-1 overflow-y-auto p-6">
          {!currentPage ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-muted-foreground">No pages in this template.</p>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="mb-6">
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">{currentPage.title}</h2>
                  <span className="text-xs text-muted-foreground">
                    Page {currentPageIdx + 1} of {pages.length}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${((currentPageIdx + 1) / pages.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question cards */}
              <div className="flex flex-col gap-5">
                {currentPage.questions
                  .slice()
                  .sort((a, b) => a.index - b.index)
                  .map((question) => {
                    const qa = qaByQuestionId[question.id] ?? answerCache[question.id]
                    const mediaFiles = qa?.mediaFiles
                    const files: string[] = Array.isArray(mediaFiles)
                      ? (mediaFiles as unknown[])
                          .map((f) =>
                            typeof f === 'string' ? f : (f as { url?: string })?.url,
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
                            <span className="ml-1 text-destructive" aria-label="required">*</span>
                          )}
                        </p>
                        <QuestionInput
                          question={question}
                          answer={qa}
                          onChange={handleAnswerChange}
                          disabled={isCompleted}
                        />
                        {files.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {files.map((url, i) => {
                              const isImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)
                              return isImage ? (
                                <img
                                  key={i}
                                  src={url}
                                  alt={`Attachment ${i + 1}`}
                                  className="h-20 w-20 rounded-md border border-border object-cover"
                                />
                              ) : (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Attachment {i + 1}
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
                              + Add finding
                            </Link>
                            {actionCount !== null && actionCount > 0 && (
                              <Link
                                to={`/organization/audit/inspections/${id}/actions`}
                                className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              >
                                {actionCount} entered
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
                  <ChevronLeft className="h-4 w-4" /> Previous
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
                      Complete inspection
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> Completed
                    </span>
                  )
                ) : (
                  <button
                    onClick={() => setCurrentPageIdx((p) => p + 1)}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Next <ChevronRight className="h-4 w-4" />
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
