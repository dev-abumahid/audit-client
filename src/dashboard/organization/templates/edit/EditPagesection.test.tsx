import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
// `orderSyncFailed` is surfaced in the stub's own markup (rather than
// re-implementing EditSortableQuestionRow's actual indicator UI) so tests
// here can assert on the prop EditPageSection computes and passes down.
vi.mock("./EditSortableQuestionRow", () => ({
  default: ({
    sortableId,
    questionIndex,
    getValues,
    pageIndex,
    orderSyncFailed,
    remove,
  }: {
    sortableId: string
    questionIndex: number
    pageIndex: number
    getValues: (name: string) => { question: string }
    orderSyncFailed?: boolean
    remove: (index: number) => void
  }) => {
    const q = getValues(`pages.${pageIndex}.questions.${questionIndex}`)
    return (
      <div data-testid="question-row" data-sortable-id={sortableId}>
        {q.question}
        {orderSyncFailed && (
          <span data-testid={`order-sync-failed-${sortableId}`}>
            Order not saved
          </span>
        )}
        {/* Test-only affordance standing in for the real delete button, so
            deletion-pruning tests can trigger a genuine useFieldArray
            `remove()` without re-implementing the row's real delete UI. */}
        <button onClick={() => remove(questionIndex)}>
          Delete {q.question}
        </button>
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

  function findRowByQuestionText(text: string) {
    return screen
      .getAllByTestId("question-row")
      .find((el) => el.textContent?.startsWith(text))!
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

  it("shows a persistent 'order not saved' indicator when a question's reorder sync fails, and clears it once a later sync for that question succeeds", async () => {
    let q2CallCount = 0
    mockUpdateOrCreateQuestion.mockImplementation(
      ({ questionId }: { questionId: string }) => ({
        unwrap: () => {
          if (questionId === "q2") {
            q2CallCount += 1
            // Fails the first time it's synced, succeeds on any retry.
            return q2CallCount === 1
              ? Promise.reject({ data: { message: "Conflict" } })
              : Promise.resolve({ success: true })
          }
          return Promise.resolve({ success: true })
        },
      })
    )

    render(
      <Harness
        questions={[
          makeQuestion({ id: "q1", index: 0, question: "First" }),
          makeQuestion({ id: "q2", index: 1, question: "Second" }),
          makeQuestion({ id: "q3", index: 2, question: "Third" }),
        ]}
      />
    )

    // First drag: move the first row to the last position, shifting every
    // question's target index. q2's sync fails.
    const [firstId, , thirdId] = getRowIds()
    await act(async () => {
      capturedOnDragEnd?.({
        active: { id: firstId },
        over: { id: thirdId },
      })
    })

    await waitFor(() =>
      expect(
        within(findRowByQuestionText("Second")).getByText("Order not saved")
      ).toBeInTheDocument()
    )
    // The other two questions, which synced fine, show no indicator.
    expect(
      within(findRowByQuestionText("First")).queryByText("Order not saved")
    ).not.toBeInTheDocument()
    expect(
      within(findRowByQuestionText("Third")).queryByText("Order not saved")
    ).not.toBeInTheDocument()

    // q2's local `index` bookkeeping was left stale on failure, so the next
    // reorder pass retries it automatically. Drag again to trigger that
    // retry (order after the first drag is [Second, Third, First]).
    const [, secondId, secondThirdId] = getRowIds()
    await act(async () => {
      capturedOnDragEnd?.({
        active: { id: secondId },
        over: { id: secondThirdId },
      })
    })

    await waitFor(() => expect(q2CallCount).toBe(2))
    await waitFor(() =>
      expect(
        within(findRowByQuestionText("Second")).queryByText(
          "Order not saved"
        )
      ).not.toBeInTheDocument()
    )
  })

  it("ignores a stale batch's failure once a newer overlapping batch has already completed", async () => {
    // Regression test for the debounce race documented on
    // debouncedSyncOrder: lodash's debounce only cancels a pending timer,
    // not an already-running invocation, so two overlapping invocations can
    // be in flight at once. The stale one's results must be dropped rather
    // than applied on top of the newer, already-settled one.
    let hungReject: ((err: unknown) => void) | null = null
    let hungCallStarted = false

    mockUpdateOrCreateQuestion.mockImplementation(
      ({ questionId }: { questionId: string }) => ({
        unwrap: () => {
          if (questionId === "q2" && !hungCallStarted) {
            hungCallStarted = true
            // Simulates a slow in-flight request from the first
            // (soon-to-be-stale) batch that a second, faster batch races
            // ahead of.
            return new Promise((_resolve, reject) => {
              hungReject = reject
            })
          }
          return Promise.resolve({ success: true })
        },
      })
    )

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

    // Batch A starts (generation 1); its q2 request hangs mid-flight.
    act(() => {
      capturedOnDragEnd?.({ active: { id: firstId }, over: { id: thirdId } })
    })
    await waitFor(() => expect(hungCallStarted).toBe(true))

    // Batch B starts (generation 2) before batch A has settled, and fully
    // completes (everything mocked to succeed).
    const [secondFirstId, , secondThirdId] = getRowIds()
    await act(async () => {
      capturedOnDragEnd?.({
        active: { id: secondFirstId },
        over: { id: secondThirdId },
      })
    })

    // Batch A's hung q2 request finally settles as a failure, after batch
    // B already completed successfully.
    await act(async () => {
      hungReject?.({ data: { message: "Conflict" } })
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    // The stale batch A's failure must not surface — no toast, and no
    // persistent "order not saved" indicator for q2 (both are gated by the
    // same generation check).
    expect(mockToastError).not.toHaveBeenCalled()
    expect(
      within(findRowByQuestionText("Second")).queryByText("Order not saved")
    ).not.toBeInTheDocument()
  })

  it("prunes a question's failed-sync flag once that question is deleted", async () => {
    mockUpdateOrCreateQuestion.mockImplementation(
      ({ questionId }: { questionId: string }) => ({
        unwrap: () =>
          questionId === "q2"
            ? Promise.reject({ data: { message: "Conflict" } })
            : Promise.resolve({ success: true }),
      })
    )

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
    await act(async () => {
      capturedOnDragEnd?.({
        active: { id: firstId },
        over: { id: thirdId },
      })
    })

    await waitFor(() =>
      expect(
        within(findRowByQuestionText("Second")).getByText("Order not saved")
      ).toBeInTheDocument()
    )

    // Delete the failed question via the same useFieldArray `remove()` the
    // real delete button uses.
    await userEvent.click(
      within(findRowByQuestionText("Second")).getByText(/Delete/)
    )

    // The deleted question's row (and its failed-flag) is gone, and no
    // other row picked up a stray "Order not saved" flag.
    expect(screen.queryByText("Second")).not.toBeInTheDocument()
    expect(screen.queryByText("Order not saved")).not.toBeInTheDocument()
  })

  it("does not throw or log an unmounted-state-update warning when a reorder sync resolves after the component has unmounted", async () => {
    let resolveHung: (() => void) | null = null
    mockUpdateOrCreateQuestion.mockImplementation(() => ({
      unwrap: () =>
        new Promise((resolve) => {
          resolveHung = () => resolve({ success: true })
        }),
    }))

    const { unmount } = render(
      <Harness
        questions={[
          makeQuestion({ id: "q1", index: 0, question: "First" }),
          makeQuestion({ id: "q2", index: 1, question: "Second" }),
        ]}
      />
    )

    const [firstId, secondId] = getRowIds()
    act(() => {
      capturedOnDragEnd?.({
        active: { id: firstId },
        over: { id: secondId },
      })
    })
    await waitFor(() => expect(mockUpdateOrCreateQuestion).toHaveBeenCalled())

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    unmount()

    // Resolve the in-flight reorder sync only after the component has
    // already unmounted — the isMountedRef guard in debouncedSyncOrder
    // should skip its post-resolve setValue/setSyncFailedIds/toast calls
    // entirely rather than throwing or warning about updating an unmounted
    // component.
    await act(async () => {
      resolveHung?.()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(mockToastError).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
