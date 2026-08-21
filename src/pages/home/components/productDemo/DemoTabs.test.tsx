import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import DemoTabs from "./DemoTabs"

function TabAContent() {
  return <p>Content A</p>
}
function TabBContent() {
  return <p>Content B</p>
}

function TabCContent() {
  return <p>Content C</p>
}

const TABS = [
  { id: "a", label: "Tab A", Component: TabAContent },
  { id: "b", label: "Tab B", Component: TabBContent },
]

const THREE_TABS = [
  ...TABS,
  { id: "c", label: "Tab C", Component: TabCContent },
]

describe("DemoTabs", () => {
  it("shows the first tab's content active by default", () => {
    render(<DemoTabs tabs={TABS} />)
    expect(screen.getByRole("tab", { name: "Tab A" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByRole("tab", { name: "Tab B" })).toHaveAttribute(
      "aria-selected",
      "false"
    )
  })

  it("switches the active tab on click", async () => {
    const user = userEvent.setup()
    render(<DemoTabs tabs={TABS} />)

    await user.click(screen.getByRole("tab", { name: "Tab B" }))

    expect(screen.getByRole("tab", { name: "Tab B" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByRole("tab", { name: "Tab A" })).toHaveAttribute(
      "aria-selected",
      "false"
    )
  })

  // Review finding on PR #1016: role="tablist"/role="tab" implies the ARIA
  // APG tabs pattern (arrow-key navigation, roving tabindex) -- verify both
  // pieces, not just that a click works.
  it("supports arrow-key navigation with roving tabindex", async () => {
    const user = userEvent.setup()
    render(<DemoTabs tabs={TABS} />)
    const tabA = screen.getByRole("tab", { name: "Tab A" })
    const tabB = screen.getByRole("tab", { name: "Tab B" })

    expect(tabA).toHaveAttribute("tabindex", "0")
    expect(tabB).toHaveAttribute("tabindex", "-1")

    tabA.focus()
    await user.keyboard("{ArrowRight}")

    expect(tabB).toHaveAttribute("aria-selected", "true")
    expect(tabB).toHaveAttribute("tabindex", "0")
    expect(tabA).toHaveAttribute("tabindex", "-1")
    expect(tabB).toHaveFocus()

    await user.keyboard("{ArrowLeft}")
    expect(tabA).toHaveAttribute("aria-selected", "true")
    expect(tabA).toHaveFocus()
  })

  // Round-2 review note on PR #1016: the 2-tab case above can't tell
  // "wraps around" apart from ordinary next/prev -- a real 3rd tab makes
  // ArrowLeft from the first tab and ArrowRight from the last genuinely
  // distinct assertions.
  it("wraps ArrowRight past the last tab back to the first, and vice versa", async () => {
    const user = userEvent.setup()
    render(<DemoTabs tabs={THREE_TABS} />)
    const tabA = screen.getByRole("tab", { name: "Tab A" })
    const tabC = screen.getByRole("tab", { name: "Tab C" })

    tabA.focus()
    await user.keyboard("{ArrowLeft}")
    expect(tabC).toHaveAttribute("aria-selected", "true")
    expect(tabC).toHaveFocus()

    await user.keyboard("{ArrowRight}")
    expect(tabA).toHaveAttribute("aria-selected", "true")
    expect(tabA).toHaveFocus()
  })

  it("supports Home/End to jump to the first/last tab", async () => {
    const user = userEvent.setup()
    render(<DemoTabs tabs={THREE_TABS} />)
    const tabA = screen.getByRole("tab", { name: "Tab A" })
    const tabC = screen.getByRole("tab", { name: "Tab C" })

    tabA.focus()
    await user.keyboard("{End}")
    expect(tabC).toHaveAttribute("aria-selected", "true")
    expect(tabC).toHaveFocus()

    await user.keyboard("{Home}")
    expect(tabA).toHaveAttribute("aria-selected", "true")
    expect(tabA).toHaveFocus()
  })

  // Both panels are always mounted (grid-stacked for the crossfade, per
  // this component's own doc comment) -- the inactive one gets `inert`
  // rather than unmounting, so it stays out of the accessibility tree and
  // tab order without a layout jump when switching tabs.
  it("marks the inactive panel inert instead of unmounting it", () => {
    const { container } = render(<DemoTabs tabs={TABS} />)
    const panelA = container.querySelector("#demo-panel-a")
    const panelB = container.querySelector("#demo-panel-b")

    expect(panelA).not.toHaveAttribute("inert")
    expect(panelB).toHaveAttribute("inert")
    // Still in the DOM, not removed -- this is what makes grid-stacked
    // height stability possible.
    expect(panelB?.textContent).toContain("Content B")
  })
})
