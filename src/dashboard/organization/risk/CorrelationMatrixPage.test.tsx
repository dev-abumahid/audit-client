import { fireEvent, render, screen } from "@testing-library/react"
import CorrelationMatrixPage from "./CorrelationMatrixPage"

// The page is fully fixture-driven (no data hooks of its own), but SiteFilter
// independently calls useGetAllSitesQuery -- stubbed out so this test file
// stays scoped to the page's own rendering, same pattern RiskGraphPage.test
// uses.
vi.mock("@/components/dashboard/organization/SiteFilter", () => ({
  default: () => null,
}))

describe("CorrelationMatrixPage", () => {
  it("renders the matrix with shared-Risk-shaped fixtures and no legacy human-readable refs", () => {
    render(<CorrelationMatrixPage />)

    // Page renders its header from the shared-shape fixtures without crashing.
    // i18n isn't initialized in the test environment, so t() echoes the raw
    // key back (see RiskRegisterPage.test.tsx).
    expect(
      screen.getByText("organization.correlationMatrix.title")
    ).toBeInTheDocument()

    // The old divergent local Risk type's `ref` values (e.g. "CY-001") no
    // longer exist anywhere -- the fixtures now key off UUID `id` like the
    // shared Risk type in organization.d.ts (issue #142).
    expect(screen.queryByText("CY-001")).not.toBeInTheDocument()
    expect(screen.queryByText("OP-012")).not.toBeInTheDocument()
  })

  it("truncates a full UUID risk id in ref labels and keeps the full id in a title tooltip", () => {
    render(<CorrelationMatrixPage />)

    // Switch the detail panel to the bucket view, then expand the one bucket
    // the operational fixtures form (supply-chain + site-accident risks, both
    // at "Usine Lyon"), which renders each risk's id as a ref label.
    // Button/label text is now routed through t(), which echoes the raw key
    // in the test environment; the bucket name interpolates the localized
    // category label (catOperational) into its accessible name.
    fireEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewBuckets",
      })
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: /organization\.correlationMatrix\.catOperational/,
      })
    )

    const supplyChainId = "7a2e5d9c-1b3f-4c6d-8e0a-2b3f4c6d8e02"

    // The visible label is truncated to the first 8 chars of the UUID...
    const label = screen.getByText("7a2e5d9c")
    expect(label).toBeInTheDocument()
    expect(label.textContent).not.toBe(supplyChainId)

    // ...while the full UUID is preserved in the title tooltip on that label.
    expect(screen.getByTitle(supplyChainId)).toBe(label)
  })
})
