import { render, screen } from "@testing-library/react"
import IntelligencePage from "./IntelligencePage"

// i18n isn't initialized in the test environment, so t() echoes the raw key
// back (see RiskRegisterPage.test.tsx for the same convention). The page runs
// on deferred mock data (issue #141); this smoke test only asserts that the
// user-facing chrome is routed through translation keys.

describe("IntelligencePage", () => {
  it("renders the localized header, action bar and prediction labels", () => {
    render(<IntelligencePage />)

    expect(
      screen.getByText("organization.intelligence.title")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.intelligence.subtitle")
    ).toBeInTheDocument()
    // Action buttons.
    expect(
      screen.getByText("organization.intelligence.collectSources")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.intelligence.aiPredictions")
    ).toBeInTheDocument()
    // Predictions panel labels (rendered from the seeded prediction data).
    expect(
      screen.getByText("organization.intelligence.predictionsHeading")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.intelligence.score7d")
    ).toBeInTheDocument()
  })

  it("routes the search placeholder and severity filters through t()", () => {
    render(<IntelligencePage />)

    expect(
      screen.getByPlaceholderText("organization.intelligence.searchPlaceholder")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "organization.intelligence.filterAll",
      })
    ).toBeInTheDocument()
    // Severity filters render "<key> (count)"; match the localized label part.
    expect(
      screen.getByRole("button", {
        name: /organization\.intelligence\.severityCritical/,
      })
    ).toBeInTheDocument()
  })
})
