import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import RiskBadge from "./RiskBadge"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "riskLevel.critical": "[i18n] Critical",
        "riskLevel.high": "[i18n] High",
        "riskLevel.medium": "[i18n] Medium",
        "riskLevel.low": "[i18n] Low",
      }
      return translations[key] ?? key
    },
  }),
}))

describe("RiskBadge", () => {
  it.each([
    ["critical", "[i18n] Critical"],
    ["high", "[i18n] High"],
    ["medium", "[i18n] Medium"],
    ["low", "[i18n] Low"],
  ] as const)(
    "renders the translated label for level=%s, not a hardcoded fallback",
    (level, expected) => {
      render(<RiskBadge level={level} />)
      expect(screen.getByText(expected)).toBeInTheDocument()
    },
  )

  it("renders the explicit label prop instead of the translated default when provided", () => {
    render(<RiskBadge level="critical" label="8.4" />)
    expect(screen.getByText("8.4")).toBeInTheDocument()
    expect(screen.queryByText("[i18n] Critical")).not.toBeInTheDocument()
  })

  // quality-bar-loop round 16 (resilience regression): `level` is typed to
  // the 4 canonical values, but every caller feeds it real API data
  // (alert.severity, risk severity) with no runtime guard -- an
  // unrecognized value used to crash with "Cannot read properties of
  // undefined (reading 'bg')".
  it("does not crash when given a level outside the canonical 4 values", () => {
    // @ts-expect-error -- deliberately passing a value outside the typed
    // union to reproduce what a real, unvalidated API response can send.
    expect(() => render(<RiskBadge level="unknown-legacy-value" />)).not.toThrow()
  })
})
