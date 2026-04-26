/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button"
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
import { Plus, Trash2 } from "lucide-react"
import { Controller, useFieldArray } from "react-hook-form"
import SortableQuestionRow from "./SortableQuestionRow"

interface PageSectionProps {
  pageIndex: number
  control: any
  register: any
  removePage: (index: number) => void
  totalPages: number
  onOpenAddModal: (pageIndex: number) => void
  onOpenAnswerPanel: (pageIndex: number, questionIndex: number) => void
  getValues: any
  setValue: any
}

function PageSection({
  pageIndex,
  control,
  register,
  removePage,
  totalPages,
  onOpenAddModal,
  onOpenAnswerPanel,
  getValues,
}: PageSectionProps) {
  const { fields, remove, move } = useFieldArray({
    control,
    name: `pages.${pageIndex}.questions`,
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = fields.findIndex((f) => f.id === active.id)
    const newIdx = fields.findIndex((f) => f.id === over.id)

    if (oldIdx !== -1 && newIdx !== -1) {
      move(oldIdx, newIdx)
    }
  }

  return (
    <div className="relative mb-8 border border-border bg-card p-5 rounded-2xl">
      {/* Delete Section Button */}
      {totalPages > 1 && (
        <button
          type="button"
          onClick={() => removePage(pageIndex)}
          className="absolute -top-3 -right-3 z-10 rounded-full bg-red-500 p-1.5 text-white shadow-md transition-colors hover:bg-red-600"
          title="Delete Section"
        >
          <Trash2 size={14} />
        </button>
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
              placeholder="Section Title"
            />
          )}
        />
        <p className="mt-1 pl-5 text-sm text-muted-foreground">
          Section {pageIndex + 1} of your inspection report.
        </p>
      </div>

      {/* Questions Container */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card ">
        {/* Table Header */}
        <div className="grid grid-cols-12 border-b border-border bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">
          <div className="col-span-8">Question</div>
          <div className="col-span-4">Type of Question</div>
        </div>

        {/* Sortable Questions */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {fields.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No questions yet. Click "Add New" below to get started.
              </div>
            ) : (
              fields.map((field, qIndex) => (
                <SortableQuestionRow
                  key={field.id}
                  sortableId={field.id}
                  pageIndex={pageIndex}
                  questionIndex={qIndex}
                  control={control}
                  register={register}
                  remove={remove}
                  onOpenAnswerPanel={onOpenAnswerPanel}
                  getValues={getValues}
                />
              ))
            )}
          </SortableContext>
        </DndContext>

        {/* Add New Question Button */}
        <div className="flex justify-end border-t border-border  px-4 py-4">
          <Button size="lg" type="button" onClick={() => onOpenAddModal(pageIndex)}>
            <Plus className="h-4 w-4" />
            Add New Question
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PageSection
