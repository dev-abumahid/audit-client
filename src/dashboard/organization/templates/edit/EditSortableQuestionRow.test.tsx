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
  const { control } = useForm({
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
      control={control}
      remove={() => {}}
      onOpenAnswerPanel={() => {}}
      isEditMode={isEditMode}
      isDraggingGlobal={isDraggingGlobal}
      orderSyncFailed={orderSyncFailed}
    />
  )
}

// aexa-frontend#468: the drag-handle (GripVertical) button had zero
// accessible name -- live-confirmed as an actual DOM gap, not just a lint
// finding.
describe("EditSortableQuestionRow - drag handle accessible name (#468)", () => {
  beforeEach(() => {
    mockUpdateOrCreateQuestion.mockReset()
    mockDeleteQuestion.mockReset()
  })

  it("gives the drag-handle button an accessible name", () => {
    render(<Harness />)

    expect(
      screen.getByRole("button", {
        name: "organization.templates.builder.dragToReorder",
      })
    ).toBeInTheDocument()
  })

  it("gives the delete-question button an accessible name", () => {
    render(<Harness />)

    expect(
      screen.getByRole("button", {
        name: "organization.templates.builder.deleteQuestion",
      })
    ).toBeInTheDocument()
  })
})

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
    expect(screen.getByText("organization.templates.builder.orderNotSaved")).toBeInTheDocument()
  })

  it("shows no indicator when orderSyncFailed is false", () => {
    render(<Harness orderSyncFailed={false} />)
    expect(screen.queryByText("organization.templates.builder.orderNotSaved")).not.toBeInTheDocument()
  })

  it("hides the order-not-saved indicator while dragging, and shows it again once dragging ends", () => {
    const { rerender } = render(<Harness orderSyncFailed isDraggingGlobal />)
    expect(screen.queryByText("organization.templates.builder.orderNotSaved")).not.toBeInTheDocument()

    rerender(<Harness orderSyncFailed isDraggingGlobal={false} />)
    expect(screen.getByText("organization.templates.builder.orderNotSaved")).toBeInTheDocument()
  })

  it("prioritizes the in-progress 'Saving...' indicator over a stale order-not-saved flag, then reveals the flag again once that sync finishes", async () => {
    render(<Harness orderSyncFailed isEditMode />)

    // Issue #363 fix: mounting with existing data must NOT trigger this
    // row's text/type autosave on mount (lastSyncedValueRef now starts at
    // the mounted value instead of null, so the sync-key comparison
    // correctly reads "unchanged"). Nothing to wait out here anymore --
    // proceed straight to the order-not-saved flag, already true from props.
    expect(mockUpdateOrCreateQuestion).not.toHaveBeenCalled()
    expect(screen.getByText("organization.templates.builder.orderNotSaved")).toBeInTheDocument()

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
      expect(screen.getByText("organization.templates.builder.saving")).toBeInTheDocument()
    )
    expect(screen.queryByText("organization.templates.builder.orderNotSaved")).not.toBeInTheDocument()

    await act(async () => {
      resolveSync({})
      await pending
    })

    await waitFor(() =>
      expect(screen.getByText("organization.templates.builder.orderNotSaved")).toBeInTheDocument()
    )
    expect(screen.queryByText("organization.templates.builder.saving")).not.toBeInTheDocument()
  })
})

// Issue #363: mounting the template editor with existing questions used to
// fire a real PATCH for every question immediately, because
// lastSyncedValueRef started at `useRef(null)`, which never equals the
// mounted question's real sync key. Fixed by initializing the ref with the
// current (mounted) value instead, so the first comparison correctly reads
// "unchanged since mount".
describe("EditSortableQuestionRow - no spurious sync on mount", () => {
  beforeEach(() => {
    mockUpdateOrCreateQuestion.mockReset()
    mockDeleteQuestion.mockReset()
    mockUpdateOrCreateQuestion.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
  })

  it("does not sync on mount with existing, unchanged data -- only after the user actually edits a field", async () => {
    render(<Harness isEditMode />)

    // Wait out both the immediate (isRequired/answerType) effects and the
    // 800ms-debounced text-sync effect, all of which run once on mount
    // regardless of whether anything actually changed.
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateOrCreateQuestion).not.toHaveBeenCalled()

    // A real edit (toggling "Required") should still sync normally --
    // confirms the fix didn't just disable syncing altogether.
    await userEvent.click(screen.getByRole("checkbox"))
    await waitFor(() => expect(mockUpdateOrCreateQuestion).toHaveBeenCalledTimes(1))
  })
})
