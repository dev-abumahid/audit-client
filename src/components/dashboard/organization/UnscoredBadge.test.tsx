import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import UnscoredBadge from "./UnscoredBadge"

describe("UnscoredBadge", () => {
  it("renders as a real, focusable button rather than a plain hover-only span", () => {
    render(<UnscoredBadge />)
    expect(
      screen.getByRole("button", {
        name: "organization.riskMatrix.unscoredRiskWarning",
      })
    ).toBeInTheDocument()
  })

  it("shows the Unscored label", () => {
    render(<UnscoredBadge />)
    expect(
      screen.getByText("organization.riskMatrix.unscoredRiskBadge")
    ).toBeInTheDocument()
  })
})
