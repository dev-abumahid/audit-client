import { render, screen } from "@testing-library/react"
import FindingsOverdueCrop from "./FindingsOverdueCrop"

// The test environment does not initialize i18n, so t() echoes the raw key.
describe("FindingsOverdueCrop", () => {
  it("shows the overdue label only on the overdue row", () => {
    render(<FindingsOverdueCrop />)
    expect(
      screen.getAllByText("organization.findings.overdueLabel")
    ).toHaveLength(1)
  })

  it("renders both sample rows", () => {
    render(<FindingsOverdueCrop />)
    expect(screen.getByText("Vendor access review")).toBeInTheDocument()
    expect(screen.getByText("Fire extinguisher check")).toBeInTheDocument()
  })
})
