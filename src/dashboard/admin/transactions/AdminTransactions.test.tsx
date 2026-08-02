import { render, screen } from "@testing-library/react"
import AdminTransactions from "./AdminTransactions"

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

describe("AdminTransactions", () => {
  beforeEach(() => {
    mockLanguage = undefined
  })

  // Issue #364: the transaction date column used a local formatDate()
  // hardcoded to toLocaleDateString("en-US", ...), ignoring the app's
  // selected language. Now goes through the shared formatLocaleDate helper.
  describe("locale-aware transaction date formatting (#364)", () => {
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    }

    it("formats transaction dates using the French locale when i18n.language starts with fr", () => {
      mockLanguage = "fr-FR"
      render(<AdminTransactions />)

      const expected = new Date("2025-12-15T10:30:00Z").toLocaleDateString(
        "fr-FR",
        dateOptions
      )
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
    })

    it("formats transaction dates using the English locale by default", () => {
      render(<AdminTransactions />)

      const expected = new Date("2025-12-15T10:30:00Z").toLocaleDateString(
        "en-US",
        dateOptions
      )
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
    })
  })
})
