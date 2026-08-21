import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ConnectedDataModelSection from "./ConnectedDataModelSection"

// The test environment does not initialize i18n, so t() echoes the raw key
// -- same convention as the other landing-page widget tests.
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

  it("renders the same real risk ref on both the center card and the register satellite", () => {
    render(<ConnectedDataModelSection />)
    // CYB-014 is the real ref of MOCK_RISKS[0] (overviewMockData.ts) --
    // appears once on the center card, once on the register satellite.
    expect(screen.getAllByText("CYB-014")).toHaveLength(2)
  })

  it("renders the real linked KRI, audit finding, and mitigation", () => {
    render(<ConnectedDataModelSection />)
    expect(
      screen.getByText("Unpatched critical CVEs on internet-facing systems")
    ).toBeInTheDocument()
    expect(screen.getByText("AUD-014-F1")).toBeInTheDocument()
    expect(
      screen.getByText("Patch and isolate the VPN concentrator")
    ).toBeInTheDocument()
  })

  it("toggles the shared highlight ring across all five cards on click, simultaneously", async () => {
    const user = userEvent.setup()
    render(<ConnectedDataModelSection />)
    const cards = screen.getAllByRole("button")
    expect(cards).toHaveLength(5)

    cards.forEach((card) =>
      expect(card.className).not.toContain("ring-2")
    )

    await user.click(cards[0])

    // Clicking any one card rings all five -- the shared state, not a
    // per-card toggle -- since the interaction's whole point is that they
    // represent the same underlying record.
    cards.forEach((card) => expect(card.className).toContain("ring-2"))

    await user.click(cards[2])
    cards.forEach((card) => expect(card.className).not.toContain("ring-2"))
  })

  // Review finding on PR #1021: aria-pressed on 5 buttons sharing one
  // boolean was a real ARIA misuse (that attribute means "this control's
  // own state," not an unrelated global flag). Replaced with role="group"
  // plus a single aria-live announcement -- verify both landed.
  it("groups the 5 cards with a labeled role=group and announces the highlight once via aria-live, not per-button aria-pressed", async () => {
    const user = userEvent.setup()
    render(<ConnectedDataModelSection />)

    expect(
      screen.getByRole("group", {
        name: "home.connectedDataModel.groupLabel",
      })
    ).toBeInTheDocument()
    screen
      .getAllByRole("button")
      .forEach((card) => expect(card).not.toHaveAttribute("aria-pressed"))

    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("")

    await user.click(screen.getAllByRole("button")[0])
    expect(status).toHaveTextContent(
      "home.connectedDataModel.highlightAnnouncement"
    )
  })
})
