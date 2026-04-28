import {
  useDeleteQuestionMutation,
  useUpdateOrCreateQuestionMutation,
} from "@/redux/apis/organization/template.api"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  GripVertical,
  Image,
  MapPinned,
  PenTool,
  Sliders,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, useWatch } from "react-hook-form"
import { toast } from "sonner"

const ANSWER_TYPES = [
  { value: "input", label: "Input", icon: CheckSquare },
  { value: "checkbox", label: "Check Box", icon: CheckSquare },
  { value: "date", label: "Date", icon: Calendar },
  { value: "media", label: "Media", icon: Image },
  { value: "slider", label: "Slider", icon: Sliders },
  { value: "annotation", label: "Annotation", icon: PenTool },
  { value: "signature", label: "Signature", icon: PenTool },
  { value: "location", label: "Location", icon: MapPinned },
  { value: "instruction", label: "Instruction", icon: MapPinned },
] as const

interface SortableQuestionRowProps {
  sortableId: string
  pageIndex: number
  questionIndex: number
  questionId: string
  pageId: string
  templateId: string
  control: any
  register: any
  remove: (index: number) => void
  onOpenAnswerPanel: (pageIndex: number, questionIndex: number) => void
  getValues: any
  isEditMode?: boolean
}

function EditSortableQuestionRow({
  sortableId,
  pageIndex,
  questionIndex,
  questionId,
  pageId,
  templateId,
  control,
  remove,
  onOpenAnswerPanel,
  getValues,
  isEditMode = false,
}: SortableQuestionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId })

  const [updateOrCreateQuestion, { isLoading: isUpdatingQuestion }] =
    useUpdateOrCreateQuestionMutation()
  const [deleteQuestion, { isLoading: isDeletingQuestion }] =
    useDeleteQuestionMutation()

  const [isSyncing, setIsSyncing] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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

  const answerLabel = (() => {
    if (!answerType) return "Select Type"
    const at = answerType.answerType
    if (at === "input") return `Input (${answerType.value ?? "text"})`
    return ANSWER_TYPES.find((t) => t.value === at)?.label ?? at
  })()

  // Auto-sync question changes when in edit mode
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (isEditMode && pageId && questionId && questionText) {
        try {
          setIsSyncing(true)

          await updateOrCreateQuestion({
            index: questionIndex,
            question: questionText,
            isRequired: isRequired,
            answerType: answerType || {
              answerType: "input",
              value: "",
            },
            pageId: pageId,
            questionId: questionId,
          }).unwrap()
        } catch (error) {
          console.error("Error syncing question:", error)
        } finally {
          setIsSyncing(false)
        }
      }
    }, 1000) // Debounce for 1 second

    return () => clearTimeout(timer)
  }, [questionText, isRequired, answerType])

  const handleDeleteQuestion = async () => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      try {
        if (isEditMode && questionId) {
          await deleteQuestion(questionId).unwrap()
          toast.success("Question deleted successfully")
        }
        remove(questionIndex)
      } catch (error) {
        toast.error("Failed to delete question")
        console.error(error)
      }
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative border-b border-border bg-card transition-colors last:border-b-0 hover:bg-muted/50"
    >
      {/* Delete Button */}
      <button
        type="button"
        onClick={handleDeleteQuestion}
        disabled={isDeletingQuestion || isUpdatingQuestion}
        className="absolute top-4 left-2 z-10 rounded-full bg-red-500 p-1 text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-red-600 disabled:opacity-50"
        title="Delete Question"
      >
        <Trash2 size={12} />
      </button>

      {/* Sync Status */}
      {isSyncing && (
        <div className="absolute top-4 left-10 z-10 text-xs text-muted-foreground">
          Syncing...
        </div>
      )}

      <div className="grid grid-cols-12 items-start">
        {/* Question Column */}
        <div className="col-span-8 flex items-start gap-3 border-r border-border px-4 py-4 pl-10">
          {/* Drag Handle */}
          <button
            type="button"
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
                  placeholder="Enter question…"
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
                Required
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
