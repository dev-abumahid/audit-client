import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RemoveIconButton } from "./RemoveIconButton"

describe("RemoveIconButton", () => {
  it("renders an accessible button labeled by `label` and fires onClick", async () => {
    const onClick = vi.fn()
    render(<RemoveIconButton onClick={onClick} label="Delete question" />)

    const button = screen.getByRole("button", { name: "Delete question" })
    await userEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("respects the disabled prop", () => {
    render(
      <RemoveIconButton onClick={vi.fn()} label="Delete question" disabled />
    )

    expect(screen.getByRole("button", { name: "Delete question" })).toBeDisabled()
  })

  it("defaults to the trash icon but renders the x icon when icon=\"x\"", () => {
    const { container, rerender } = render(
      <RemoveIconButton onClick={vi.fn()} label="Remove logo" />
    )
    expect(container.querySelector(".lucide-trash2")).toBeInTheDocument()
    expect(container.querySelector(".lucide-x")).not.toBeInTheDocument()

    rerender(
      <RemoveIconButton onClick={vi.fn()} label="Remove logo" icon="x" />
    )
    expect(container.querySelector(".lucide-x")).toBeInTheDocument()
    expect(container.querySelector(".lucide-trash2")).not.toBeInTheDocument()
  })

  it("uses the shared destructive Button variant, not a hardcoded raw color", () => {
    render(<RemoveIconButton onClick={vi.fn()} label="Delete question" />)

    const button = screen.getByRole("button", { name: "Delete question" })
    expect(button).toHaveAttribute("data-variant", "destructive")
    expect(button.className).not.toContain("bg-red-500")
  })

  // Review finding on PR #803: the caller-supplied `className` (used for
  // per-call-site absolute positioning) goes through Button's own `cn()`
  // merge -- confirms it actually reaches the DOM alongside the base
  // rounded-full/size/variant classes rather than being dropped or
  // clobbering them.
  it("merges the caller's positioning className with the button's own base classes", () => {
    render(
      <RemoveIconButton
        onClick={vi.fn()}
        label="Remove logo"
        className="absolute -top-2 -right-2"
      />
    )

    const button = screen.getByRole("button", { name: "Remove logo" })
    expect(button).toHaveClass("absolute", "-top-2", "-right-2", "rounded-full")
    expect(button).toHaveAttribute("data-variant", "destructive")
  })

  // Review finding on PR #803: the two logo-remove call sites were a fixed
  // 24px box before this extraction; defaulting every caller to `icon-xs`
  // (20px) would silently shrink them. `size="icon-sm"` opts back into the
  // matching 24px box.
  it("supports opting into the larger icon-sm size for the 24px call sites", () => {
    render(
      <RemoveIconButton onClick={vi.fn()} label="Remove logo" size="icon-sm" />
    )

    expect(
      screen.getByRole("button", { name: "Remove logo" })
    ).toHaveAttribute("data-size", "icon-sm")
  })
})
