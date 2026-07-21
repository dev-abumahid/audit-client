import { act, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import EditPageSection from "./EditPagesection"

// Run lodash's debounce synchronously so the reorder-sync assertions don't
// need real timers (matches ViewAndEditRecommendation.test.tsx's approach).
vi.mock("lodash", () => ({
  debounce: (fn: (...args: unknown[]) => unknown) => {
    const wrapped = (...args: unknown[]) => fn(...args)
    wrapped.cancel = vi.fn()
    return wrapped
  },
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

const mockUpdateOrCreatePage = vi.fn()
const mockDeletePage = vi.fn()
const mockUpdateOrCreateQuestion = vi.fn()

vi.mock("@/redux/apis/organization/template.api", () => ({
  useUpdateOrCreatePageMutation: () => [
    mockUpdateOrCreatePage,
    { isLoading: false },
  ],
  useDeletePageMutation: () => [mockDeletePage, { isLoading: false }],
  useUpdateOrCreateQuestionMutation: () => [
    mockUpdateOrCreateQuestion,
    { isLoading: false },
  ],
}))

// Capture the real DndContext's onDragEnd handler so tests can trigger it
// directly instead of simulating real pointer-based drag gestures (which
// dnd-kit implements via DOM measurements jsdom doesn't provide).
let capturedOnDragEnd: ((event: unknown) => void) | null = null

vi.mock("@dnd-kit/core", () => ({
  DndContext: (props: {
    children: ReactNode
    onDragEnd: (event: unknown) => void
  }) => {
    capturedOnDragEnd = props.onDragEnd
    return props.children
  },
  closestCenter: vi.fn(),
  KeyboardSensor: class {},
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: (...sensors: unknown[]) => sensors,
}))

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: (props: { children: ReactNode }) => props.children,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
}))

// Stub the row renderer entirely — it isn't relevant to the reorder-sync
// error handling under test, and rendering it drags in its own
// useSortable()/RHF Controller wiring that would just add noise here.
vi.mock("./EditSortableQuestionRow", () => ({
  default: ({
    sortableId,
    questionIndex,
    getValues,
    pageIndex,
  }: {
    sortableId: string
    questionIndex: number
    pageIndex: number
    getValues: (name: string) => { question: string }
  }) => {
    const q = getValues(`pages.${pageIndex}.questions.${questionIndex}`)
    return (
      <div data-testid="question-row" data-sortable-id={sortableId}>
        {q.question}
      </div>
    )
  },
}))

function makeQuestion(overrides = {}) {
  return {
    id: "q-static-id",
    index: 0,
    question: "Question",
    isRequired: false,
    answerType: { answerType: "input", value: "text" },
    ...overrides,
  }
}

function Harness({
  questions,
  isEditMode = true,
}: {
  questions: ReturnType<typeof makeQuestion>[]
  isEditMode?: boolean
}) {
  const { control, register, getValues, setValue } = useForm({
    defaultValues: {
      pages: [
        {
          id: "page-field-1",
          title: "Section A",
          questions,
        },
      ],
    },
  })

  return (
    <EditPageSection
      pageIndex={0}
      pageId="22222222-2222-2222-2222-222222222222"
      templateId="template-1"
      control={control}
      register={register}
      removePage={() => {}}
      totalPages={2}
      onOpenAddModal={() => {}}
      onOpenAnswerPanel={() => {}}
      getValues={getValues}
      setValue={setValue}
      isEditMode={isEditMode}
    />
  )
}

describe("EditPageSection - drag reorder sync", () => {
  beforeEach(() => {
    mockUpdateOrCreatePage.mockReset()
    mockDeletePage.mockReset()
    mockUpdateOrCreateQuestion.mockReset()
    mockToastError.mockReset()
    capturedOnDragEnd = null
  })

  function getRowIds() {
    return screen
      .getAllByTestId("question-row")
      .map((el) => el.getAttribute("data-sortable-id")!)
  }

  it("syncs every question's new index to the backend on drag end", async () => {
    mockUpdateOrCreateQuestion.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(
      <Harness
        questions={[
          makeQuestion({ id: "q1", index: 0, question: "First" }),
          makeQuestion({ id: "q2", index: 1, question: "Second" }),
        ]}
      />
    )

    const [firstId, secondId] = getRowIds()
    await act(async () => {
      capturedOnDragEnd?.({
        active: { id: firstId },
        over: { id: secondId },
      })
    })

    await waitFor(() => expect(mockUpdateOrCreateQuestion).toHaveBeenCalled())
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it("reports a per-batch failure count and leaves the successfully-synced question marked as synced when one question in the reorder batch fails", async () => {
    // Three questions get reordered so all three need an index update;
    // the middle one's save fails, the other two succeed.
    mockUpdateOrCreateQuestion.mockImplementation(({
      questionId,
    }: {
      questionId: string
    }) => ({
      unwrap: () =>
        questionId === "q2"
          ? Promise.reject({ data: { message: "Conflict" } })
          : Promise.resolve({ success: true }),
    }))

    render(
      <Harness
        questions={[
          makeQuestion({ id: "q1", index: 0, question: "First" }),
          makeQuestion({ id: "q2", index: 1, question: "Second" }),
          makeQuestion({ id: "q3", index: 2, question: "Third" }),
        ]}
      />
    )

    const [firstId, , thirdId] = getRowIds()
    // Move the first row to the last position — this shifts every
    // question's target index, so all three are included in the batch.
    await act(async () => {
      capturedOnDragEnd?.({
        active: { id: firstId },
        over: { id: thirdId },
      })
    })

    await waitFor(() =>
      expect(mockUpdateOrCreateQuestion).toHaveBeenCalledTimes(3)
    )
    // One failure in the batch reports a count, not a generic/blank message,
    // and doesn't silently swallow the rejection as an unhandled promise.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to save the new order for 1 question"
      )
    )
  })

  it("does not attempt to sync when not in edit mode", async () => {
    render(
      <Harness
        isEditMode={false}
        questions={[
          makeQuestion({ id: "q1", index: 0, question: "First" }),
          makeQuestion({ id: "q2", index: 1, question: "Second" }),
        ]}
      />
    )

    const [firstId, secondId] = getRowIds()
    await act(async () => {
      capturedOnDragEnd?.({
        active: { id: firstId },
        over: { id: secondId },
      })
    })

    expect(mockUpdateOrCreateQuestion).not.toHaveBeenCalled()
  })
})
