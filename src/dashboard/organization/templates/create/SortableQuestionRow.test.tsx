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

function Harness({
  isAnswerPanelOpen,
}: { isAnswerPanelOpen?: boolean } = {}) {
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
    <SortableQuestionRow
      sortableId="row-1"
      pageIndex={0}
      questionIndex={0}
      control={control}
      remove={() => {}}
      onOpenAnswerPanel={() => {}}
      isAnswerPanelOpen={isAnswerPanelOpen}
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

// Round 13 (#507): the "Answer Type" trigger button had no
// aria-haspopup/aria-expanded, unlike RiskMultiSelect.tsx's trigger.
describe("SortableQuestionRow - Answer Type trigger a11y (#507)", () => {
  function answerTypeButton() {
    // The only trigger button in this component that opens a popup --
    // scoped by aria-haspopup rather than accessible name since the
    // label text itself varies with the selected answer type.
    return screen
      .getAllByRole("button")
      .find((btn) => btn.getAttribute("aria-haspopup") === "dialog")
  }

  it("marks the Answer Type trigger as a collapsed popup by default", () => {
    render(<Harness />)

    const button = answerTypeButton()
    expect(button).toHaveAttribute("aria-haspopup", "dialog")
    expect(button).toHaveAttribute("aria-expanded", "false")
  })

  it("marks the Answer Type trigger as expanded when its panel is open", () => {
    render(<Harness isAnswerPanelOpen />)

    expect(answerTypeButton()).toHaveAttribute("aria-expanded", "true")
  })
})
