import { describe, expect, it } from "vitest"
import { formatEbitdaSectorLabel } from "./ebitdaSector"

describe("formatEbitdaSectorLabel", () => {
  it("converts a SCREAMING_SNAKE_CASE sector key to Title Case", () => {
    expect(formatEbitdaSectorLabel("CHEMICAL_BASIC")).toBe("Chemical Basic")
    expect(formatEbitdaSectorLabel("OTHER_UNCLASSIFIED")).toBe("Other Unclassified")
    expect(formatEbitdaSectorLabel("OIL_GAS_PRODUCTION")).toBe("Oil Gas Production")
  })

  it("handles a single-word key", () => {
    expect(formatEbitdaSectorLabel("STEEL")).toBe("Steel")
  })

  it("returns an empty string for null/undefined/empty input", () => {
    expect(formatEbitdaSectorLabel(null)).toBe("")
    expect(formatEbitdaSectorLabel(undefined)).toBe("")
    expect(formatEbitdaSectorLabel("")).toBe("")
  })
})
