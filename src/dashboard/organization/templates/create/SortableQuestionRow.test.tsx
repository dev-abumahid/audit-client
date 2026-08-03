import { render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import SortableQuestionRow from "./SortableQuestionRow"

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

function Harness() {
  const { control, register, getValues } = useForm({
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
    <SortableQuestionRow
      sortableId="row-1"
      pageIndex={0}
      questionIndex={0}
      control={control}
      register={register}
      remove={() => {}}
      onOpenAnswerPanel={() => {}}
      getValues={getValues}
    />
  )
}

// aexa-frontend#468: the drag-handle (GripVertical) button had zero
// accessible name -- live-confirmed as an actual DOM gap, not just a lint
// finding.
describe("SortableQuestionRow - accessible names (#468)", () => {
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
