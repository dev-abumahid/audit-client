import { render, screen } from "@testing-library/react"
import { MOCK_SITES } from "@/dashboard/organization/overview/overviewMockData"
import ComplianceHeatmapCrop from "./ComplianceHeatmapCrop"

describe("ComplianceHeatmapCrop", () => {
  it("renders real site names from the shared mock fixture, not fabricated ones", () => {
    render(<ComplianceHeatmapCrop />)
    const firstSiteFirstWord = MOCK_SITES[0].name.split(" ")[0]
    expect(screen.getByText(firstSiteFirstWord)).toBeInTheDocument()
  })

  it("renders a compliant/total ratio for every cell", () => {
    render(<ComplianceHeatmapCrop />)
    // 3 sites x 3 domains = 9 cells, each a "n/n" ratio.
    const ratios = screen.getAllByText(/^\d+\/\d+$/)
    expect(ratios).toHaveLength(9)
  })
})
