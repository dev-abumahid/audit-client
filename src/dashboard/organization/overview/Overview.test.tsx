import { render, screen } from "@testing-library/react"
import Overview from "./Overview"

const mockUseGetAllRisksQuery = vi.fn()
const mockUseGetAllKriQuery = vi.fn()
const mockUseGetAllAlertsQuery = vi.fn()
const mockUseGetAllFindingsQuery = vi.fn()
const mockUseGetAllInspectionQuery = vi.fn()

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) =>
    mockUseGetAllRisksQuery(...args),
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
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllKriQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllAlertsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllFindingsQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
    mockUseGetAllInspectionQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
  })

  it("shows a loading state while any of risks/KRIs/alerts/actions/inspections are loading", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: undefined, isLoading: true })
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

  it("groups real risks by category for the category breakdown chart", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "r1", category: "cyber" }),
          makeRisk({ id: "r2", category: "cyber" }),
        ],
      },
      isLoading: false,
    })
    render(<Overview />)

    expect(screen.getByText("Cyber")).toBeInTheDocument()
  })
})
