/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button"
import {
  useDeletePageMutation,
  useUpdateOrCreatePageMutation,
  useUpdateOrCreateQuestionMutation,
} from "@/redux/apis/organization/template.api"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { debounce } from "lodash"
import { Plus, Trash2 } from "lucide-react"
import { memo, useCallback, useEffect, useRef, useState } from "react"
import { Controller, useFieldArray, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import EditSortableQuestionRow from "./EditSortableQuestionRow"

interface PageSectionProps {
  pageIndex: number
  pageId: string
  templateId: string
  control: any
  removePage: (index: number) => void
  totalPages: number
  onOpenAddModal: (pageIndex: number) => void
  onOpenAnswerPanel: (pageIndex: number, questionIndex: number) => void
  getValues: any
  setValue: any
  isEditMode?: boolean
  // Round 13 (#507) -- currently-open answer panel's {pageIndex,
  // questionIndex}, or null. Passed down so each row can tell whether the
  // panel it opens is the one currently open. Optional (defaults to null)
  // so existing direct-render tests that don't care about this a11y detail
  // don't need updating.
  answerPanel?: { pageIndex: number; questionIndex: number } | null
}

const EditPageSection = memo(
  ({
    pageIndex,
    pageId,
    templateId,
    control,
    removePage,
    totalPages,
    onOpenAddModal,
    onOpenAnswerPanel,
    getValues,
    setValue,
    isEditMode = false,
    answerPanel = null,
  }: PageSectionProps) => {
    const { t } = useTranslation()
    const [updateOrCreatePage, { isLoading: isUpdatingPage }] =
      useUpdateOrCreatePageMutation()
    const [deletePage, { isLoading: isDeletingPage }] = useDeletePageMutation()
    const [updateOrCreateQuestion] = useUpdateOrCreateQuestionMutation()

    const { fields, remove, move } = useFieldArray({
      control,
      name: `pages.${pageIndex}.questions`,
      keyName: "fieldId",
    })

    const [isSyncing, setIsSyncing] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    // Issue #129 scope decision: this tracks, per question id, whether its
    // most recent reorder-sync attempt failed — surfaced to
    // EditSortableQuestionRow as a persistent visual indicator (mirroring
    // the page-title `isSyncing` pattern above) instead of the prior
    // behavior where a failed reorder sync was only visible as a toast that
    // could be missed, after which the client-rendered order could stay
    // silently wrong indefinitely. It clears for a question once that
    // question's *next* reorder-sync attempt succeeds (the existing
    // per-item retry-on-next-drag behavior below already re-attempts failed
    // questions; this just observes those same results rather than adding
    // new retry machinery). Full reconciliation against server truth on
    // remount/refetch (the issue's suggested part (b)) is deliberately not
    // built here — it would mean restructuring how this component sources
    // its data (it currently trusts the form's client state as truth and
    // has no independent "refetch the page's questions" path), which is
    // disproportionate to this bugfix-adjacent issue. Flagging as a
    // follow-up instead.
    const [syncFailedIds, setSyncFailedIds] = useState<Set<string>>(
      () => new Set()
    )
    // Prune ids for questions that no longer exist (deleted, or never had a
    // real id) so a deleted question's stale "failed" flag doesn't linger
    // in memory or attach to whatever new question happens to reuse the
    // slot.
    useEffect(() => {
      setSyncFailedIds((prev) => {
        if (prev.size === 0) return prev
        const currentIds = new Set(
          fields.map((f) => (f as any).id).filter(Boolean)
        )
        let changed = false
        const next = new Set<string>()
        prev.forEach((id) => {
          if (currentIds.has(id)) next.add(id)
          else changed = true
        })
        return changed ? next : prev
      })
    }, [fields])

    // Track whether this component instance is still mounted, and a
    // monotonic generation counter for debouncedSyncOrder invocations (see
    // the detailed comment on debouncedSyncOrder below for why both exist).
    const isMountedRef = useRef(true)
    useEffect(() => {
      isMountedRef.current = true
      return () => {
        isMountedRef.current = false
      }
    }, [])
    const syncGenerationRef = useRef(0)

    // Pre-existing bug found during live verification of this fix (not
    // introduced by it, but it made the reorder-sync — and therefore this
    // issue's whole "sync failed" indicator — unreachable in practice, so
    // fixing it is necessary for issue #129's fix to actually do anything):
    // `debouncedSyncOrder` used to read the `isDragging` *state* value
    // directly in its guard below. Because `debouncedSyncOrder` is
    // recreated by useCallback whenever `isDragging` changes, the specific
    // debounced-function instance that `handleDragEnd` invokes is always
    // the one created while `isDragging === true` (set by `onDragStart`
    // before the drop), and that instance's closure has `isDragging`
    // permanently frozen at `true` — so its guard `... || isDragging`
    // always short-circuited and the sync silently never ran, even after
    // `setIsDragging(false)` fired a re-render with a fresh instance nobody
    // called. Reading dragging state through a ref instead makes the guard
    // check the *current* value at execution time rather than a value
    // frozen at schedule time.
    const isDraggingRef = useRef(false)
    useEffect(() => {
      isDraggingRef.current = isDragging
    }, [isDragging])

    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 8,
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    )

    const pageTitle = useWatch({
      control,
      name: `pages.${pageIndex}.title`,
    })

    // Issue #363: initialized with the CURRENT (mounted) title rather than
    // null, so the first "sync page title" effect below correctly detects
    // "unchanged since mount" and skips firing a PATCH for every existing
    // page the moment the template editor loads. Previously this started as
    // `useRef(null)`, which never equals any real title, so the very first
    // debounced sync always fired even for pre-existing, untouched pages.
    const lastSyncedTitle = useRef<string | null>(pageTitle ?? null)

    // Debounced order sync
    //
    // Error-handling granularity: each question's .unwrap() gets its own
    // try/catch inside the .map() callback, rather than one try/catch around
    // the whole Promise.all. By the time this fires, the drag has already
    // reordered `fields` locally (via `move()` in handleDragEnd) and every
    // request in this batch is already in flight independently on the
    // server — Promise.all rejecting on the first failure wouldn't stop the
    // others from completing, it would just mean we stop *listening* to
    // them, so we'd lose track of which ones actually succeeded. Catching
    // per-item lets every request settle and be accounted for individually:
    // we only advance the locally-tracked `index` field (used to detect
    // "does this question need syncing" on the next pass) for the ones that
    // actually saved, so a failed item naturally gets retried on the next
    // reorder instead of being silently treated as synced. One failure also
    // shouldn't roll back the whole batch's local drag order (that would
    // fight the user's own drag gesture for items that saved fine), but it
    // also shouldn't be invisible — the toast reports how many of the batch
    // failed so the user knows to re-check the order before leaving the page.
    const debouncedSyncOrder = useCallback(
      debounce(async () => {
        if (!isEditMode || !templateId || !pageId || isDraggingRef.current)
          return

        // Race-condition guard (issue #129 part 2b): lodash's debounce only
        // cancels a *pending, not-yet-fired* timer. If this invocation's
        // async body is already running (awaiting the Promise.all below)
        // when a second drag calls debouncedSyncOrder() again, the second
        // call doesn't cancel this one — it schedules its own separate
        // invocation on top of it. Two overlapping invocations racing to
        // call setValue from their own (possibly stale-by-then) snapshot of
        // `questions` could corrupt the locally-tracked `index`
        // bookkeeping. A full concurrency-guard (queueing/merging results
        // across overlapping batches) is more machinery than a debounced
        // client-side reorder sync warrants, so instead: tag each
        // invocation with a monotonically increasing generation, and if a
        // newer invocation has started by the time this one's Promise.all
        // resolves, drop this one's writes entirely rather than merge them.
        // This is safe — not lossy — because a question whose successful
        // sync we drop here just looks "still unsynced" locally and gets
        // retried (one extra, idempotent updateOrCreateQuestion call) by
        // whichever invocation runs next, same as the existing
        // failed-item retry path below.
        const myGeneration = ++syncGenerationRef.current

        const questions = getValues(`pages.${pageIndex}.questions`)
        const results = await Promise.all(
          questions.map(async (q: any, idx: number) => {
            if (!q.id || q.index === idx) return { ok: true, attempted: false }
            try {
              await updateOrCreateQuestion({
                questionId: q.id,
                pageId,
                index: idx,
                question: q.question,
                isRequired: q.isRequired,
                answerType: q.answerType,
              }).unwrap()
              return { ok: true, attempted: true }
            } catch (error: any) {
              return { ok: false, attempted: true, message: error?.data?.message }
            }
          })
        )

        if (!isMountedRef.current) return
        if (syncGenerationRef.current !== myGeneration) return

        // Update local indices only for the questions that synced
        // successfully; leave failed ones' stale index so the next
        // debounced pass retries just those instead of assuming they're
        // already up to date.
        questions.forEach((q: any, idx: number) => {
          if (q.index !== idx && results[idx]?.ok) {
            setValue(`pages.${pageIndex}.questions.${idx}.index`, idx, {
              shouldDirty: false,
              shouldValidate: false,
            })
          }
        })

        // Per-question "sync failed" tracking, surfaced by
        // EditSortableQuestionRow as a persistent indicator. Only
        // `attempted` entries (questions this pass actually tried to sync)
        // affect the set — a question skipped because it didn't need
        // reindexing this pass shouldn't have its prior failed flag
        // touched either way.
        setSyncFailedIds((prev) => {
          let changed = false
          const next = new Set(prev)
          questions.forEach((q: any, idx: number) => {
            if (!results[idx]?.attempted || !q.id) return
            if (results[idx].ok) {
              if (next.delete(q.id)) changed = true
            } else if (!next.has(q.id)) {
              next.add(q.id)
              changed = true
            }
          })
          return changed ? next : prev
        })

        const failedCount = results.filter((r) => !r.ok).length
        if (failedCount > 0) {
          toast.error(
            t("organization.templates.builder.reorderFailed", {
              count: failedCount,
            })
          )
        }
      }, 500),
      [
        isEditMode,
        templateId,
        pageId,
        pageIndex,
        getValues,
        setValue,
        updateOrCreateQuestion,
        t,
      ]
    )

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) {
        setIsDragging(false)
        return
      }

      const oldIdx = fields.findIndex((f) => f.fieldId === active.id)
      const newIdx = fields.findIndex((f) => f.fieldId === over.id)

      if (oldIdx !== -1 && newIdx !== -1) {
        move(oldIdx, newIdx)
        debouncedSyncOrder()
      }

      setIsDragging(false)
    }

    // Sync page title
    useEffect(() => {
      if (!isEditMode || !templateId || !pageTitle) return
      if (isDragging) return
      if (pageTitle === lastSyncedTitle.current) return

      const isValidUUID =
        typeof pageId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          pageId
        )

      const timer = setTimeout(async () => {
        try {
          setIsSyncing(true)

          await updateOrCreatePage({
            ...(isValidUUID ? { pageId } : {}),
            pageIndex,
            title: pageTitle,
            templateId,
          }).unwrap()

          lastSyncedTitle.current = pageTitle
        } catch (error: any) {
          toast.error(error?.message || t("organization.templates.builder.syncPageError"))
        } finally {
          setIsSyncing(false)
        }
      }, 1000)

      return () => clearTimeout(timer)
    }, [
      pageTitle,
      isDragging,
      isEditMode,
      templateId,
      pageId,
      pageIndex,
      updateOrCreatePage,
      t,
    ])

    const handleDeletePage = async () => {
      if (window.confirm(t("organization.templates.builder.confirmDeleteSection"))) {
        try {
          if (pageId) {
            await deletePage(pageId).unwrap()
            toast.success(t("organization.templates.builder.sectionDeleted"))
          }
          removePage(pageIndex)
        } catch (error: any) {
          toast.error(error?.message || t("organization.templates.builder.deleteSectionFailed"))
        }
      }
    }

    return (
      <div className="relative mb-8 rounded-2xl border border-border bg-card p-5">
        {/* Delete Section Button */}
        {totalPages > 1 && (
          <button
            type="button"
            onClick={handleDeletePage}
            disabled={isDeletingPage || isUpdatingPage}
            className="absolute -top-3 -right-3 z-10 rounded-full bg-red-500 p-1.5 text-white shadow-md transition-colors hover:bg-red-600 disabled:opacity-50"
            title={t("organization.templates.builder.deleteSection")}
          >
            <Trash2 size={14} />
          </button>
        )}

        {/* Sync Status */}
        {isSyncing && !isDragging && (
          <div className="absolute top-3 right-3 z-10 text-xs text-muted-foreground">
            {t("organization.templates.builder.syncing")}
          </div>
        )}

        {/* Section Title */}
        <div className="mb-4">
          <Controller
            control={control}
            name={`pages.${pageIndex}.title`}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                className="w-full rounded-xl border border-border bg-card px-5 py-4 text-xl font-semibold text-foreground focus:border-transparent focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder={t("organization.templates.builder.sectionTitlePlaceholder")}
              />
            )}
          />
          <p className="mt-1 pl-5 text-sm text-muted-foreground">
            {t("organization.templates.builder.sectionSubtitle", {
              number: pageIndex + 1,
            })}
          </p>
        </div>

        {/* Questions Container */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Table Header */}
          <div className="grid grid-cols-12 border-b border-border bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">
            <div className="col-span-8">{t("organization.templates.builder.questionHeader")}</div>
            <div className="col-span-4">{t("organization.templates.builder.typeHeader")}</div>
          </div>

          {/* Sortable Questions */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            onDragStart={() => setIsDragging(true)}
          >
            <SortableContext
              items={fields.map((f) => f.fieldId)}
              strategy={verticalListSortingStrategy}
            >
              {fields.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {t("organization.templates.builder.noQuestions")}
                </div>
              ) : (
                fields.map((field, qIndex) => (
                  <EditSortableQuestionRow
                    key={field.fieldId}
                    sortableId={field.fieldId}
                    pageIndex={pageIndex}
                    questionIndex={qIndex}
                    questionId={(field as any).id}
                    pageId={pageId}
                    control={control}
                    remove={remove}
                    onOpenAnswerPanel={onOpenAnswerPanel}
                    isEditMode={isEditMode}
                    isDraggingGlobal={isDragging}
                    orderSyncFailed={syncFailedIds.has((field as any).id)}
                    isAnswerPanelOpen={
                      answerPanel?.pageIndex === pageIndex &&
                      answerPanel?.questionIndex === qIndex
                    }
                  />
                ))
              )}
            </SortableContext>
          </DndContext>

          {/* Add New Question Button */}
          <div className="flex justify-end border-t border-border px-4 py-4">
            <Button
              size="lg"
              type="button"
              onClick={() => onOpenAddModal(pageIndex)}
            >
              <Plus className="h-4 w-4" />
              {t("organization.templates.builder.addNewQuestion")}
            </Button>
          </div>
        </div>
      </div>
    )
  }
)

EditPageSection.displayName = "EditPageSection"

export default EditPageSection
