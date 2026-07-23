import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CompliancePage from "./CompliancePage"

// Labels aren't associated with their inputs via htmlFor, so locate the
// regulation field through its label's wrapping <div>.
function regulationInput(): HTMLInputElement {
  const label = screen.getByText("Regulation *")
  return label.parentElement!.querySelector("input")!
}

describe("CompliancePage", () => {
  it("persists a newly created obligation into the rendered list", async () => {
    const user = userEvent.setup()
    render(<CompliancePage />)

    const NEW = "ZZZ Unique Regulation XYZ"
    expect(screen.queryByText(NEW)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /New Obligation/i }))
    await user.type(regulationInput(), NEW)
    await user.click(screen.getByRole("button", { name: "Create" }))

    // The success UI (modal close) alone isn't enough — the entry must
    // actually appear in the table.
    expect(screen.getByText(NEW)).toBeInTheDocument()
    // Modal is closed.
    expect(
      screen.queryByText("New Compliance Obligation")
    ).not.toBeInTheDocument()
  })

  it("persists an edit to an existing obligation in place", async () => {
    const user = userEvent.setup()
    render(<CompliancePage />)

    // "GDPR" is a known mock obligation (mockCompliance[0]).
    const row = screen.getByText("GDPR").closest("tr")!
    // Within the row: [edit (pencil), delete (trash)] — edit is first.
    await user.click(within(row).getAllByRole("button")[0])

    const input = regulationInput()
    await user.clear(input)
    await user.type(input, "GDPR Amended")
    await user.click(screen.getByRole("button", { name: "Update" }))

    expect(screen.getByText("GDPR Amended")).toBeInTheDocument()
    // The old value no longer renders (replaced in place, not duplicated).
    expect(screen.queryByText("GDPR")).not.toBeInTheDocument()
  })
})
