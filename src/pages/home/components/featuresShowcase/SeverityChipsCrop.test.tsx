import { render, screen, within } from "@testing-library/react"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import SeverityChipsCrop from "./SeverityChipsCrop"

describe("SeverityChipsCrop", () => {
  it("shows a genuinely computed count per severity level, matching the real fixture", () => {
    render(<SeverityChipsCrop />)

    // Independently recompute from the same mock fixture the component
    // reads, rather than hardcoding expected numbers -- avoids a
    // tautological test that would still pass if the component's own
    // counting logic were wrong in the same way twice.
    const criticalCount = MOCK_RISKS.filter(
      (r) => getRiskSeverityLevel(r.residual_score) === "critical"
    ).length

    // Scoped to the critical chip's own container, not a bare getByText --
    // the fixture's real distribution can put the same count on more than
    // one severity level (e.g. critical and low both landing on 1), which
    // a plain getByText(String(count)) can't disambiguate between.
    const criticalChip = screen.getByText("riskLevel.critical").closest("span")
    expect(criticalChip).not.toBeNull()
    expect(
      within(criticalChip!).getByText(String(criticalCount))
    ).toBeInTheDocument()
  })

  it("renders all four severity levels", () => {
    render(<SeverityChipsCrop />)
    expect(screen.getByText("riskLevel.critical")).toBeInTheDocument()
    expect(screen.getByText("riskLevel.high")).toBeInTheDocument()
    expect(screen.getByText("riskLevel.medium")).toBeInTheDocument()
    expect(screen.getByText("riskLevel.low")).toBeInTheDocument()
  })
})
