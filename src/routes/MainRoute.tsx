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
import AdminLayout from "@/layouts/AdminLayout"
import OrganizationLayout from "@/layouts/OrganizationLayout"
import RootLayout from "@/layouts/RootLayout"
import ErrorPage from "@/pages/error/ErrorPage"
import Home from "@/pages/home/Home"
import PrivacyPolicy from "@/pages/policy/PrivacyPolicy"
import TermsAndConditions from "@/pages/policy/Terms"
import { createBrowserRouter } from "react-router"
import ProtectedRoute from "./ProtectedRoute"

export const mainRoute = createBrowserRouter([
  // common routes
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "terms",
        element: <TermsAndConditions />,
      },
      {
        path: "privacy",
        element: <PrivacyPolicy />,
      },
    ],
  },
  // Organization Routes,
  {
    path: "/organization",
    element: (
      <ProtectedRoute role="ORGANIZATION">
        <OrganizationLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Overview />,
      },
      {
        path: "sites",
        element: <SitesEntities />,
      },
      {
        path: "risks",
        element: <RiskRegisterPage />,
      },
      {
        path: "risk-matrix",
        element: <RiskMatrixPage />,
      },
      {
        path: "correlation-matrix",
        element: <CorrelationMatrixPage />,
      },
      {
        path: "risk-graph",
        element: <RiskGraphPage />,
      },
      {
        path: "kri",
        element: <KriDashboardPage />,
      },
      {
        path: "intelligence",
        element: <IntelligencePage />,
      },
      {
        path: "alerts",
        element: <AlertsPage />,
      },
      {
        path: "compliance",
        element: <CompliancePage />,
      },
      {
        path: "audit",
        element: <AuditPage />,
      },
      {
        path: "audit/templates",
        element: <TemplatesPage />,
      },
      {
        path: "audit/template/create",
        element: <CreateTemplatePage />,
      },
      {
        path: "audit/inspections",
        element: <InspectionTable />,
      },
      {
        path: "audit/inspection/create",
        element: <CreateNewInspection />,
      },
      {
        path: "audit/inspections/report/:id",
        element: <InspectionReport />,
      },
      {
        path: "audit/template/report/:id",
        element: <TemplateReportPage />,
      },
      {
        path: "audit/template/edit/:id",
        element: <EditTemplatePage />,
      },
      {
        path: "reports",
        element: <ReportsPage />,
      },
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
      {
        index: true,
        element: <AdminOverview />,
      },
      {
        path: "transaction",
        element: <AdminTransactions />,
      },
      {
        path: "organizations",
        element: <AdminOrganization />,
      },
      {
        path: "settings",
        element: <AdminSettings />,
      },
    ],
  },
])
