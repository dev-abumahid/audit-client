import { render, screen } from "@testing-library/react"
import Terms from "./Terms"

// i18n isn't initialized in the test environment, so t() echoes the raw key
// back (see RiskRegisterPage.test.tsx for the same convention).

describe("Terms", () => {
  it("renders the page title", () => {
    render(<Terms />)
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "pages.policy.terms.pageTitle",
      })
    ).toBeInTheDocument()
  })

  // Raw <button>s default to type="submit" per HTML spec, which is a latent
  // bug if this page ever ends up inside a <form>. The only button here
  // (the footer CTA) is a raw <button>.
  it("gives every button an explicit type", () => {
    render(<Terms />)

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })
})
