// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { Button } from "@/components/ui/button"
// import {
//   useDeletePageMutation,
//   useUpdateOrCreatePageMutation,
// } from "@/redux/apis/organization/template.api"
// import {
//   closestCenter,
//   DndContext,
//   KeyboardSensor,
//   PointerSensor,
//   useSensor,
//   useSensors,
//   type DragEndEvent,
// } from "@dnd-kit/core"
// import {
//   SortableContext,
//   sortableKeyboardCoordinates,
//   verticalListSortingStrategy,
// } from "@dnd-kit/sortable"
// import { Plus, Trash2 } from "lucide-react"
// import { useEffect, useState } from "react"
// import { Controller, useFieldArray, useWatch } from "react-hook-form"
// import { toast } from "sonner"
// import EditSortableQuestionRow from "./EditSortableQuestionRow"

// interface PageSectionProps {
//   pageIndex: number
//   pageId: string
//   templateId: string
//   control: any
//   register: any
//   removePage: (index: number) => void
//   totalPages: number
//   onOpenAddModal: (pageIndex: number) => void
//   onOpenAnswerPanel: (pageIndex: number, questionIndex: number) => void
//   getValues: any
//   setValue: any
//   isEditMode?: boolean
// }

// function EditPageSection({
//   pageIndex,
//   pageId,
//   templateId,
//   control,
//   register,
//   removePage,
//   totalPages,
//   onOpenAddModal,
//   onOpenAnswerPanel,
//   getValues,
//   setValue,
//   isEditMode = false,
// }: PageSectionProps) {
//   const [updateOrCreatePage, { isLoading: isUpdatingPage }] =
//     useUpdateOrCreatePageMutation()
//   const [deletePage, { isLoading: isDeletingPage }] = useDeletePageMutation()

//   const { fields, remove, move } = useFieldArray({
//     control,
//     name: `pages.${pageIndex}.questions`,
//     keyName: "fieldId",
//   })

//   const [isSyncing, setIsSyncing] = useState(false)

//   const sensors = useSensors(
//     useSensor(PointerSensor),
//     useSensor(KeyboardSensor, {
//       coordinateGetter: sortableKeyboardCoordinates,
//     })
//   )

//   const handleDragEnd = (event: DragEndEvent) => {
//     const { active, over } = event
//     if (!over || active.id === over.id) return

//     const oldIdx = fields.findIndex((f) => f.fieldId === active.id)
//     const newIdx = fields.findIndex((f) => f.fieldId === over.id)

//     if (oldIdx !== -1 && newIdx !== -1) {
//       move(oldIdx, newIdx)
//       // Mark as dirty for form submission
//       setValue(
//         `pages.${pageIndex}.questions`,
//         getValues(`pages.${pageIndex}.questions`),
//         {
//           shouldDirty: true,
//         }
//       )
//     }
//   }

//   const pageTitle = useWatch({
//     control,
//     name: `pages.${pageIndex}.title`,
//   })

//   useEffect(() => {
//     if (!isEditMode || !templateId || !pageTitle) return

//     // UUID validation
//     const isValidUUID =
//       typeof pageId === "string" &&
//       /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
//         pageId
//       )

//     const timer = setTimeout(async () => {
//       try {
//         setIsSyncing(true)

//         await updateOrCreatePage({
//           // only send pageId if valid UUID
//           ...(isValidUUID ? { pageId } : {}),

//           pageIndex,
//           title: pageTitle,
//           templateId,
//         }).unwrap()
//       } catch (error) {
//         console.error("Error syncing page:", error)
//       } finally {
//         setIsSyncing(false)
//       }
//     }, 1000)

//     return () => clearTimeout(timer)
//   }, [pageTitle])

//   const handleDeletePage = async () => {
//     if (window.confirm("Are you sure you want to delete this section?")) {
//       try {
//         if (pageId) {
//           await deletePage(pageId).unwrap()
//           toast.success("Section deleted successfully")
//         }
//         removePage(pageIndex)
//       } catch (error) {
//         toast.error("Failed to delete section")
//         console.error(error)
//       }
//     }
//   }

//   return (
//     <div className="relative mb-8 rounded-2xl border border-border bg-card p-5">
//       {/* Delete Section Button */}
//       {totalPages > 1 && (
//         <button
//           type="button"
//           onClick={handleDeletePage}
//           disabled={isDeletingPage || isUpdatingPage}
//           className="absolute -top-3 -right-3 z-10 rounded-full bg-red-500 p-1.5 text-white shadow-md transition-colors hover:bg-red-600 disabled:opacity-50"
//           title="Delete Section"
//         >
//           <Trash2 size={14} />
//         </button>
//       )}

//       {/* Sync Status */}
//       {isSyncing && (
//         <div className="absolute top-3 right-3 z-10 text-xs text-muted-foreground">
//           Syncing...
//         </div>
//       )}

//       {/* Section Title */}
//       <div className="mb-4">
//         <Controller
//           control={control}
//           name={`pages.${pageIndex}.title`}
//           render={({ field }) => (
//             <input
//               {...field}
//               type="text"
//               className="w-full rounded-xl border border-border bg-card px-5 py-4 text-xl font-semibold text-foreground focus:border-transparent focus:ring-2 focus:ring-primary focus:outline-none"
//               placeholder="Section Title"
//             />
//           )}
//         />
//         <p className="mt-1 pl-5 text-sm text-muted-foreground">
//           Section {pageIndex + 1} of your inspection report.
//         </p>
//       </div>

//       {/* Questions Container */}
//       <div className="overflow-hidden rounded-2xl border border-border bg-card">
//         {/* Table Header */}
//         <div className="grid grid-cols-12 border-b border-border bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">
//           <div className="col-span-8">Question</div>
//           <div className="col-span-4">Type of Question</div>
//         </div>

//         {/* Sortable Questions */}
//         <DndContext
//           sensors={sensors}
//           collisionDetection={closestCenter}
//           onDragEnd={handleDragEnd}
//         >
//           <SortableContext
//             items={fields.map((f) => f.fieldId)}
//             strategy={verticalListSortingStrategy}
//           >
//             {fields.length === 0 ? (
//               <div className="px-6 py-12 text-center text-sm text-muted-foreground">
//                 No questions yet. Click "Add New" below to get started.
//               </div>
//             ) : (
//               fields.map((field, qIndex) => (
//                 <EditSortableQuestionRow
//                   key={field.fieldId}
//                   sortableId={field.fieldId}
//                   pageIndex={pageIndex}
//                   questionIndex={qIndex}
//                   questionId={(field as any).id}
//                   pageId={pageId}
//                   templateId={templateId}
//                   control={control}
//                   register={register}
//                   remove={remove}
//                   onOpenAnswerPanel={onOpenAnswerPanel}
//                   getValues={getValues}
//                   isEditMode={isEditMode}
//                 />
//               ))
//             )}
//           </SortableContext>
//         </DndContext>

//         {/* Add New Question Button */}
//         <div className="flex justify-end border-t border-border px-4 py-4">
//           <Button
//             size="lg"
//             type="button"
//             onClick={() => onOpenAddModal(pageIndex)}
//           >
//             <Plus className="h-4 w-4" />
//             Add New Question
//           </Button>
//         </div>
//       </div>
//     </div>
//   )
// }

// export default EditPageSection

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
import { toast } from "sonner"
import EditSortableQuestionRow from "./EditSortableQuestionRow"

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

const EditPageSection = memo(
  ({
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
  }: PageSectionProps) => {
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
    const lastSyncedTitle = useRef<string | null>(null)

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

    // Debounced order sync
    const debouncedSyncOrder = useCallback(
      debounce(async () => {
        if (!isEditMode || !templateId || !pageId || isDragging) return

        const questions = getValues(`pages.${pageIndex}.questions`)
        const updatePromises = questions.map((q: any, idx: number) => {
          if (q.id && q.index !== idx) {
            return updateOrCreateQuestion({
              questionId: q.id,
              pageId,
              index: idx,
              question: q.question,
              isRequired: q.isRequired,
              answerType: q.answerType,
            }).unwrap()
          }
          return Promise.resolve()
        })

        await Promise.all(updatePromises)

        // Update local indices
        questions.forEach((q: any, idx: number) => {
          if (q.index !== idx) {
            setValue(`pages.${pageIndex}.questions.${idx}.index`, idx, {
              shouldDirty: false,
              shouldValidate: false,
            })
          }
        })
      }, 500),
      [
        isEditMode,
        templateId,
        pageId,
        pageIndex,
        getValues,
        setValue,
        isDragging,
        updateOrCreateQuestion,
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
        } catch (error) {
          console.error("Error syncing page:", error)
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
    ])

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
        {isSyncing && !isDragging && (
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
            onDragStart={() => setIsDragging(true)}
          >
            <SortableContext
              items={fields.map((f) => f.fieldId)}
              strategy={verticalListSortingStrategy}
            >
              {fields.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No questions yet. Click "Add New" below to get started.
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
                    templateId={templateId}
                    control={control}
                    register={register}
                    remove={remove}
                    onOpenAnswerPanel={onOpenAnswerPanel}
                    getValues={getValues}
                    setValue={setValue}
                    isEditMode={isEditMode}
                    isDraggingGlobal={isDragging}
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
)

EditPageSection.displayName = "EditPageSection"

export default EditPageSection
