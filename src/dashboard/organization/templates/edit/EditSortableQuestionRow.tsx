/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  useDeleteQuestionMutation,
  useUpdateOrCreateQuestionMutation,
} from "@/redux/apis/organization/template.api"
import { isValidUUID } from "@/utils/validUUID"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, GripVertical, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Controller, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

// Shared with the initial-ref computation below so the "did this actually
// change since mount/last sync" check is always the exact same comparison.
function makeQuestionSyncKey(
  text: string,
  required: boolean,
  type: any
): string {
  return `${text}-${required}-${JSON.stringify(type)}`
}

interface SortableQuestionRowProps {
  sortableId: string
  pageIndex: number
  questionIndex: number
  questionId: string
  pageId: string
  control: any
  remove: (index: number) => void
  onOpenAnswerPanel: (pageIndex: number, questionIndex: number) => void
  isEditMode?: boolean
  isDraggingGlobal?: boolean
  // Issue #129: true when this question's most recent drag-reorder sync
  // (owned by the parent's debouncedSyncOrder, not this component's own
  // text/type sync below) failed and hasn't succeeded since. Persists
  // across renders until the parent's next reorder-sync pass retries this
  // question and it succeeds, unlike the transient toast that reported the
  // failure — that toast is easy to miss, and without a persistent
  // indicator the client-rendered order could silently disagree with the
  // server indefinitely.
  orderSyncFailed?: boolean
}

function EditSortableQuestionRow({
  sortableId,
  pageIndex,
  questionIndex,
  questionId,
  pageId,
  control,
  remove,
  onOpenAnswerPanel,
  isEditMode = false,
  isDraggingGlobal = false,
  orderSyncFailed = false,
}: SortableQuestionRowProps) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: sortableId })

  const [updateOrCreateQuestion, { isLoading: isUpdatingQuestion }] =
    useUpdateOrCreateQuestionMutation()
  const [deleteQuestion, { isLoading: isDeletingQuestion }] =
    useDeleteQuestionMutation()

  const [isSyncing, setIsSyncing] = useState(false)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging || isDraggingGlobal ? 0.5 : 1,
  }

  const answerType = useWatch({
    control,
    name: `pages.${pageIndex}.questions.${questionIndex}.answerType`,
  })

  const questionText = useWatch({
    control,
    name: `pages.${pageIndex}.questions.${questionIndex}.question`,
  })

  const isRequired = useWatch({
    control,
    name: `pages.${pageIndex}.questions.${questionIndex}.isRequired`,
  })

  // Issue #363: initialized with the CURRENT (mounted) value rather than
  // null, so the first sync-key comparison in syncQuestion correctly
  // detects "unchanged since mount" and skips firing a PATCH for every
  // pre-existing question the moment the template editor loads. Previously
  // this started as `useRef(null)`, which never equals any real syncKey, so
  // the very first debounced/immediate sync effect always fired for
  // existing data too.
  const lastSyncedValueRef = useRef<string | null>(
    makeQuestionSyncKey(questionText, isRequired, answerType)
  )

  const answerLabel = (() => {
    if (!answerType) return t("organization.templates.builder.selectType")
    const at = answerType.answerType
    if (at === "input")
      return t("organization.templates.builder.inputWithValue", {
        value: answerType.value ?? "text",
      })
    return t(`organization.templates.builder.answerTypes.${at}`, {
      defaultValue: at,
    })
  })()

  const isDragging = isSortableDragging || isDraggingGlobal
  const shouldSync = !isDragging && isEditMode && pageId

  const syncQuestion = async (text: string, required: boolean, type: any) => {
    if (!shouldSync) return
    if (!text || text.trim() === "") return

    const syncKey = makeQuestionSyncKey(text, required, type)
    if (syncKey === lastSyncedValueRef.current) return

    try {
      setIsSyncing(true)
      const payload: any = {
        index: questionIndex,
        question: text,
        isRequired: required,
        answerType: type || { answerType: "input", value: "" },
      }

      if (pageId) payload.pageId = pageId

      if (questionId && isValidUUID(questionId)) {
        payload.questionId = questionId
      }
      await updateOrCreateQuestion(payload).unwrap()

      lastSyncedValueRef.current = syncKey
    } catch (error:any) {
      toast.error(error?.message || t("organization.templates.builder.syncQuestionError"))
    } finally {
      setIsSyncing(false)
    }
  }

  // Sync on question text change with debounce
  useEffect(() => {
    if (!shouldSync) return

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    syncTimeoutRef.current = setTimeout(() => {
      syncQuestion(questionText, isRequired, answerType)
    }, 800)

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [questionText, shouldSync])

  // Sync on required change (immediate)
  useEffect(() => {
    if (!shouldSync) return
    syncQuestion(questionText, isRequired, answerType)
  }, [isRequired])

  // Sync on answer type change
  useEffect(() => {
    if (!shouldSync) return
    syncQuestion(questionText, isRequired, answerType)
  }, [answerType])

  const handleDeleteQuestion = async () => {
    if (window.confirm(t("organization.templates.builder.confirmDeleteQuestion"))) {
      try {
        if (isEditMode && questionId) {
          await deleteQuestion(questionId).unwrap()
          toast.success(t("organization.templates.builder.questionDeleted"))
        }
        remove(questionIndex)
      } catch (error:any) {
        toast.error(error?.message || t("organization.templates.builder.deleteQuestionFailed"))
      }
    }
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative border-b border-border bg-card transition-colors last:border-b-0 hover:bg-muted/50 ${
        isDragging ? "cursor-grabbing" : ""
      }`}
    >
      {/* Delete Button */}
      <button
        type="button"
        onClick={handleDeleteQuestion}
        disabled={isDeletingQuestion || isUpdatingQuestion}
        aria-label={t("organization.templates.builder.deleteQuestion")}
        className="absolute top-4 left-2 z-10 rounded-full bg-red-500 p-1 text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-red-600 disabled:opacity-50"
        title={t("organization.templates.builder.deleteQuestion")}
      >
        <Trash2 size={12} />
      </button>

      {/* Sync Status */}
      {!isDragging && isSyncing && (
        <div className="absolute top-4 left-10 z-10 text-xs text-muted-foreground">
          {t("organization.templates.builder.saving")}
        </div>
      )}
      {!isDragging && !isSyncing && orderSyncFailed && (
        <div
          className="absolute top-4 left-10 z-10 text-xs text-destructive"
          title={t("organization.templates.builder.orderNotSavedTooltip")}
        >
          {t("organization.templates.builder.orderNotSaved")}
        </div>
      )}

      <div className="grid grid-cols-12 items-start">
        {/* Question Column */}
        <div className="col-span-8 flex items-start gap-3 border-r border-border px-4 py-4 pl-10">
          {/* Drag Handle */}
          <button
            type="button"
            aria-label={t("organization.templates.builder.dragToReorder")}
            className="mt-1.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:opacity-50"
            disabled={isDragging}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <Controller
              control={control}
              name={`pages.${pageIndex}.questions.${questionIndex}.question`}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={2}
                  placeholder={t("organization.templates.builder.enterQuestion")}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              )}
            />

            {/* Required Checkbox */}
            <div className="mt-2 flex items-center gap-2">
              <Controller
                control={control}
                name={`pages.${pageIndex}.questions.${questionIndex}.isRequired`}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    id={`req-${sortableId}`}
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-green-600 focus:ring-green-500"
                  />
                )}
              />
              <label
                htmlFor={`req-${sortableId}`}
                className="cursor-pointer text-xs text-muted-foreground select-none"
              >
                {t("organization.templates.builder.required")}
              </label>
            </div>
          </div>
        </div>

        {/* Answer Type Column */}
        <div className="col-span-4 flex items-center px-4 py-4">
          <button
            type="button"
            onClick={() => onOpenAnswerPanel(pageIndex, questionIndex)}
            className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-4 py-4.5 text-sm text-foreground transition-all hover:bg-muted focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
            disabled={isUpdatingQuestion || isDeletingQuestion}
          >
            <span className="truncate">{answerLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditSortableQuestionRow
