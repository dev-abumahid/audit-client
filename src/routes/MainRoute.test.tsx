// aexa-frontend#271 / #278 -- integration check that the real route table
// (not just the WriteGuardRoute component in isolation, see
// WriteGuardRoute.test.tsx) actually wires the guard onto all 8 named routes,
// and leaves every other /organization route reachable exactly as before.
// Every page component is stubbed to a trivial div so this test only
// exercises the router/guard wiring, not each page's own data-fetching
// internals.
import { render, screen } from "@testing-library/react"
import { Outlet, RouterProvider, createMemoryRouter } from "react-router"

let mockUserRole: string | undefined = "ORGANIZATION"
vi.mock("@/redux/hooks", () => ({
  useAppSelector: () => ({ role: mockUserRole }),
}))

let mockOrgRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockOrgRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

function stub(label: string) {
  return { default: () => <div>{label}</div> }
}

vi.mock(
  "@/dashboard/admin/organizations/AdminOrganization",
  () => stub("AdminOrganization")
)
vi.mock("@/dashboard/admin/overview/AdminOverview", () => stub("AdminOverview"))
vi.mock("@/dashboard/admin/settings/AdminSettings", () => stub("AdminSettings"))
vi.mock(
  "@/dashboard/admin/transactions/AdminTransactions",
  () => stub("AdminTransactions")
)
vi.mock("@/dashboard/organization/alerts/AlertsPage", () => stub("AlertsPage"))
vi.mock("@/dashboard/organization/audit/AuditPage", () => stub("AuditPage"))
vi.mock(
  "@/dashboard/organization/compliance/CompliancePage",
  () => stub("CompliancePage")
)
vi.mock(
  "@/dashboard/organization/inspection/CreateNewInspection",
  () => stub("CreateNewInspection")
)
vi.mock(
  "@/dashboard/organization/inspection/InspectionReport",
  () => stub("InspectionReport")
)
vi.mock(
  "@/dashboard/organization/inspection/InspectionTable",
  () => stub("InspectionTable")
)
vi.mock(
  "@/dashboard/organization/intelligence/IntelligencePage",
  () => stub("IntelligencePage")
)
vi.mock(
  "@/dashboard/organization/governance/ThreeLinesOfDefensePage",
  () => stub("ThreeLinesOfDefensePage")
)
vi.mock("@/dashboard/organization/kri/KriDashboardPage", () => stub("KriDashboardPage"))
vi.mock("@/dashboard/organization/overview/Overview", () => stub("Overview"))
vi.mock("@/dashboard/organization/reports/ReportsPage", () => stub("ReportsPage"))
vi.mock(
  "@/dashboard/organization/risk/CorrelationMatrixPage",
  () => stub("CorrelationMatrixPage")
)
vi.mock("@/dashboard/organization/risk/RiskGraphPage", () => stub("RiskGraphPage"))
vi.mock("@/dashboard/organization/risk/RiskMatrixPage", () => stub("RiskMatrixPage"))
vi.mock(
  "@/dashboard/organization/risk/RiskRegisterPage",
  () => stub("RiskRegisterPage")
)
vi.mock("@/dashboard/organization/site/SitesEntities", () => stub("SitesEntities"))
vi.mock(
  "@/dashboard/organization/templates/create/CreateTemplatePage",
  () => stub("CreateTemplatePage")
)
vi.mock(
  "@/dashboard/organization/templates/edit/EditTemplatePage",
  () => stub("EditTemplatePage")
)
vi.mock(
  "@/dashboard/organization/templates/TemplateReportPage",
  () => stub("TemplateReportPage")
)
vi.mock("@/dashboard/organization/templates/TemplatesPage", () => stub("TemplatesPage"))
vi.mock(
  "@/dashboard/organization/findings/AllFindingsPage",
  () => stub("AllFindingsPage")
)
vi.mock(
  "@/dashboard/organization/findings/FindingDetails",
  () => stub("FindingDetails")
)
vi.mock("@/dashboard/organization/settings/OrgSettingPage", () => stub("OrgSettingPage"))
vi.mock(
  "@/dashboard/organization/inspection/UpdateInspection",
  () => stub("UpdateInspection")
)
vi.mock("@/layouts/AdminLayout", () => ({
  default: () => <Outlet />,
}))
vi.mock("@/layouts/OrganizationLayout", () => ({
  default: () => <Outlet />,
}))
vi.mock("@/layouts/RootLayout", () => ({
  default: () => <Outlet />,
}))
vi.mock("@/pages/error/ErrorPage", () => stub("ErrorPage"))
vi.mock("@/pages/auth/ResetPasswordPage", () => stub("ResetPasswordPage"))
vi.mock("@/pages/external/ExternalLoginPage", () => stub("ExternalLoginPage"))
vi.mock("@/pages/external/ExternalPortalPage", () => stub("ExternalPortalPage"))
vi.mock("@/pages/home/Home", () => stub("Home"))
vi.mock("@/pages/inspection/InspectionActions", () => stub("InspectionActions"))
vi.mock("@/pages/inspection/InspectionNote", () => stub("InspectionNote"))
vi.mock(
  "@/pages/inspection/InspectionRecommendations",
  () => stub("InspectionRecommendations")
)
vi.mock("@/pages/inspection/RunInspection", () => stub("RunInspection"))
vi.mock("@/pages/policy/PrivacyPolicy", () => stub("PrivacyPolicy"))
vi.mock("@/pages/policy/Terms", () => stub("Terms"))
vi.mock("./ExternalProtectedRoute", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

async function renderAt(path: string) {
  const { mainRoute } = await import("./MainRoute")
  const router = createMemoryRouter(mainRoute.routes, {
    initialEntries: [path],
  })
  return render(<RouterProvider router={router} />)
}

const GUARDED_ROUTES: Array<[path: string, formLabel: string, listLabel: string]> = [
  ["/organization/audit/template/create", "CreateTemplatePage", "TemplatesPage"],
  ["/organization/audit/template/edit/t1", "EditTemplatePage", "TemplatesPage"],
  [
    "/organization/audit/inspection/create",
    "CreateNewInspection",
    "InspectionTable",
  ],
  [
    "/organization/audit/inspection/update/i1",
    "UpdateInspection",
    "InspectionTable",
  ],
  ["/organization/audit/inspections/i1", "RunInspection", "InspectionTable"],
  // aexa-frontend#278 -- these three were missed when #271 wired the guard
  // onto their sibling routes above.
  [
    "/organization/audit/inspections/i1/note",
    "InspectionNote",
    "InspectionTable",
  ],
  [
    "/organization/audit/inspections/i1/recommendations",
    "InspectionRecommendations",
    "InspectionTable",
  ],
  [
    "/organization/audit/inspections/i1/actions",
    "InspectionActions",
    "InspectionTable",
  ],
]

describe("MainRoute write-guarded routes (ticket #271)", () => {
  beforeEach(() => {
    mockUserRole = "ORGANIZATION"
  })

  for (const [path, formLabel, listLabel] of GUARDED_ROUTES) {
    it(`redirects VIEWER away from ${path} instead of rendering the form`, async () => {
      mockOrgRole = "VIEWER"
      await renderAt(path)
      expect(await screen.findByText(listLabel)).toBeInTheDocument()
      expect(screen.queryByText(formLabel)).not.toBeInTheDocument()
    })

    it(`lets ADMIN reach ${path} normally`, async () => {
      mockOrgRole = "ADMIN"
      await renderAt(path)
      expect(await screen.findByText(formLabel)).toBeInTheDocument()
    })
  }

  it("leaves the unguarded inspections list reachable for VIEWER (control case)", async () => {
    mockOrgRole = "VIEWER"
    await renderAt("/organization/audit/inspections")
    expect(await screen.findByText("InspectionTable")).toBeInTheDocument()
  })
})
