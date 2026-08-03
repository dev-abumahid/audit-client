/* eslint-disable @typescript-eslint/no-explicit-any */
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, GripVertical, Trash2 } from "lucide-react"
import { Controller, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

interface SortableQuestionRowProps {
  sortableId: string
  pageIndex: number
  questionIndex: number
  control: any
  register: any
  remove: (index: number) => void
  onOpenAnswerPanel: (pageIndex: number, questionIndex: number) => void
  getValues: any
}

function SortableQuestionRow({
  sortableId,
  pageIndex,
  questionIndex,
  control,
  remove,
  onOpenAnswerPanel,
}: SortableQuestionRowProps) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const answerType = useWatch({
    control,
    name: `pages.${pageIndex}.questions.${questionIndex}.answerType`,
  })

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative border-b border-border bg-card transition-colors last:border-b-0 hover:bg-muted/50"
    >
      {/* Delete Button */}
      <button
        type="button"
        onClick={() => remove(questionIndex)}
        aria-label={t("organization.templates.builder.deleteQuestion")}
        className="absolute top-4 left-2 z-10 rounded-full bg-red-500 p-1 text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-red-600"
        title={t("organization.templates.builder.deleteQuestion")}
      >
        <Trash2 size={12} />
      </button>

      <div className="grid grid-cols-12 items-start">
        {/* Question Column */}
        <div className="col-span-8 flex items-start gap-3 border-r border-border px-4 py-4 pl-10">
          {/* Drag Handle */}
          <button
            type="button"
            aria-label={t("organization.templates.builder.dragToReorder")}
            className="mt-1.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
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
            className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-4 py-4.5 text-sm text-foreground transition-all hover:bg-muted focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <span className="truncate">{answerLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default SortableQuestionRow
