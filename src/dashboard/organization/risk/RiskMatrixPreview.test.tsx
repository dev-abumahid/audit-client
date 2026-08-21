import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import RiskMatrixPreview from "./RiskMatrixPreview"

// Smoke test for the preview entry point: it must render RiskMatrixView
// with static mock data and NEVER trigger a live network/query call --
// that's the entire point of the preview-proto split. RiskMatrixPage.tsx
// (the authenticated wrapper) is the only place that imports
// useGetAllRisksQuery -- RiskMatrixPreview.tsx never does, so mocking the
// risk.api module and asserting its hook is never invoked proves that byte
// for byte. SiteFilter's useGetAllSitesQuery is a different story: that
// hook IS still called (React Hooks can't conditionally not-call a hook),
// but with RTK Query's `skip: true` -- passing it the sitesOverride prop is
// what turns "called" into "does not actually fetch." Both are asserted
// below, not just inferred from "no loading spinner shown."
const mockUseGetAllRisksQuery = vi.fn()
const mockUseGetAllSitesQuery = vi.fn()

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) =>
    mockUseGetAllRisksQuery(...args),
}))

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) =>
    mockUseGetAllSitesQuery(...args),
}))

// assertPreviewOnly() now genuinely throws when import.meta.env.DEV is true
// (fixed a real bug where it was dead code -- see assertPreviewOnly.test.ts
// for that guard's own dedicated coverage). Vitest's test environment has
// DEV: true by default, same as a real dev server, so rendering this
// component unmocked would trip the guard here too -- which IS the correct
// behavior for a real dev render, just not what this file is testing.
// Mocked out so this file stays focused on RiskMatrixPreview's own
// rendering behavior, not re-validating a guard already covered elsewhere.
vi.mock("@/utils/assertPreviewOnly", () => ({
  assertPreviewOnly: vi.fn(),
}))

function renderPreview() {
  return render(
    <MemoryRouter>
      <RiskMatrixPreview />
    </MemoryRouter>
  )
}

describe("RiskMatrixPreview", () => {
  beforeEach(() => {
    mockUseGetAllRisksQuery.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    // Stubs SiteFilter's own hook call so it doesn't crash on destructuring
    // undefined -- the hook IS still called (skip:true doesn't prevent the
    // call itself), but must never be relied on for data; see the
    // "skip: true" assertion below for what actually matters here.
    mockUseGetAllSitesQuery.mockReturnValue({ data: undefined, isLoading: false })
  })

  it("never calls the live risks-query hook, and calls the sites-query hook only with skip: true", () => {
    renderPreview()

    expect(mockUseGetAllRisksQuery).not.toHaveBeenCalled()
    // SiteFilter is rendered inside RiskMatrixView with sitesOverride
    // forwarded from the mock data, so its own useGetAllSitesQuery call
    // must be skipped rather than left to actually fetch.
    expect(mockUseGetAllSitesQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true })
    )
  })

  it("renders synchronously with mock data -- no loading spinner ever appears", () => {
    renderPreview()

    expect(document.querySelector(".animate-spin")).not.toBeInTheDocument()
  })

  it("renders the mock risk matrix title", () => {
    renderPreview()

    expect(
      screen.getByText("organization.riskMatrix.title")
    ).toBeInTheDocument()
  })

  it("renders real-looking mock risk data, not an empty matrix", () => {
    renderPreview()

    // The "N risks positioned" subtitle (organization.riskMatrix.des) is
    // only rendered when filteredRisks.length > 0 (RiskMatrixView
    // suppresses it entirely for a genuinely empty dataset, in favor of a
    // dedicated empty-state notice) -- its presence here proves MOCK_RISKS
    // actually reached the rendered matrix, not an empty risks: []
    // fallback. i18n isn't initialized in this test env, so the raw key is
    // what renders, same fallback behavior other test files in this
    // directory rely on.
    expect(
      screen.getByText("organization.riskMatrix.des")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.riskMatrix.emptyStateTitle")
    ).not.toBeInTheDocument()
  })
})
