import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { ThemeProvider } from "@/components/theme-provider.tsx"
import { RouterProvider } from "react-router"
import { Toaster } from "./components/ui/sonner.tsx"
import "./i18n/i18n.ts"
import "./index.css"
import { mainRoute } from "./routes/MainRoute.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={mainRoute}></RouterProvider>
      <Toaster />
    </ThemeProvider>
  </StrictMode>
)
