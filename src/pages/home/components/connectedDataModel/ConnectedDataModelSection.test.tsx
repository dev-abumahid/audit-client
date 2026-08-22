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

  it("has a Register entry card (different fields than the hub) but no 'Control' card", () => {
    render(<ConnectedDataModelSection />)
    expect(
      screen.getByText("home.connectedDataModel.cards.register")
    ).toBeInTheDocument()
    // No standalone Control entity exists in this data model -- confirmed
    // via source inspection (control_design_eff/control_operating_eff live
    // directly on Risk) -- so there's deliberately no Control card here.
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

  it("renders the register card's own real fields (status, line of defense) -- not a duplicate of the hub", () => {
    render(<ConnectedDataModelSection />)
    const defaultRisk = CONNECTED_DEMO_RISKS[0].risk
    // Real Risk.status value, not a re-labeled/invented one.
    expect(screen.getByText(defaultRisk.status, { exact: false })).toBeInTheDocument()
  })

  it("switching risk swaps every card's content -- register, KRI, finding, and mitigation all update together", async () => {
    const user = userEvent.setup()
    const { container } = render(<ConnectedDataModelSection />)

    const defaultEntry = CONNECTED_DEMO_RISKS[0]
    const nextEntry = CONNECTED_DEMO_RISKS[1]
    // Every demo risk now has a real KRI/finding/mitigation -- all 4
    // connector paths draw for any selection, not a variable count.
    const connectorPaths = () =>
      container.querySelectorAll(".animate-cdm-draw")
    expect(connectorPaths()).toHaveLength(4)

    await user.click(screen.getByText(nextEntry.risk.ref))

    expect(connectorPaths()).toHaveLength(4)
    expect(screen.getByText(nextEntry.kri!.name)).toBeInTheDocument()
    expect(screen.getByText(nextEntry.finding!.ref)).toBeInTheDocument()
    expect(screen.getByText(nextEntry.mitigation!.title)).toBeInTheDocument()

    // The previously-shown default risk's content is gone, not just
    // visually hidden -- the layout stayed the same 4-slot grid but the
    // content genuinely changed.
    expect(
      screen.queryByText(defaultEntry.finding!.title)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(defaultEntry.mitigation!.title)
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

  it("renders a KRI current-value trend sparkline without asserting specific dates", () => {
    // The sparkline is illustrative motion toward the real current_value
    // (KRI has no historical-value field anywhere in the schema/mock
    // data) -- confirms it renders as an undated polyline, not something
    // that could misread as a real dated history.
    const { container } = render(<ConnectedDataModelSection />)
    const sparkline = container.querySelector("svg polyline")
    expect(sparkline).toBeInTheDocument()
    expect(screen.queryByText(/jan|feb|mar|apr|may|jun/i)).not.toBeInTheDocument()
  })
})
