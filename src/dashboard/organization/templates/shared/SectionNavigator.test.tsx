import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SectionNavigator from "./SectionNavigator"

describe("SectionNavigator (ticket #62)", () => {
  it("renders nothing when there are no sections", () => {
    const { container } = render(
      <SectionNavigator sections={[]} activeIndex={0} onSelect={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders a numbered entry per section using the live-watched title", () => {
    render(
      <SectionNavigator
        sections={[
          { id: "p1", title: "General Info" },
          { id: "p2", title: "Safety Checks" },
        ]}
        activeIndex={0}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText("General Info")).toBeInTheDocument()
    expect(screen.getByText("Safety Checks")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("falls back to 'Section N' when a section has no title yet (e.g. mid-typing, or a title watch that hasn't resolved)", () => {
    render(
      <SectionNavigator
        sections={[{ id: "p1", title: "" }]}
        activeIndex={0}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText("Section 1")).toBeInTheDocument()
  })

  it("calls onSelect with the clicked section's index", async () => {
    const onSelect = vi.fn()
    render(
      <SectionNavigator
        sections={[
          { id: "p1", title: "General Info" },
          { id: "p2", title: "Safety Checks" },
        ]}
        activeIndex={0}
        onSelect={onSelect}
      />
    )

    await userEvent.click(screen.getByText("Safety Checks"))

    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it("does not submit the enclosing form when clicked (buttons default to type=submit)", () => {
    // Both CreateTemplatePage and EditTemplatePage wrap their whole page in a
    // <form>. A nav button without type="button" would trigger a premature
    // form submit on click instead of just scrolling.
    render(
      <SectionNavigator
        sections={[{ id: "p1", title: "General Info" }]}
        activeIndex={0}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: /General Info/ })).toHaveAttribute(
      "type",
      "button"
    )
  })
})
