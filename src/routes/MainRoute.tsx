import Overview from "@/dashboard/organization/overview/Overview"
import OrganizationLayout from "@/layouts/OrganizationLayout"
import RootLayout from "@/layouts/RootLayout"
import ErrorPage from "@/pages/error/ErrorPage"
import Home from "@/pages/home/Home"
import PrivacyPolicy from "@/pages/policy/PrivacyPolicy"
import TermsAndConditions from "@/pages/policy/Terms"
import { createBrowserRouter } from "react-router"

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
        path: "/terms",
        element: <TermsAndConditions />,
      },
      {
        path: "/privacy",
        element: <PrivacyPolicy />,
      },
    ],
  },
  // Organization Routes,
  {
    path: "/organization",
    element: <OrganizationLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Overview />,
      },
    ],
  },
])
