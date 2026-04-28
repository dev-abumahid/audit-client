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
import { useEffect, useState } from "react"
import { Controller, useFieldArray } from "react-hook-form"
import { toast } from "sonner"
import EditSortableQuestionRow from "./EditSortableQuestionRow"
import { useDeletePageMutation, useUpdateOrCreatePageMutation } from "@/redux/apis/organization/template.api"

interface PageSectionProps {
  pageIndex: number
  pageId: string
  templateId: string
  control: any
  register: any
  removePage: (index: number) => void
  totalPages: number
  onOpenAddModal: (pageIndex: number) => void
  onOpenAnswerPanel: (pageIndex: number, questionIndex: number) => void
  getValues: any
  setValue: any
  isEditMode?: boolean
}

function EditPageSection({
  pageIndex,
  pageId,
  templateId,
  control,
  register,
  removePage,
  totalPages,
  onOpenAddModal,
  onOpenAnswerPanel,
  getValues,
  setValue,
  isEditMode = false,
}: PageSectionProps) {
  const [updateOrCreatePage, { isLoading: isUpdatingPage }] =
    useUpdateOrCreatePageMutation()
  const [deletePage, { isLoading: isDeletingPage }] = useDeletePageMutation()

  const { fields, remove, move } = useFieldArray({
    control,
    name: `pages.${pageIndex}.questions`,
  })

  const [isSyncing, setIsSyncing] = useState(false)

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
      // Mark as dirty for form submission
      setValue(
        `pages.${pageIndex}.questions`,
        getValues(`pages.${pageIndex}.questions`),
        {
          shouldDirty: true,
        }
      )
    }
  }

  // Auto-sync page changes when title is updated
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (isEditMode && pageId && templateId) {
        try {
          setIsSyncing(true)
          const title = getValues(`pages.${pageIndex}.title`)

          await updateOrCreatePage({
            pageId: pageId,
            pageIndex: pageIndex,
            title: title,
            templateId: templateId,
          }).unwrap()
        } catch (error) {
          console.error("Error syncing page:", error)
        } finally {
          setIsSyncing(false)
        }
      }
    }, 1000) // Debounce for 1 second

    return () => clearTimeout(timer)
  }, [getValues(`pages.${pageIndex}.title`)])

  const handleDeletePage = async () => {
    if (window.confirm("Are you sure you want to delete this section?")) {
      try {
        if (pageId) {
          await deletePage(pageId).unwrap()
          toast.success("Section deleted successfully")
        }
        removePage(pageIndex)
      } catch (error) {
        toast.error("Failed to delete section")
        console.error(error)
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
          title="Delete Section"
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Sync Status */}
      {isSyncing && (
        <div className="absolute top-3 right-3 z-10 text-xs text-muted-foreground">
          Syncing...
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
              placeholder="Section Title"
            />
          )}
        />
        <p className="mt-1 pl-5 text-sm text-muted-foreground">
          Section {pageIndex + 1} of your inspection report.
        </p>
      </div>

      {/* Questions Container */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
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
                <EditSortableQuestionRow
                  key={field.id}
                  sortableId={field.id}
                  pageIndex={pageIndex}
                  questionIndex={qIndex}
                  questionId={field.id}
                  pageId={pageId}
                  templateId={templateId}
                  control={control}
                  register={register}
                  remove={remove}
                  onOpenAnswerPanel={onOpenAnswerPanel}
                  getValues={getValues}
                  isEditMode={isEditMode}
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
            Add New Question
          </Button>
        </div>
      </div>
    </div>
  )
}

export default EditPageSection
