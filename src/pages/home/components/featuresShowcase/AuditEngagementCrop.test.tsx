import { render, screen } from "@testing-library/react"
import AuditEngagementCrop from "./AuditEngagementCrop"

// The test environment does not initialize i18n, so t() echoes the raw key.
describe("AuditEngagementCrop", () => {
  it("renders both sample engagements with their real status keys", () => {
    render(<AuditEngagementCrop />)
    expect(screen.getByText("AUD-014")).toBeInTheDocument()
    expect(screen.getByText("Q3 Site Safety Review")).toBeInTheDocument()
    expect(
      screen.getByText("organization.audit.statusInProgress")
    ).toBeInTheDocument()

    expect(screen.getByText("AUD-011")).toBeInTheDocument()
    expect(
      screen.getByText("organization.audit.statusCompleted")
    ).toBeInTheDocument()
  })
})
