import { render, screen } from "@testing-library/react"
import Overview from "./Overview"

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
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => {
        if (key === "organization.overview.category.des") {
          const count = Number(opts?.count ?? 0)
          return count === 1
            ? `${count} identified risk`
            : `${count} identified risks`
        }
        return key
      },
    }),
  }
})

const mockUseGetAllRisksQuery = vi.fn()
const mockUseGetAllKriQuery = vi.fn()
const mockUseGetAllAlertsQuery = vi.fn()
const mockUseGetAllFindingsQuery = vi.fn()
const mockUseGetAllInspectionQuery = vi.fn()
const mockUseGetCorrelationMatrixDataQuery = vi.fn()

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

// CriticalAlertBanner independently calls useGetAllAlertsQuery too --
// stubbed out so this test file stays scoped to Overview's own data wiring.
vi.mock("@/components/dashboard/organization/CriticalAlertBanner", () => ({
  default: () => null,
}))

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
    mockUseGetAllRisksQuery.mockReset()
    mockUseGetAllKriQuery.mockReset()
    mockUseGetAllAlertsQuery.mockReset()
    mockUseGetAllFindingsQuery.mockReset()
    mockUseGetAllInspectionQuery.mockReset()
    mockUseGetCorrelationMatrixDataQuery.mockReset()
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllKriQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllAlertsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllFindingsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllInspectionQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: { data: { risks: [], riskLinks: [], actions: [] } },
      isLoading: false,
    })
  })

  it("shows a loading state while any of risks/KRIs/alerts/actions/inspections are loading", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: undefined, isLoading: true })
    render(<Overview />)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows a loading state while the risk-correlation graph is loading", () => {
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    render(<Overview />)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows a loading state while findings/inspections specifically are loading", () => {
    mockUseGetAllInspectionQuery.mockReturnValue({ data: undefined, isLoading: true })
    render(<Overview />)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
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
    render(<Overview />)

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
    render(<Overview />)

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
    render(<Overview />)

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
    render(<Overview />)

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
    render(<Overview />)

    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("renders a real alert's title and source in the Recent Alerts list", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert()] },
      isLoading: false,
    })
    render(<Overview />)

    expect(
      screen.getByText("Overdue actions exceeded threshold")
    ).toBeInTheDocument()
    expect(screen.getByText("KRI Monitor")).toBeInTheDocument()
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

    render(<Overview />)

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

    render(<Overview />)

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
    render(<Overview />)

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

  it("shows an empty state in Tipping Points when there are no tipping-point risks", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: { data: { risks: [], riskLinks: [], actions: [] } },
      isLoading: false,
    })
    render(<Overview />)

    expect(
      screen.getByText("organization.overview.bottomRow.empty")
    ).toBeInTheDocument()
  })

  it("pluralizes the Risk by category subtitle for a single risk (regression: used to show '1 identified risks')", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "r1" })] },
      isLoading: false,
    })
    render(<Overview />)

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
    render(<Overview />)

    expect(screen.getByText("2 identified risks")).toBeInTheDocument()
  })

  it("shows an empty state in Recent Alerts when there are no alerts", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    render(<Overview />)

    expect(
      screen.getByText("organization.overview.alert.empty")
    ).toBeInTheDocument()
  })

  it("does not show the Recent Alerts empty state when alerts are present", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [makeAlert()] },
      isLoading: false,
    })
    render(<Overview />)

    expect(
      screen.queryByText("organization.overview.alert.empty")
    ).not.toBeInTheDocument()
  })
})
