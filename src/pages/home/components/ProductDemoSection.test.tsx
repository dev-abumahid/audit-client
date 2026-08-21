import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import ProductDemoSection from "./ProductDemoSection"

// This section embeds OverviewView directly (same tree OverviewPreview.tsx
// renders) -- same mocking needs as OverviewPreview.test.tsx: CriticalAlertBanner
// still calls useGetAllAlertsQuery even with alertsOverride (skip:true doesn't
// prevent the call itself, RTK Query hooks can't be conditionally not-called),
// which needs a Redux Provider context this plain render() doesn't set up.
// Mocking the hook module sidesteps needing a real store.
const mockUseGetAllAlertsQuery = vi.fn()
vi.mock("@/redux/apis/organization/alert.api", () => ({
  useGetAllAlertsQuery: (...args: unknown[]) =>
    mockUseGetAllAlertsQuery(...args),
}))

// recharts' ResponsiveContainer never measures a real size under jsdom (0x0
// layout) -- same mocking approach OverviewPreview.test.tsx/Overview.test.tsx
// already use, needed here too since OverviewView renders the same charts.
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

function renderSection() {
  return render(
    <MemoryRouter>
      <ProductDemoSection />
    </MemoryRouter>
  )
}

describe("ProductDemoSection", () => {
  beforeEach(() => {
    mockUseGetAllAlertsQuery.mockReset()
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: undefined,
      isError: false,
    })
  })

  it("renders the section header keys", () => {
    renderSection()
    expect(screen.getByText("home.productDemo.title")).toBeInTheDocument()
    expect(
      screen.getByText("home.productDemo.description")
    ).toBeInTheDocument()
  })

  // Regression test, same class of bug FeaturesSection.test.tsx already
  // guards: only HeroSection's main title should be an <h1>. OverviewView
  // normally renders its own <h1> ("Overview") -- this section must pass
  // titleHeadingLevel="h2" so embedding the real page doesn't introduce a
  // second <h1> onto the landing page.
  it("uses an h2 for its own section header and does not introduce a second h1 via the embedded OverviewView", () => {
    renderSection()
    expect(
      screen.getByRole("heading", { level: 2, name: /home\.productDemo\.title/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    // OverviewView's own page title (raw key, no i18n resources loaded in
    // this test env -- same fallback OverviewPreview.test.tsx relies on)
    // should still render, just demoted to h2, not suppressed entirely.
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "organization.overview.title",
      })
    ).toBeInTheDocument()
  })

  // The whole point of this section: it's the real OverviewView, not a
  // fabricated mockup -- confirm real mock-data-derived content renders,
  // not just the section's own header copy. CYB-014 is the deliberate hub
  // in overviewMockData's MOCK_RISK_LINKS (see OverviewPreview.test.tsx),
  // so its name showing up here proves real mock data flowed all the way
  // through to the Tipping Points panel, not just top-level props.
  it("renders the real OverviewView fed with mock data, not a static mockup", () => {
    renderSection()
    expect(
      screen.getByText("Ransomware exposure via unpatched VPN gateway")
    ).toBeInTheDocument()
  })

  it('shows a "sample data" badge so the demo is not mistaken for a live account', () => {
    renderSection()
    expect(screen.getByText("home.productDemo.badge")).toBeInTheDocument()
  })
})
