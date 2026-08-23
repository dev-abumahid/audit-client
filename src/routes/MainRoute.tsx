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
import RiskDetails from "@/dashboard/organization/risk/RiskDetails"
import RiskRegisterPage from "@/dashboard/organization/risk/RiskRegisterPage"
import SitesEntities from "@/dashboard/organization/site/SitesEntities"
import SuppliersEntities from "@/dashboard/organization/supplier/SuppliersEntities"
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
      { path: "suppliers", element: <SuppliersEntities /> },
      { path: "risks", element: <RiskRegisterPage /> },
      { path: "risks/:id", element: <RiskDetails /> },
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
      // quality-bar-loop (Inspections, round 25, industry-standards
      // finding): the routes this comment used to guard (bare `:id` ->
      // RunInspection, `:id/note` -> InspectionNote, `:id/recommendations`
      // -> InspectionRecommendations) were never linked from anywhere in
      // the app -- InspectionTable.tsx always routes edits to
      // `audit/inspection/update/:id` (UpdateInspection.tsx) instead.
      // Investigated rather than assumed a wiring oversight: all three were
      // an earlier sprint's parallel implementation of the same
      // answer-editing/note/recommendation features UpdateInspection.tsx
      // (and its inline UploadNotesModal.tsx/ViewAndEditRecommendation.tsx)
      // now handles -- RunInspection called the same mutations as
      // UpdateInspection but with a strictly smaller feature set (no
      // per-question notes, no external media, a binary Complete action vs.
      // a full status dropdown); InspectionNote was a strict subset of
      // UploadNotesModal.tsx (no text mode, no edit, no delete);
      // InspectionRecommendations was missing the AI-generate trigger that
      // makes ViewAndEditRecommendation.tsx usable for an inspection with
      // no recommendation yet. Deleted as genuinely superseded dead code
      // (along with their now-orphaned QuestionInput.tsx dependency)
      // rather than linked, since exposing them would give users two
      // competing, inconsistent "edit this inspection" UIs.
      //
      // `audit/inspections/:id/actions` -> InspectionActions.tsx is kept:
      // it fetches via useFindingsForInspection to render a per-inspection
      // findings list, a real capability missing elsewhere (confirmed via
      // InspectionReport.tsx's own dead-code comment on this exact gap) --
      // its inline create/edit form is a weaker duplicate of
      // CreateNewFindingModal.tsx and needs that swapped in, plus a real
      // nav link added, before this route is worth exposing -- tracked as
      // a follow-up round rather than attempted here.
      {
        path: "audit/inspections/:id/actions",
        element: (
          <WriteGuardRoute fallback="/organization/audit/inspections">
            <InspectionActions />
          </WriteGuardRoute>
        ),
      },
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
