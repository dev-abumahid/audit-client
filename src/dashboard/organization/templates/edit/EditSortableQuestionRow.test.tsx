import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import EditSortableQuestionRow from "./EditSortableQuestionRow"

// Issue #129 coverage gap (flagged in PR #130 review): the "Order not
// saved" indicator's masking/resume behavior against isDragging/isSyncing
// was verified correct by code inspection but had no test locking it in.
// These tests drive EditSortableQuestionRow directly (rather than through
// EditPageSection, which stubs this component out entirely) so the actual
// indicator markup and precedence logic run for real.

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

const mockUpdateOrCreateQuestion = vi.fn()
const mockDeleteQuestion = vi.fn()

vi.mock("@/redux/apis/organization/template.api", () => ({
  useUpdateOrCreateQuestionMutation: () => [
    mockUpdateOrCreateQuestion,
    { isLoading: false },
  ],
  useDeleteQuestionMutation: () => [mockDeleteQuestion, { isLoading: false }],
}))

vi.mock("@/utils/validUUID", () => ({
  isValidUUID: () => true,
}))

function Harness({
  orderSyncFailed = false,
  isDraggingGlobal = false,
  // Defaults to false so most of these tests (which only care about the
  // order-sync indicator's own masking logic) don't also trigger this
  // component's unrelated text/type autosave effects, which run on mount
  // whenever isEditMode+pageId are set regardless of orderSyncFailed.
  isEditMode = false,
}: {
  orderSyncFailed?: boolean
  isDraggingGlobal?: boolean
  isEditMode?: boolean
}) {
  const { control, register, getValues, setValue } = useForm({
    defaultValues: {
      pages: [
        {
          questions: [
            {
              id: "q1",
              question: "First question",
              isRequired: false,
              answerType: { answerType: "input", value: "text" },
            },
          ],
        },
      ],
    },
  })

  return (
    <EditSortableQuestionRow
      sortableId="row-1"
      pageIndex={0}
      questionIndex={0}
      questionId="q1"
      pageId="page-1"
      templateId="template-1"
      control={control}
      register={register}
      remove={() => {}}
      onOpenAnswerPanel={() => {}}
      getValues={getValues}
      setValue={setValue}
      isEditMode={isEditMode}
      isDraggingGlobal={isDraggingGlobal}
      orderSyncFailed={orderSyncFailed}
    />
  )
}

describe("EditSortableQuestionRow - order-not-saved indicator masking", () => {
  beforeEach(() => {
    mockUpdateOrCreateQuestion.mockReset()
    mockDeleteQuestion.mockReset()
    mockUpdateOrCreateQuestion.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
  })

  it("shows the persistent indicator when orderSyncFailed is true and nothing else is happening", () => {
    render(<Harness orderSyncFailed />)
    expect(screen.getByText("Order not saved")).toBeInTheDocument()
  })

  it("shows no indicator when orderSyncFailed is false", () => {
    render(<Harness orderSyncFailed={false} />)
    expect(screen.queryByText("Order not saved")).not.toBeInTheDocument()
  })

  it("hides the order-not-saved indicator while dragging, and shows it again once dragging ends", () => {
    const { rerender } = render(<Harness orderSyncFailed isDraggingGlobal />)
    expect(screen.queryByText("Order not saved")).not.toBeInTheDocument()

    rerender(<Harness orderSyncFailed isDraggingGlobal={false} />)
    expect(screen.getByText("Order not saved")).toBeInTheDocument()
  })

  it("prioritizes the in-progress 'Saving...' indicator over a stale order-not-saved flag, then reveals the flag again once that sync finishes", async () => {
    render(<Harness orderSyncFailed isEditMode />)

    // Mounting with isEditMode+pageId set triggers this row's own
    // (unrelated) text/type autosave on mount — let it settle first so it
    // doesn't get confused with the sync we're about to control below.
    await waitFor(() => expect(mockUpdateOrCreateQuestion).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.queryByText("Saving...")).not.toBeInTheDocument()
    )
    mockUpdateOrCreateQuestion.mockClear()
    expect(screen.getByText("Order not saved")).toBeInTheDocument()

    // Now make the next sync hang so we can observe it masking the
    // order-not-saved flag while in flight.
    let resolveSync: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      resolveSync = resolve
    })
    mockUpdateOrCreateQuestion.mockReturnValue({ unwrap: () => pending })

    // Toggling "Required" triggers this row's autosave immediately, without
    // needing to wait out the 800ms debounce used for question-text
    // changes.
    await userEvent.click(screen.getByRole("checkbox"))

    await waitFor(() =>
      expect(screen.getByText("Saving...")).toBeInTheDocument()
    )
    expect(screen.queryByText("Order not saved")).not.toBeInTheDocument()

    await act(async () => {
      resolveSync({})
      await pending
    })

    await waitFor(() =>
      expect(screen.getByText("Order not saved")).toBeInTheDocument()
    )
    expect(screen.queryByText("Saving...")).not.toBeInTheDocument()
  })
})
