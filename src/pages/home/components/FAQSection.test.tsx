import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import FAQSection from "./FAQSection"

// The test environment does not initialize i18n, so t() echoes the raw key.
describe("FAQSection", () => {
  it("renders the section header keys", () => {
    render(<FAQSection />)
    expect(screen.getByText("home.faq.title1")).toBeInTheDocument()
    expect(screen.getByText("home.faq.title2")).toBeInTheDocument()
    expect(screen.getByText("home.faq.description")).toBeInTheDocument()
  })

  // Regression test: the section header used <h1>, so the landing page had
  // 5 <h1> elements skipping <h2> entirely. Only HeroSection's main title
  // should be an <h1>; every other section header is an <h2>.
  it("uses an h2 for the section header, not an h1", () => {
    render(<FAQSection />)
    expect(
      screen.getByRole("heading", { level: 2, name: /home\.faq/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  // Regression test: accordion toggle buttons had no aria-expanded/
  // aria-controls, and the answer panel had no id/role="region", so screen
  // reader users got no indication of expand/collapse state.
  it("wires aria-expanded and aria-controls on each accordion button, matching a role=region answer panel", async () => {
    const user = userEvent.setup()
    render(<FAQSection />)

    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(5)

    // Index 0 starts open (openIndex defaults to 0).
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true")
    expect(buttons[0]).toHaveAttribute("aria-controls", "faq-answer-0")

    const openRegion = screen.getByRole("region")
    expect(openRegion).toHaveAttribute("id", "faq-answer-0")
    expect(openRegion).toHaveAttribute("aria-labelledby", "faq-question-0")

    // The rest start closed.
    for (let i = 1; i < buttons.length; i++) {
      expect(buttons[i]).toHaveAttribute("aria-expanded", "false")
      expect(buttons[i]).toHaveAttribute("aria-controls", `faq-answer-${i}`)
    }

    // Toggling a different button flips its own state and closes the
    // previous one (accordion behavior is unchanged by this fix).
    await user.click(buttons[1])
    expect(buttons[1]).toHaveAttribute("aria-expanded", "true")
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false")

    const newOpenRegion = screen.getByRole("region")
    expect(newOpenRegion).toHaveAttribute("id", "faq-answer-1")
    expect(newOpenRegion).toHaveAttribute("aria-labelledby", "faq-question-1")
  })

  // Regression test (review-loop finding): the answer panel was previously
  // only mounted while open, so every closed button's aria-controls pointed
  // at an id that didn't exist anywhere in the DOM -- an ARIA reference
  // violation for 4 of 5 buttons on initial render, and all 5 once the open
  // item is collapsed. Every button's aria-controls target must resolve to
  // a real element regardless of open/closed state.
  it("keeps every button's aria-controls target present in the DOM even while collapsed", async () => {
    const user = userEvent.setup()
    const { container } = render(<FAQSection />)

    const buttons = screen.getAllByRole("button")
    for (const button of buttons) {
      const controlsId = button.getAttribute("aria-controls")
      expect(controlsId).toBeTruthy()
      expect(
        container.querySelector(`#${controlsId}`)
      ).not.toBeNull()
    }

    // Collapse the initially-open item (index 0) so nothing is open.
    await user.click(buttons[0])
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false")

    for (const button of buttons) {
      const controlsId = button.getAttribute("aria-controls")
      const panel = container.querySelector(`#${controlsId}`)
      expect(panel).not.toBeNull()
      // Visually/AT-hidden while collapsed, but still a real DOM node.
      expect(panel).toHaveAttribute("hidden")
    }
  })
})
