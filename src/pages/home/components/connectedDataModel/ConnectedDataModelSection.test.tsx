import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CONNECTED_DEMO_RISKS } from "./connectedDataModelDemoData"
import ConnectedDataModelSection from "./ConnectedDataModelSection"

// The test environment does not initialize i18n, so t() echoes the raw key
// -- same convention as the other landing-page widget tests. Interpolated
// keys (selectionAnnouncement, kri.valueLine, etc.) echo back with the
// {{var}} placeholders literally unresolved, since there's no i18n runtime
// here to substitute them -- assertions on those match the raw key text,
// not the interpolated value.
describe("ConnectedDataModelSection", () => {
  it("renders the section header keys", () => {
    render(<ConnectedDataModelSection />)
    expect(
      screen.getByText("home.connectedDataModel.title")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.connectedDataModel.description")
    ).toBeInTheDocument()
  })

  it("renders exactly the 4 real demo risks as a radiogroup, CYB-014 selected by default", () => {
    render(<ConnectedDataModelSection />)
    const group = screen.getByRole("radiogroup", {
      name: "home.connectedDataModel.selectorLabel",
    })
    const radios = within(group).getAllByRole("radio")
    expect(radios).toHaveLength(CONNECTED_DEMO_RISKS.length)

    CONNECTED_DEMO_RISKS.forEach((entry) => {
      expect(within(group).getByText(entry.risk.ref)).toBeInTheDocument()
    })

    const defaultRisk = CONNECTED_DEMO_RISKS[0].risk
    expect(
      radios.find((r) => within(r).queryByText(defaultRisk.ref))
    ).toHaveAttribute("aria-checked", "true")
  })

  it("has no 4th 'Register entry' card and no 'Control' card -- only KRI/finding/mitigation slots", () => {
    render(<ConnectedDataModelSection />)
    expect(screen.queryByText(/register entry/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^control$/i)).not.toBeInTheDocument()
  })

  it("shows the default risk's real linked KRI, audit finding, and mitigation", () => {
    render(<ConnectedDataModelSection />)
    const defaultEntry = CONNECTED_DEMO_RISKS[0]
    expect(defaultEntry.kri).not.toBeNull()
    expect(defaultEntry.finding).not.toBeNull()
    expect(defaultEntry.mitigation).not.toBeNull()

    expect(screen.getByText(defaultEntry.kri!.name)).toBeInTheDocument()
    expect(screen.getByText(defaultEntry.finding!.ref)).toBeInTheDocument()
    expect(
      screen.getByText(defaultEntry.finding!.title)
    ).toBeInTheDocument()
    // Review finding: the finding card's severity used to be conveyed by
    // a color dot alone, no text -- confirms a real text label renders
    // too, not just the dot. Scoped to the finding card itself since the
    // default risk's own severity ("critical") can coincidentally match
    // the finding's severity and appear on the selector card too.
    const findingCard = screen.getByText(defaultEntry.finding!.ref).closest("div")
    expect(
      within(findingCard as HTMLElement).getByText(
        `riskLevel.${defaultEntry.finding!.severity}`
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(defaultEntry.mitigation!.title)
    ).toBeInTheDocument()
  })

  it("switching to a risk with no linked finding/mitigation shows the truthful empty states, not fabricated cards", async () => {
    const user = userEvent.setup()
    const { container } = render(<ConnectedDataModelSection />)

    const partialEntry = CONNECTED_DEMO_RISKS.find(
      (e) => e.finding === null && e.mitigation === null
    )
    expect(partialEntry).toBeDefined()
    expect(partialEntry!.kri).not.toBeNull()

    await user.click(screen.getByText(partialEntry!.risk.ref))

    // Only the KRI slot has a real link now -> only 1 connector line, not 3
    // -- the connector is semantic (a real relationship), not decoration.
    expect(container.querySelectorAll("svg line")).toHaveLength(1)

    expect(
      screen.getByText("home.connectedDataModel.cards.findingEmpty")
    ).toBeInTheDocument()
    expect(
      screen.getByText("home.connectedDataModel.cards.mitigationEmpty")
    ).toBeInTheDocument()
    // The KRI slot, unlike finding/mitigation, is real for every demo risk
    // -- confirms the empty state is genuinely per-record, not a global
    // "nothing selected" fallback.
    expect(screen.getByText(partialEntry!.kri!.name)).toBeInTheDocument()

    // The previously-shown default risk's finding/mitigation content is
    // gone, not just visually hidden -- the layout stayed the same 3-slot
    // grid (no 4th slot appeared/disappeared) but the content genuinely
    // changed.
    const defaultEntry = CONNECTED_DEMO_RISKS[0]
    expect(
      screen.queryByText(defaultEntry.finding!.title)
    ).not.toBeInTheDocument()
  })

  it("updates the hub and announces the new selection when a different risk is chosen", async () => {
    const user = userEvent.setup()
    render(<ConnectedDataModelSection />)

    const secondRisk = CONNECTED_DEMO_RISKS[1].risk
    await user.click(screen.getByText(secondRisk.ref))

    const status = screen.getByRole("status")
    expect(status).toHaveTextContent(
      "home.connectedDataModel.selectionAnnouncement"
    )

    const group = screen.getByRole("radiogroup")
    const radios = within(group).getAllByRole("radio")
    expect(
      radios.find((r) => within(r).queryByText(secondRisk.ref))
    ).toHaveAttribute("aria-checked", "true")
    const defaultRisk = CONNECTED_DEMO_RISKS[0].risk
    expect(
      radios.find((r) => within(r).queryByText(defaultRisk.ref))
    ).toHaveAttribute("aria-checked", "false")
  })

  // Same established roving-tabindex + arrow-key pattern as
  // RoleScopedRegisterWidget's role picker (PR #1017/#4).
  it("supports arrow-key navigation with roving tabindex across the risk selector", async () => {
    const user = userEvent.setup()
    render(<ConnectedDataModelSection />)

    const group = screen.getByRole("radiogroup")
    const radios = within(group).getAllByRole("radio")
    const first = radios[0]
    const second = radios[1]

    expect(first).toHaveAttribute("tabindex", "0")
    expect(second).toHaveAttribute("tabindex", "-1")

    first.focus()
    await user.keyboard("{ArrowRight}")
    expect(second).toHaveAttribute("aria-checked", "true")
    expect(second).toHaveAttribute("tabindex", "0")
    expect(first).toHaveAttribute("tabindex", "-1")
    expect(second).toHaveFocus()

    await user.keyboard("{End}")
    const last = radios[radios.length - 1]
    expect(last).toHaveAttribute("aria-checked", "true")
    expect(last).toHaveFocus()

    await user.keyboard("{Home}")
    expect(first).toHaveAttribute("aria-checked", "true")
    expect(first).toHaveFocus()
  })

  it("only draws a connector line to slots that have a genuinely linked record", () => {
    const { container } = render(<ConnectedDataModelSection />)
    // Default selection (CYB-014) has all 3 linked -> 3 lines.
    expect(container.querySelectorAll("svg line")).toHaveLength(3)
  })
})
