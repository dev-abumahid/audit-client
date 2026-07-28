import AdminOrganization from "@/dashboard/admin/organizations/AdminOrganization"
import AdminOverview from "@/dashboard/admin/overview/AdminOverview"
import AdminSettings from "@/dashboard/admin/settings/AdminSettings"
import AdminTransactions from "@/dashboard/admin/transactions/AdminTransactions"
import AlertsPage from "@/dashboard/organization/alerts/AlertsPage"
import AuditPage from "@/dashboard/organization/audit/AuditPage"
import CompliancePage from "@/dashboard/organization/compliance/CompliancePage"
import CreateNewInspection from "@/dashboard/organization/inspection/CreateNewInspection"
import InspectionReport from "@/dashboard/organization/inspection/InspectionReport"
import InspectionTable from "@/dashboard/organization/inspection/InspectionTable"
import IntelligencePage from "@/dashboard/organization/intelligence/IntelligencePage"
import ThreeLinesOfDefensePage from "@/dashboard/organization/governance/ThreeLinesOfDefensePage"
import KriDashboardPage from "@/dashboard/organization/kri/KriDashboardPage"
import Overview from "@/dashboard/organization/overview/Overview"
import ReportsPage from "@/dashboard/organization/reports/ReportsPage"
import CorrelationMatrixPage from "@/dashboard/organization/risk/CorrelationMatrixPage"
import RiskGraphPage from "@/dashboard/organization/risk/RiskGraphPage"
import RiskMatrixPage from "@/dashboard/organization/risk/RiskMatrixPage"
import RiskRegisterPage from "@/dashboard/organization/risk/RiskRegisterPage"
import SitesEntities from "@/dashboard/organization/site/SitesEntities"
import CreateTemplatePage from "@/dashboard/organization/templates/create/CreateTemplatePage"
import EditTemplatePage from "@/dashboard/organization/templates/edit/EditTemplatePage"
import TemplateReportPage from "@/dashboard/organization/templates/TemplateReportPage"
import TemplatesPage from "@/dashboard/organization/templates/TemplatesPage"
import AllFindingsPage from "@/dashboard/organization/findings/AllFindingsPage"
import FindingDetails from "@/dashboard/organization/findings/FindingDetails"
import OrgSettingPage from "@/dashboard/organization/settings/OrgSettingPage"
import UpdateInspection from "@/dashboard/organization/inspection/UpdateInspection"
import AdminLayout from "@/layouts/AdminLayout"
import OrganizationLayout from "@/layouts/OrganizationLayout"
import RootLayout from "@/layouts/RootLayout"
import ErrorPage from "@/pages/error/ErrorPage"
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage"
import ExternalLoginPage from "@/pages/external/ExternalLoginPage"
import ExternalPortalPage from "@/pages/external/ExternalPortalPage"
import Home from "@/pages/home/Home"
import InspectionActions from "@/pages/inspection/InspectionActions"
import InspectionNote from "@/pages/inspection/InspectionNote"
import InspectionRecommendations from "@/pages/inspection/InspectionRecommendations"
import RunInspection from "@/pages/inspection/RunInspection"
import PrivacyPolicy from "@/pages/policy/PrivacyPolicy"
import TermsAndConditions from "@/pages/policy/Terms"
import { createBrowserRouter } from "react-router"
import ExternalProtectedRoute from "./ExternalProtectedRoute"
import ProtectedRoute from "./ProtectedRoute"
import WriteGuardRoute from "./WriteGuardRoute"

export const mainRoute = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: "terms", element: <TermsAndConditions /> },
      { path: "privacy", element: <PrivacyPolicy /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      {
        path: "external-login/:organizationId",
        element: <ExternalLoginPage />,
      },
    ],
  },
  // External Light-User Routes (aexa-frontend#216). Deliberately its own
  // top-level tree, not nested under /organization -- ExternalProtectedRoute
  // checks a wholly separate session (externalUser slice), not the internal
  // `user` slice ProtectedRoute reads.
  {
    path: "/external",
    element: (
      <ExternalProtectedRoute>
        <ExternalPortalPage />
      </ExternalProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  // Organization Routes
  {
    path: "/organization",
    element: (
      <ProtectedRoute role="ORGANIZATION">
        <OrganizationLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Overview /> },
      { path: "sites", element: <SitesEntities /> },
      { path: "risks", element: <RiskRegisterPage /> },
      { path: "findings", element: <AllFindingsPage /> },
      { path: "finding/:id", element: <FindingDetails /> },
      { path: "risk-matrix", element: <RiskMatrixPage /> },
      { path: "correlation-matrix", element: <CorrelationMatrixPage /> },
      { path: "risk-graph", element: <RiskGraphPage /> },
      { path: "kri", element: <KriDashboardPage /> },
      { path: "intelligence", element: <IntelligencePage /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "compliance", element: <CompliancePage /> },
      { path: "three-lines-of-defense", element: <ThreeLinesOfDefensePage /> },
      { path: "audit", element: <AuditPage /> },
      { path: "audit/templates", element: <TemplatesPage /> },
      {
        path: "audit/template/create",
        element: (
          <WriteGuardRoute fallback="/organization/audit/templates">
            <CreateTemplatePage />
          </WriteGuardRoute>
        ),
      },
      {
        path: "audit/template/edit/:id",
        element: (
          <WriteGuardRoute fallback="/organization/audit/templates">
            <EditTemplatePage />
          </WriteGuardRoute>
        ),
      },
      { path: "audit/template/report/:id", element: <TemplateReportPage /> },
      { path: "audit/inspections", element: <InspectionTable /> },
      {
        path: "audit/inspection/create",
        element: (
          <WriteGuardRoute fallback="/organization/audit/inspections">
            <CreateNewInspection />
          </WriteGuardRoute>
        ),
      },
      {
        path: "audit/inspection/update/:id",
        element: (
          <WriteGuardRoute fallback="/organization/audit/inspections">
            <UpdateInspection />
          </WriteGuardRoute>
        ),
      },
      { path: "audit/inspections/report/:id", element: <InspectionReport /> },
      // Inspection run workflow (from main PR #32). #271 -- guarded the same
      // way as template/inspection create-edit; #270 (assignment-based
      // client-side scoping) is still open as of this change, so this only
      // enforces the role-level canWriteOrgResource check for now. Once #270
      // lands, this should also deny a write-capable role (e.g.
      // LEAD_AUDITOR) with no assignment on this specific inspection --
      // tracked as a fast-follow rather than blocking this PR on it.
      {
        path: "audit/inspections/:id",
        element: (
          <WriteGuardRoute fallback="/organization/audit/inspections">
            <RunInspection />
          </WriteGuardRoute>
        ),
      },
      { path: "audit/inspections/:id/note", element: <InspectionNote /> },
      {
        path: "audit/inspections/:id/recommendations",
        element: <InspectionRecommendations />,
      },
      { path: "audit/inspections/:id/actions", element: <InspectionActions /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <OrgSettingPage /> },
    ],
  },
  // Admin Routes
  {
    path: "/admin",
    element: (
      <ProtectedRoute role="ADMIN">
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminOverview /> },
      { path: "transaction", element: <AdminTransactions /> },
      { path: "organizations", element: <AdminOrganization /> },
      { path: "settings", element: <AdminSettings /> },
    ],
  },
])
