import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AuditPage from "./AuditPage"

// The Title label isn't associated with its input via htmlFor, so locate it
// through the label's wrapping <div>.
function titleInput(): HTMLInputElement {
  const label = screen.getByText("Title")
  return label.parentElement!.querySelector("input")!
}

describe("AuditPage", () => {
  it("persists a newly created engagement into the rendered list", async () => {
    const user = userEvent.setup()
    render(<AuditPage />)

    const NEW_TITLE = "ZZZ Unique Audit Mission XYZ"
    const NEW_REF = "AUD-2026-999"
    expect(screen.queryByText(NEW_TITLE)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /New Audit Mission/i }))
    await user.type(screen.getByPlaceholderText("AUD-2026-001"), NEW_REF)
    await user.type(titleInput(), NEW_TITLE)
    await user.click(screen.getByRole("button", { name: "Create" }))

    // The entry must actually appear in the list, not just close the modal.
    expect(screen.getByText(NEW_TITLE)).toBeInTheDocument()
    expect(screen.getByText(NEW_REF)).toBeInTheDocument()
    expect(
      screen.queryByText("New Audit Engagement")
    ).not.toBeInTheDocument()
  })

  it("persists an edit to an existing engagement in place", async () => {
    const user = userEvent.setup()
    render(<AuditPage />)

    // "Supply Chain Risk Audit" is a known mock engagement (index 0).
    const card = screen
      .getByText("Supply Chain Risk Audit")
      .closest("[class*='rounded-xl']")! as HTMLElement
    // Within the card the actionable buttons are [edit, delete]; the Upload
    // Report control is a <label>, not a button.
    await user.click(within(card).getAllByRole("button")[0])

    const input = titleInput()
    await user.clear(input)
    await user.type(input, "Supply Chain Risk Audit EDITED")
    await user.click(screen.getByRole("button", { name: "Update" }))

    expect(
      screen.getByText("Supply Chain Risk Audit EDITED")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Supply Chain Risk Audit")
    ).not.toBeInTheDocument()
  })
})
