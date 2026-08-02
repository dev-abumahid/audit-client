import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import AdminOverview from "./AdminOverview"

// Controllable `i18n.language` for the locale-formatting test below, same
// technique as FindingDetails.test.tsx/AdminOrganization.test.tsx.
let mockLanguage: string | undefined = undefined
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return { ...real, i18n: { ...real.i18n, language: mockLanguage } }
    },
  }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminOverview />
    </MemoryRouter>
  )
}

describe("AdminOverview", () => {
  beforeEach(() => {
    mockLanguage = undefined
  })

  // Issue #364: the "Recent Payments" date column used a local, inline
  // toLocaleDateString("en-US", ...) hardcoded in two places (desktop table
  // + mobile cards), ignoring the app's selected language. Both now go
  // through the shared formatLocaleDate helper.
  describe("locale-aware recent-payment date formatting (#364)", () => {
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    }

    it("formats recent-payment dates using the French locale when i18n.language starts with fr", () => {
      mockLanguage = "fr-FR"
      renderPage()

      const expected = new Date("2025-12-15").toLocaleDateString(
        "fr-FR",
        dateOptions
      )
      // Rendered once in the desktop table and once in the mobile card.
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
    })

    it("formats recent-payment dates using the English locale by default", () => {
      renderPage()

      const expected = new Date("2025-12-15").toLocaleDateString(
        "en-US",
        dateOptions
      )
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
    })
  })
})
