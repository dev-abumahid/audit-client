import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import OverviewPreview from "./OverviewPreview"

// Smoke test for the preview entry point: it must render OverviewView with
// static mock data and NEVER trigger a live network/query call across any
// of its 8 data domains -- that's the entire point of the preview-proto
// split (Phase B2, same pattern RiskMatrixPreview.test.tsx established in
// Phase B1). Overview.tsx (the authenticated wrapper) is the only place
// that imports these hooks -- OverviewPreview.tsx never does, so mocking
// every module and asserting none of their hooks is invoked proves that
// byte for byte. CriticalAlertBanner's useGetAllAlertsQuery is a different
// story, same as SiteFilter was in Phase B1: that hook IS still called
// (React Hooks can't conditionally not-call a hook), but with RTK Query's
// `skip: true` -- passing it the alertsOverride prop is what turns "called"
// into "does not actually fetch." Both are asserted below.
const mockUseGetAllRisksQuery = vi.fn()
const mockUseGetEbitdaAtRiskSummaryQuery = vi.fn()
const mockUseGetAllKriQuery = vi.fn()
const mockUseGetAllAlertsQuery = vi.fn()
const mockUseGetAllFindingsQuery = vi.fn()
const mockUseGetAllInspectionQuery = vi.fn()
const mockUseGetCorrelationMatrixDataQuery = vi.fn()
const mockUseGetAllSitesQuery = vi.fn()
const mockUseGetMeQuery = vi.fn()

vi.mock("@/redux/apis/auth.api", () => ({
  useGetMeQuery: (...args: unknown[]) => mockUseGetMeQuery(...args),
}))

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
  useGetEbitdaAtRiskSummaryQuery: (...args: unknown[]) =>
    mockUseGetEbitdaAtRiskSummaryQuery(...args),
}))

vi.mock("@/redux/apis/organization/riskLink.api", () => ({
  useGetCorrelationMatrixDataQuery: (...args: unknown[]) =>
    mockUseGetCorrelationMatrixDataQuery(...args),
}))

vi.mock("@/redux/apis/organization/kri.api", () => ({
  useGetAllKriQuery: (...args: unknown[]) => mockUseGetAllKriQuery(...args),
}))

vi.mock("@/redux/apis/organization/alert.api", () => ({
  useGetAllAlertsQuery: (...args: unknown[]) =>
    mockUseGetAllAlertsQuery(...args),
}))

vi.mock("@/redux/apis/organization/findings.api", () => ({
  useGetAllFindingsQuery: (...args: unknown[]) =>
    mockUseGetAllFindingsQuery(...args),
}))

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useGetAllInspectionQuery: (...args: unknown[]) =>
    mockUseGetAllInspectionQuery(...args),
}))

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) => mockUseGetAllSitesQuery(...args),
}))

// assertPreviewOnly() genuinely throws when import.meta.env.DEV is true
// (Vitest's test environment has DEV: true by default, same as a real dev
// server), so rendering this component unmocked would trip the guard here
// too -- correct behavior for a real dev render, just not what this file is
// testing. Mocked out so this file stays focused on OverviewPreview's own
// rendering behavior, not re-validating a guard already covered by
// assertPreviewOnly.test.ts.
vi.mock("@/utils/assertPreviewOnly", () => ({
  assertPreviewOnly: vi.fn(),
}))

// recharts' ResponsiveContainer never measures a real size under jsdom (0x0
// layout) -- same mocking approach as Overview.test.tsx, needed here too
// since OverviewView renders the same charts.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    BarChart: ({ children }: { children: ReactNode }) => (
      <div data-testid="mock-barchart">{children}</div>
    ),
    Pie: () => <div data-testid="mock-pie" />,
    Tooltip: () => <div data-testid="mock-tooltip" />,
  }
})

function renderPreview() {
  return render(
    <MemoryRouter>
      <OverviewPreview />
    </MemoryRouter>
  )
}

describe("OverviewPreview", () => {
  beforeEach(() => {
    mockUseGetAllRisksQuery.mockReset()
    mockUseGetEbitdaAtRiskSummaryQuery.mockReset()
    mockUseGetAllKriQuery.mockReset()
    mockUseGetAllAlertsQuery.mockReset()
    mockUseGetAllFindingsQuery.mockReset()
    mockUseGetAllInspectionQuery.mockReset()
    mockUseGetCorrelationMatrixDataQuery.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockUseGetMeQuery.mockReset()
    // Stubs CriticalAlertBanner's own hook call so it doesn't crash on
    // destructuring undefined -- the hook IS still called (skip:true
    // doesn't prevent the call itself), but must never be relied on for
    // data; see the "skip: true" assertion below for what actually matters.
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: undefined,
      isError: false,
    })
  })

  it("never calls any of the 7 live query hooks or useGetMeQuery, and calls the alerts hook only with skip: true", () => {
    renderPreview()

    expect(mockUseGetAllRisksQuery).not.toHaveBeenCalled()
    expect(mockUseGetEbitdaAtRiskSummaryQuery).not.toHaveBeenCalled()
    expect(mockUseGetAllKriQuery).not.toHaveBeenCalled()
    expect(mockUseGetAllFindingsQuery).not.toHaveBeenCalled()
    expect(mockUseGetAllInspectionQuery).not.toHaveBeenCalled()
    expect(mockUseGetCorrelationMatrixDataQuery).not.toHaveBeenCalled()
    expect(mockUseGetAllSitesQuery).not.toHaveBeenCalled()
    expect(mockUseGetMeQuery).not.toHaveBeenCalled()
    // CriticalAlertBanner is rendered inside OverviewView with
    // alertsOverride forwarded from the mock data, so its own
    // useGetAllAlertsQuery call must be skipped rather than left to
    // actually fetch.
    expect(mockUseGetAllAlertsQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ skip: true })
    )
  })

  it("renders synchronously with mock data -- no loading spinner ever appears", () => {
    renderPreview()

    expect(document.querySelector(".animate-spin")).not.toBeInTheDocument()
  })

  it("does not show the page-level load-error state", () => {
    renderPreview()

    expect(
      screen.queryByText("organization.overview.loadError.title")
    ).not.toBeInTheDocument()
  })

  it("renders the dashboard title and subtitle sourced from mock data (no i18n resources loaded in this test env, so raw keys render, same fallback other test files in this directory rely on)", () => {
    renderPreview()

    expect(screen.getByText("organization.overview.title")).toBeInTheDocument()
    expect(
      screen.getByText("organization.overview.description")
    ).toBeInTheDocument()
  })

  it("renders real-looking mock KPI numbers, not an all-zero dashboard", () => {
    renderPreview()

    // 10 of MOCK_RISKS' 12 risks are status "open".
    expect(
      screen.getByText("organization.overview.activeRisk").parentElement
        ?.textContent
    ).toContain("10")
  })

  it("renders the EBITDA chart with mock data, not the empty/error state", () => {
    renderPreview()

    expect(screen.getByTestId("mock-barchart")).toBeInTheDocument()
    expect(
      screen.queryByText("organization.overview.chart.emptyState")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("organization.overview.chart.loadError")
    ).not.toBeInTheDocument()
  })

  it("renders a Tipping Points risk from the mock correlation-matrix data", () => {
    renderPreview()

    // CYB-014 is the deliberate hub in MOCK_RISK_LINKS -- three risks link
    // to it, so it's the top-ranked (and, at 15% of 9 risks, effectively
    // the only) tipping point.
    expect(
      screen.getByText("Ransomware exposure via unpatched VPN gateway")
    ).toBeInTheDocument()
  })

  it("renders mock alerts in the Recent Alerts panel", () => {
    renderPreview()

    // alert-3 (severity "high") is a non-critical mock alert, so it never
    // appears in CriticalAlertBanner's own critical-only summary above --
    // finding it here proves the Recent Alerts panel specifically (not just
    // the banner) rendered from the mock alert list.
    expect(
      screen.getByText(/New AI-generated risk flagged for Singapore HQ/)
    ).toBeInTheDocument()
  })
})
