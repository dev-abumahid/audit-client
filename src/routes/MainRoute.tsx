import RootLayout from "@/layouts/RootLayout"
import Home from "@/pages/home/Home"
import { createBrowserRouter } from "react-router"

export const mainRoute = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
    ],
  },
])
