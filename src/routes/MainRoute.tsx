import AppRoot from "@/components/AppRoot"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Overview from "@/dashboard/organization/overview/Overview"
import OrganizationLayout from "@/layouts/OrganizationLayout"
import RootLayout from "@/layouts/RootLayout"
import ErrorPage from "@/pages/error/ErrorPage"
import Home from "@/pages/home/Home"
import InspectionsList from "@/pages/inspection/InspectionsList"
import InspectionActions from "@/pages/inspection/InspectionActions"
import InspectionNote from "@/pages/inspection/InspectionNote"
import InspectionRecommendations from "@/pages/inspection/InspectionRecommendations"
import RunInspection from "@/pages/inspection/RunInspection"
import PrivacyPolicy from "@/pages/policy/PrivacyPolicy"
import TermsAndConditions from "@/pages/policy/Terms"
import { createBrowserRouter } from "react-router"

export const mainRoute = createBrowserRouter([
  {
    element: <AppRoot />,
    children: [
      // Public routes
      {
        path: "/",
        element: <RootLayout />,
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <Home /> },
          { path: "/terms", element: <TermsAndConditions /> },
          { path: "/privacy", element: <PrivacyPolicy /> },
        ],
      },
      // Protected organization routes
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/organization",
            element: <OrganizationLayout />,
            errorElement: <ErrorPage />,
            children: [
              { index: true, element: <Overview /> },
              { path: "audit/inspections", element: <InspectionsList /> },
              { path: "audit/inspections/:id", element: <RunInspection /> },
              { path: "audit/inspections/:id/note", element: <InspectionNote /> },
              { path: "audit/inspections/:id/recommendations", element: <InspectionRecommendations /> },
              { path: "audit/inspections/:id/actions", element: <InspectionActions /> },
            ],
          },
        ],
      },
    ],
  },
])
