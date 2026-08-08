import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import Overview from "./Overview"
import enTranslations from "@/i18n/locales/en.json"
import frTranslations from "@/i18n/locales/fr.json"

// aexa-frontend#529 cross-linking sweep: a tipping-point risk's name is now
// a <Link> to its detail page, so this needs a Router context -- same
// convention as InspectionTable.test.tsx's renderTable().
function renderPage() {
  return render(
    <MemoryRouter>
      <Overview />
    </MemoryRouter>
  )
}

// This file never triggers src/i18n/i18n.ts's side-effect init, so
// react-i18next's real t() falls back to returning the raw key with no
// interpolation for every other assertion here. That fallback can't
// reproduce the "1 identified risks" hardcoded-singular-with-no-pluralization
// bug (organization.overview.category.des_one/_other), since i18next's
// plural-suffix resolution only kicks in once real resources/pluralization
// rules are loaded. Overriding just this one key, with the same
// singular/plural behavior the real en.json resource now has, lets the test
// tell the fixed des_one/_other split apart from the old un-pluralized "des"
// key -- every other key still falls back to itself unchanged. Same
// technique as CompliancePage.test.tsx.
// mockLanguage feeds `i18n.language` through to the real hook's `i18n`
// object below, so the round-3 audit fix (Recent Alerts date now going
// through formatLocaleDate(alert.createdAt, i18n.language, ...) instead of
// being hardcoded to "fr-FR") can be exercised by the locale test further
// down -- same convention as TeamMembersTab.test.tsx.
let mockLanguage: string | undefined = undefined
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return {
        ...real,
        i18n: { ...real.i18n, language: mockLanguage },
        t: (key: string, opts?: Record<string, unknown>) => {
          if (key === "organization.overview.category.des") {
            const count = Number(opts?.count ?? 0)
            return count === 1
              ? `${count} identified risk`
              : `${count} identified risks`
          }
          // Regression (audit round 3): this stat's i18n key was
          // "p5Median" ("P5 (Median)") but the value shown next to it
          // (€20.8M) is ebitdaData's P50 entry, not P5 -- the label and the
          // number it labels disagreed. Renamed the key to p50Median with a
          // "P50 (Median)" label. Override it here (same technique as the
          // des key above) so the assertion below can tell the fixed label
          // apart from the old mismatched one.
          if (key === "organization.overview.chart.p50Median") {
            return "P50 (Median)"
          }
          // aexa-frontend#471 -- real interpolation override (same
          // technique as the des key above) so the org-name tests below can
          // assert on the actual interpolated subtitle rather than the raw
          // un-interpolated key every other key in this file falls back to.
          if (key === "organization.overview.description") {
            return `Consolidated Risk View — ${opts?.orgName}`
          }
          return key
        },
      }
    },
  }
})

const mockUseGetAllRisksQuery = vi.fn()
const mockUseGetAllKriQuery = vi.fn()
const mockUseGetAllAlertsQuery = vi.fn()
const mockUseGetAllFindingsQuery = vi.fn()
const mockUseGetAllInspectionQuery = vi.fn()
const mockUseGetCorrelationMatrixDataQuery = vi.fn()
const mockUseGetAllSitesQuery = vi.fn()
// aexa-frontend#471 -- Overview now reads the real org name via
// useGetMeQuery for the subtitle (replacing the hardcoded "CEBI
// International S.A." fixture), same mocking convention as every other
// query hook on this page.
const mockUseGetMeQuery = vi.fn()

vi.mock("@/redux/apis/auth.api", () => ({
  useGetMeQuery: (...args: unknown[]) => mockUseGetMeQuery(...args),
}))

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) =>
    mockUseGetAllRisksQuery(...args),
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

// CriticalAlertBanner independently calls useGetAllAlertsQuery too --
// stubbed out so this test file stays scoped to Overview's own data wiring.
vi.mock("@/components/dashboard/organization/CriticalAlertBanner", () => ({
  default: () => null,
}))

// recharts' ResponsiveContainer never measures a real size under jsdom (0x0
// layout), so <Pie> never actually renders -- there's no way to observe the
// paddingAngle regression (issue #354: a single-category pie rendered as an
// invisible sliver because paddingAngle={3} still applied a gap with only
// one slice) by inspecting real SVG output. Mocking just <Pie> to capture
// the props it was called with -- and <ResponsiveContainer> to render its
// children directly instead of deferring to a real-size measurement -- lets
// the test assert on paddingAngle itself rather than pixel geometry.
let capturedPieProps: Record<string, unknown> | undefined
// Captures every <Tooltip> the component renders, in render order, so a test
// can pick out the EBITDA area chart's specifically (it's the one with a
// `formatter` prop -- the category pie's Tooltip below it has none) and
// invoke that formatter directly to check for the regression in #402
// (formatter was commented out, leaving raw unformatted numbers on hover).
let capturedTooltipProps: Record<string, unknown>[] = []
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    // Real PieChart/AreaChart skip rendering their children entirely when
    // they haven't received explicit width/height (which only the real
    // ResponsiveContainer's ResizeObserver-based measurement supplies --
    // absent under jsdom's 0x0 layout regardless of the ResponsiveContainer
    // mock above). Mocking them to render children unconditionally
    // sidesteps that, which is also what lets the mocked <Tooltip> below
    // actually get invoked so its props can be captured.
    PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AreaChart: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    Pie: (props: Record<string, unknown>) => {
      capturedPieProps = props
      return <div data-testid="mock-pie" />
    },
    Tooltip: (props: Record<string, unknown>) => {
      capturedTooltipProps.push(props)
      return <div data-testid="mock-tooltip" />
    },
  }
})

function makeRisk(overrides = {}) {
  return {
    id: "risk-1",
    org_account_id: "org-1",
    ref: "RSK-001",
    name: "Supply Chain Disruption",
    description: "Delays in raw material delivery",
    category: "supply_chain",
    inherent_score: 20,
    residual_score: 5,
    pagerank_score: 0.72,
    financial_impact_min: 50000,
    financial_impact_max: 200000,
    probability: 0.6,
    velocity: "Medium",
    trend: "Increasing",
    status: "open",
    ai_generated: false,
    is_edited: false,
    site_id: "site-1",
    control_design_eff: 0,
    control_operating_eff: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeKri(overrides = {}) {
  return { id: "kri-1", status: "OK", ...overrides }
}

function makeFinding(overrides = {}) {
  return {
    id: "action-1",
    orgAccountId: "org-1",
    inspectionId: "insp-1",
    siteId: "site-1",
    questionId: null,
    actionTitle: "Fix loading dock signage",
    actionDisc: null,
    priority: "Medium",
    dueDate: "2026-08-01T00:00:00.000Z",
    status: "TO_DO",
    site: null,
    messages: [],
    assignBy: [],
    attachments: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeInspection(overrides = {}) {
  return {
    id: "insp-1",
    status: "IN_PROGRESS",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    template: { id: "tpl-1", templateName: "Fire Safety" },
    site: { id: "site-1", name: "Main Warehouse" },
    inspector: { id: "user-1", fullName: "Jamie Doe" },
    ...overrides,
  }
}

function makeAlert(overrides = {}) {
  return {
    id: "alert-1",
    org_account_id: "org-1",
    kri_id: null,
    source: "KRI Monitor",
    type: "threshold",
    severity: "high",
    title: "Overdue actions exceeded threshold",
    description: null,
    is_read: false,
    ai_generated: false,
    createdAt: "2026-06-21T10:00:00.000Z",
    updatedAt: "2026-06-21T10:00:00.000Z",
    ...overrides,
  }
}

describe("Overview", () => {
  beforeEach(() => {
    capturedPieProps = undefined
    capturedTooltipProps = []
    mockLanguage = undefined
    mockUseGetAllRisksQuery.mockReset()
    mockUseGetAllKriQuery.mockReset()
    mockUseGetAllAlertsQuery.mockReset()
    mockUseGetAllFindingsQuery.mockReset()
    mockUseGetAllInspectionQuery.mockReset()
    mockUseGetCorrelationMatrixDataQuery.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockUseGetMeQuery.mockReset()
    mockUseGetMeQuery.mockReturnValue({
      data: {
        data: { organizationProfile: { organizationName: "Acme Corp" } },
      },
      isLoading: false,
    })
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllKriQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllAlertsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllFindingsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllInspectionQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: { data: { risks: [], riskLinks: [], actions: [] } },
      isLoading: false,
    })
    mockUseGetAllSitesQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
  })

  it("shows a loading state while any of risks/KRIs/alerts/actions/inspections are loading", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: undefined, isLoading: true })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows a loading state while the risk-correlation graph is loading", () => {
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows a loading state while findings/inspections specifically are loading", () => {
    mockUseGetAllInspectionQuery.mockReturnValue({ data: undefined, isLoading: true })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows a loading state while sites are loading", () => {
    mockUseGetAllSitesQuery.mockReturnValue({ data: undefined, isLoading: true })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  // quality-bar-loop round 1 (resilience axis, scored 3/10): none of the
  // seven queries checked isError, only isLoading -- a total backend
  // failure fell through to every derived value defaulting to `?? []`/`0`,
  // rendering a fully normal-looking dashboard with every metric at zero
  // and no visual cue that data failed to load at all. Live-verified by
  // killing the backend and reloading /organization before this fix.
  describe("load error handling (quality-bar-loop round 1)", () => {
    it("shows an error state instead of a silently-zeroed dashboard when risks fail to load", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      })
      renderPage()

      expect(
        screen.getByText("organization.overview.loadError.title")
      ).toBeInTheDocument()
      // The real dashboard content must NOT render alongside the error --
      // a user should never see both "couldn't load" and a set of (fake,
      // all-zero) metric numbers at the same time.
      expect(
        screen.queryByText("organization.overview.activeRisk")
      ).not.toBeInTheDocument()
    })

    it("shows the error state when any of the other six queries fail, not just risks", () => {
      mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      })
      renderPage()

      expect(
        screen.getByText("organization.overview.loadError.title")
      ).toBeInTheDocument()
    })

    it("does not show the error state when every query succeeds", () => {
      renderPage()

      expect(
        screen.queryByText("organization.overview.loadError.title")
      ).not.toBeInTheDocument()
    })

    it("reloads the page when the retry button is clicked", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllAlertsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      })
      renderPage()

      const reloadSpy = vi.fn()
      Object.defineProperty(window, "location", {
        value: { reload: reloadSpy },
        writable: true,
      })

      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.overview.loadError.retry",
        })
      )

      expect(reloadSpy).toHaveBeenCalledTimes(1)
    })
  })

  // Regression (issue #354): paddingAngle={3} on the "Risks by category"
  // Pie applied a gap even with a single slice, rendering it as an
  // invisible sliver instead of a full ring.
  it("disables paddingAngle on the category pie when only one category exists", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "r1", category: "cyber" }),
          makeRisk({ id: "r2", category: "cyber" }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    expect(capturedPieProps?.paddingAngle).toBe(0)
  })

  it("keeps paddingAngle on the category pie when multiple categories exist", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "r1", category: "cyber" }),
          makeRisk({ id: "r2", category: "financial" }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    expect(capturedPieProps?.paddingAngle).toBe(3)
  })

  // Regression (issue #355): 6 MetricCards in a 4-column grid left the last
  // row half-empty (4 + 2). lg:grid-cols-3 divides 6 evenly into 2 full rows.
  it("lays the 6 metric cards out in a grid that divides evenly", () => {
    const { container } = renderPage()

    const metricsGrid = container.querySelector(".grid.gap-4")
    expect(metricsGrid).toHaveClass("lg:grid-cols-3")
    expect(metricsGrid).not.toHaveClass("lg:grid-cols-4")
  })

  it("counts real open risks, not a hardcoded fixture", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "r1", status: "open" }),
          makeRisk({ id: "r2", status: "open" }),
          makeRisk({ id: "r3", status: "closed" }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("counts real KRIs in ALERT status", () => {
    mockUseGetAllKriQuery.mockReturnValue({
      data: {
        data: [
          makeKri({ id: "k1", status: "ALERT" }),
          makeKri({ id: "k2", status: "ALERT" }),
          makeKri({ id: "k3", status: "OK" }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("counts real critical alerts", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: "a1", severity: "critical" }),
          makeAlert({ id: "a2", severity: "high" }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("counts real open actions (TO_DO/IN_PROGRESS), not COMPLETE/CANT_DO", () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        data: [
          makeFinding({ id: "f1", status: "TO_DO" }),
          makeFinding({ id: "f2", status: "IN_PROGRESS" }),
          makeFinding({ id: "f3", status: "COMPLETE" }),
          makeFinding({ id: "f4", status: "CANT_DO" }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("counts real active inspections (DRAFT/IN_PROGRESS), not COMPLETED/CANCELLED", () => {
    mockUseGetAllInspectionQuery.mockReturnValue({
      data: {
        data: [
          makeInspection({ id: "i1", status: "DRAFT" }),
          makeInspection({ id: "i2", status: "IN_PROGRESS" }),
          makeInspection({ id: "i3", status: "IN_PROGRESS" }),
          makeInspection({ id: "i4", status: "COMPLETED" }),
          makeInspection({ id: "i5", status: "CANCELLED" }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("3")).toBeInTheDocument()
  })

  // Regression (issue #427): the Revenue KPI card hardcoded "€8.6M" with no
  // backing query, even though a real per-site `revenue` field exists
  // (sites.api.ts). It must now be a real sum of site.revenue across the
  // org, not the old hardcoded fixture value.
  it("sums real per-site revenue for the Revenue KPI card, not a hardcoded fixture", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: {
        data: [
          { id: "s1", name: "Site A", revenue: 3_200_000, employees_count: 10, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
          { id: "s2", name: "Site B", revenue: 1_800_000, employees_count: 5, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
        ],
      },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("€5.0M")).toBeInTheDocument()
    expect(screen.queryByText("€8.6M")).not.toBeInTheDocument()
  })

  it("renders a real alert's title and source in the Recent Alerts list", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert()] },
      isLoading: false,
    })
    renderPage()

    expect(
      screen.getByText("Overdue actions exceeded threshold")
    ).toBeInTheDocument()
    expect(screen.getByText("KRI Monitor")).toBeInTheDocument()
  })

  // aexa-frontend#543: same cross-link AlertsPage.tsx already exposes for
  // #530 -- this widget showed the same alerts with no way to reach the
  // KRI they came from.
  it("links to the underlying KRI when an alert has a kri_id", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ kri_id: "kri-1" })] },
      isLoading: false,
    })
    renderPage()

    const link = screen.getByRole("link", {
      name: "organization.alerts.viewKri",
    })
    expect(link).toHaveAttribute(
      "href",
      "/organization/kri?highlight=kri-1"
    )
  })

  it("does not show a KRI link for an alert with no kri_id", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ kri_id: null })] },
      isLoading: false,
    })
    renderPage()

    expect(
      screen.queryByRole("link", { name: "organization.alerts.viewKri" })
    ).not.toBeInTheDocument()
  })

  it("shows the risk most linked-to by others in Tipping Points, ranked above a less-connected risk", () => {
    // Tipping Points reads its risk list from the correlation-matrix response
    // (unpaginated), not the useGetAllRisksQuery one (capped at limit:100 for
    // the other cards on this page) — see Overview.tsx's own comment on why.
    const tippingRisks = [
      makeRisk({ id: "r1", ref: "CYB-001", name: "Central Cyber Risk" }),
      makeRisk({ id: "r2", ref: "OPS-001", name: "Peripheral Ops Risk" }),
      makeRisk({ id: "r3", ref: "FIN-001", name: "Another Feeder Risk" }),
      makeRisk({ id: "r4", ref: "LEG-001", name: "Yet Another Feeder" }),
    ]
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: tippingRisks },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          risks: tippingRisks,
          riskLinks: [
            { id: "l1", org_account_id: "org-1", source_ref: "OPS-001", target_ref: "CYB-001", link_type: "CAUSES", createdAt: "2026-06-01T00:00:00.000Z" },
            { id: "l2", org_account_id: "org-1", source_ref: "FIN-001", target_ref: "CYB-001", link_type: "AMPLIFIES", createdAt: "2026-06-01T00:00:00.000Z" },
            { id: "l3", org_account_id: "org-1", source_ref: "LEG-001", target_ref: "CYB-001", link_type: "CAUSES", createdAt: "2026-06-01T00:00:00.000Z" },
          ],
          actions: [],
        },
      },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText("Central Cyber Risk")).toBeInTheDocument()
    expect(screen.queryByText("Peripheral Ops Risk")).not.toBeInTheDocument()
  })

  it("still surfaces a linked hub risk in Tipping Points even when it falls outside the paginated risks list (review fix)", () => {
    // useGetAllRisksQuery is capped at limit:100 for the other cards on this
    // page; GET /risk/correlation-matrix (useGetCorrelationMatrixDataQuery)
    // returns every risk in the org with no such cap. A risk beyond the
    // paginated page-1 window must still be computable/renderable as a
    // tipping point from the correlation-matrix response alone.
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "r1", ref: "CYB-001" })] },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          risks: [
            makeRisk({ id: "r1", ref: "CYB-001" }),
            makeRisk({
              id: "r101",
              ref: "HUB-101",
              name: "Hub Beyond The Page Limit",
            }),
            makeRisk({ id: "r102", ref: "FEEDER-102" }),
          ],
          riskLinks: [
            { id: "l1", org_account_id: "org-1", source_ref: "FEEDER-102", target_ref: "HUB-101", link_type: "CAUSES", createdAt: "2026-06-01T00:00:00.000Z" },
          ],
          actions: [],
        },
      },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText("Hub Beyond The Page Limit")).toBeInTheDocument()
  })

  it("groups real risks by category for the category breakdown chart", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "r1", ref: "CYB-001", category: "cyber" }),
          makeRisk({ id: "r2", ref: "CYB-002", category: "cyber" }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    // Category labels resolve through t() (organization.riskCategories.*, not
    // a hardcoded string — aexa-frontend#197); this repo's tests assert the
    // raw i18n key since translation isn't wired up in the test environment
    // (matches the convention elsewhere, e.g. OrgSettingPage.test.tsx). Both
    // the category chart's legend and the Tipping Points card (one of these
    // two same-category risks always qualifies as a tipping point, absent any
    // real ranking signal between them) render this key — assert at least
    // one rather than pinning down which element it is.
    expect(
      screen.getAllByText("organization.riskCategories.catCyber").length
    ).toBeGreaterThan(0)
  })

  // Regression (audit round 4 / #341): this page imported the old, smaller
  // 8-category `riskCategories` from @/data/mockData instead of the current
  // 20-category `RISK_CATEGORIES` from @/utils/riskConfig that
  // RiskRegisterPage.tsx/RiskMatrixPage.tsx already use -- so any risk in one
  // of the 12 newer categories (geopolitical, technology, compliance, etc.)
  // fell back to showing its raw category slug instead of a translated
  // label. "geopolitical" only exists in the newer 20-category set.
  it("resolves a category that only exists in the newer 20-category RISK_CATEGORIES set (not the old 8-category mockData one)", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "r1", ref: "GEO-001", category: "geopolitical" }),
          makeRisk({ id: "r2", ref: "GEO-002", category: "geopolitical" }),
        ],
      },
      isLoading: false,
    })
    renderPage()

    expect(
      screen
        .getAllByText("organization.riskCategories.catGeopolitical")
        .length
    ).toBeGreaterThan(0)
    expect(screen.queryByText("geopolitical")).not.toBeInTheDocument()
  })

  it("shows an empty state in Tipping Points when there are no tipping-point risks", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: { data: { risks: [], riskLinks: [], actions: [] } },
      isLoading: false,
    })
    renderPage()

    expect(
      screen.getByText("organization.overview.bottomRow.empty")
    ).toBeInTheDocument()
  })

  it("pluralizes the Risk by category subtitle for a single risk (regression: used to show '1 identified risks')", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "r1" })] },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("1 identified risk")).toBeInTheDocument()
    expect(screen.queryByText("1 identified risks")).not.toBeInTheDocument()
  })

  it("uses the plural form of the Risk by category subtitle for multiple risks", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [makeRisk({ id: "r1" }), makeRisk({ id: "r2", ref: "RSK-002" })],
      },
      isLoading: false,
    })
    renderPage()

    expect(screen.getByText("2 identified risks")).toBeInTheDocument()
  })

  it("labels the EBITDA median stat P50, not P5 (the value shown is ebitdaData's P50 entry)", () => {
    renderPage()

    expect(screen.getByText(/P50 \(Median\)/)).toBeInTheDocument()
    expect(screen.queryByText(/P5 \(Median\)/)).not.toBeInTheDocument()
  })

  it("shows an empty state in Recent Alerts when there are no alerts", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    renderPage()

    expect(
      screen.getByText("organization.overview.alert.empty")
    ).toBeInTheDocument()
  })

  it("does not show the Recent Alerts empty state when alerts are present", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert()] },
      isLoading: false,
    })
    renderPage()

    expect(
      screen.queryByText("organization.overview.alert.empty")
    ).not.toBeInTheDocument()
  })

  // aexa-frontend round-3 audit bug #4: the Recent Alerts date was
  // hardcoded to "fr-FR" regardless of the active UI language -- the
  // opposite-direction bug from #3 (other pages hardcoded "en-US"), same
  // root fix (formatLocaleDate driven by i18n.language).
  it("formats the Recent Alerts date in English when the UI language is English", () => {
    mockLanguage = "en"
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert({ createdAt: "2026-06-21T10:00:00.000Z" })] },
      isLoading: false,
    })
    renderPage()

    const expectedEn = new Date(
      "2026-06-21T10:00:00.000Z"
    ).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    const expectedFr = new Date(
      "2026-06-21T10:00:00.000Z"
    ).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    expect(screen.getByText(expectedEn)).toBeInTheDocument()
    if (expectedEn !== expectedFr) {
      expect(screen.queryByText(expectedFr)).not.toBeInTheDocument()
    }
  })

  // Regression (issue #402): the EBITDA area chart's Tooltip formatter was
  // commented out, so hovering showed raw unformatted numbers ("23100")
  // instead of currency-formatted EBITDA ("€23.1M"), unlike every other
  // number on this card (legend, Y-axis).
  it("formats the EBITDA chart tooltip as currency, matching the Y-axis/legend formatting", () => {
    renderPage()

    const ebitdaTooltip = capturedTooltipProps.find(
      (props) => typeof props.formatter === "function"
    )
    expect(ebitdaTooltip).toBeDefined()

    const formatter = ebitdaTooltip!.formatter as (
      value: number
    ) => [string, string]
    expect(formatter(23100)).toEqual(["€23.1M", "EBITDA"])
  })

  // Regression (issue #403): the Recent Alerts subtitle claimed "Last 48
  // hours — sorted by relevance", but the code just takes alerts.slice(0, 4)
  // with no time filter or sort -- the same false-claim pattern issue #108
  // already found and removed from CriticalAlertBanner.tsx's relevance
  // badge. The copy must not claim behavior the component doesn't implement.
  it("does not claim a 48-hour window or relevance sort the component doesn't implement", () => {
    expect(enTranslations.organization.overview.alert.des).not.toMatch(
      /48 hours?/i
    )
    expect(enTranslations.organization.overview.alert.des).not.toMatch(
      /relevance/i
    )
    expect(frTranslations.organization.overview.alert.des).not.toMatch(
      /48 heures?/i
    )
    expect(frTranslations.organization.overview.alert.des).not.toMatch(
      /pertinence/i
    )
  })

  // aexa-frontend#471 -- organization.overview.description hardcoded a
  // fictional company name ("CEBI International S.A.") under every
  // organization's dashboard. It now interpolates the real org name from
  // useGetMeQuery, matching OrgSettingPage.tsx's own use of the same field.
  describe("organization name in the dashboard subtitle", () => {
    it("does not hardcode a fictional company name in either locale", () => {
      expect(enTranslations.organization.overview.description).not.toMatch(
        /CEBI/i
      )
      expect(frTranslations.organization.overview.description).not.toMatch(
        /CEBI/i
      )
    })

    it("interpolates the real organization name from /auth/me", () => {
      mockUseGetMeQuery.mockReturnValue({
        data: {
          data: {
            organizationProfile: { organizationName: "Northwind Trading" },
          },
        },
        isLoading: false,
      })
      renderPage()
      expect(screen.getByText(/Northwind Trading/)).toBeInTheDocument()
    })

    it("falls back to a generic placeholder while /auth/me has no org name yet", () => {
      mockUseGetMeQuery.mockReturnValue({
        data: { data: null },
        isLoading: false,
      })
      renderPage()
      // t() falls back to echoing the raw key in this test env for
      // defaultOrgName (not specifically overridden above), so the
      // interpolated description contains the raw key as the fallback name.
      expect(
        screen.getByText(/organization\.overview\.defaultOrgName/)
      ).toBeInTheDocument()
    })
  })

  // aexa-frontend#471 -- h1 used to be followed directly by four h3 section
  // headings with no h2 in between, breaking heading-level order for
  // screen-reader users.
  it("has an h2 between the page h1 and its h3 section headings", () => {
    renderPage()

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(
      screen.getAllByRole("heading", { level: 2 }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole("heading", { level: 3 }).length
    ).toBeGreaterThan(0)
  })
})
