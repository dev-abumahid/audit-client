import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Provider } from "react-redux"
import { RouterProvider } from "react-router"
import { PersistGate } from "redux-persist/integration/react"
import { Toaster } from "./components/ui/sonner.tsx"
import "./i18n/i18n.ts"
import "./index.css"
import { persistor, store } from "./redux/store.ts"
import { mainRoute } from "./routes/MainRoute.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <PersistGate loading={null} persistor={persistor}>
        <Provider store={store}>
          <RouterProvider router={mainRoute}></RouterProvider>
          <Toaster richColors />
        </Provider>
      </PersistGate>
    </ThemeProvider>
  </StrictMode>
)
