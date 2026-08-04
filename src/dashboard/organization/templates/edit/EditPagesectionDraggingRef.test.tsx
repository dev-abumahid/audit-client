import { act, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Control } from "react-hook-form"
import { useForm, useWatch } from "react-hook-form"
import EditPageSection from "./EditPagesection"

// Regression coverage for the closure bug fixed in issue #129:
// debouncedSyncOrder used to read the `isDragging` *state* value directly,
// so the specific debounced-function instance invoked by handleDragEnd on
// drop was always the one created during the isDragging===true render — its
// guard was permanently frozen to `true`, and the sync silently never ran
// in production, no matter how long you waited. The fix reads dragging
// state through a ref (kept current via a useEffect) instead.
//
// Unlike EditPagesection.test.tsx, this file deliberately does NOT mock
// lodash — the whole point is to exercise the real debounce delay with
// fake timers, so a stale-closure regression would show up as "the sync
// never fires even after the delay has elapsed."

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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

let capturedOnDragEnd: ((event: unknown) => void) | null = null
let capturedOnDragStart: (() => void) | null = null

vi.mock("@dnd-kit/core", () => ({
  DndContext: (props: {
    children: ReactNode
    onDragEnd: (event: unknown) => void
    onDragStart: () => void
  }) => {
    capturedOnDragEnd = props.onDragEnd
    capturedOnDragStart = props.onDragStart
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

vi.mock("./EditSortableQuestionRow", () => ({
  // Named (rather than an anonymous arrow assigned to `default`) so eslint's
  // react-hooks/rules-of-hooks recognizes this as a component -- see the
  // matching comment in EditPagesection.test.tsx.
  default: function MockEditSortableQuestionRow({
    sortableId,
    questionIndex,
    control,
    pageIndex,
  }: {
    sortableId: string
    questionIndex: number
    pageIndex: number
    control: unknown
  }) {
    const question = useWatch({
      control: control as Control,
      name: `pages.${pageIndex}.questions.${questionIndex}.question`,
    })
    return (
      <div data-testid="question-row" data-sortable-id={sortableId}>
        {question}
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
}: {
  questions: ReturnType<typeof makeQuestion>[]
}) {
  const { control, getValues, setValue } = useForm({
    defaultValues: {
      pages: [{ id: "page-field-1", title: "Section A", questions }],
    },
  })

  return (
    <EditPageSection
      pageIndex={0}
      pageId="22222222-2222-2222-2222-222222222222"
      templateId="template-1"
      control={control}
      removePage={() => {}}
      totalPages={2}
      onOpenAddModal={() => {}}
      onOpenAnswerPanel={() => {}}
      getValues={getValues}
      setValue={setValue}
      isEditMode
    />
  )
}

describe("EditPageSection - debouncedSyncOrder reads dragging state via a ref, not a stale closure", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUpdateOrCreateQuestion.mockReset()
    mockUpdateOrCreateQuestion.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })
    capturedOnDragEnd = null
    capturedOnDragStart = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("fires the reorder sync once the debounce delay elapses, even though it was scheduled during an isDragging=true render", () => {
    render(
      <Harness
        questions={[
          makeQuestion({ id: "q1", index: 0, question: "First" }),
          makeQuestion({ id: "q2", index: 1, question: "Second" }),
        ]}
      />
    )

    const rows = screen.getAllByTestId("question-row")
    const [firstId, secondId] = rows.map(
      (el) => el.getAttribute("data-sortable-id")!
    )

    // Real drag sequence: onDragStart flips isDragging to true (a
    // re-render happens before the drop, so the debounced-function
    // instance that handleDragEnd goes on to invoke is the one whose
    // closure was created — pre-fix, frozen — while isDragging was true).
    // onDragEnd then reorders and schedules the debounced sync while
    // isDragging is still true, and only afterwards flips it back to
    // false.
    act(() => {
      capturedOnDragStart?.()
    })
    act(() => {
      capturedOnDragEnd?.({ active: { id: firstId }, over: { id: secondId } })
    })

    // Nothing has fired yet — the debounce delay hasn't elapsed.
    expect(mockUpdateOrCreateQuestion).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(600)
    })

    // The pre-fix bug read a closed-over `isDragging` value frozen at
    // `true` from the schedule-time render, so this call would never
    // happen no matter how long the timer ran. Reading isDraggingRef.current
    // at execution time (now false, since setIsDragging(false) already
    // re-rendered before the timer fired) lets the sync actually run.
    expect(mockUpdateOrCreateQuestion).toHaveBeenCalled()
  })
})
