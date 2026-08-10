import { describe, expect, it } from "vitest"
import { getRiskSeverityLevel, isValidScoreValue } from "./riskScoring"

describe("getRiskSeverityLevel", () => {
  it("classifies a score in the top quartile (0-100 scale) as critical", () => {
    expect(getRiskSeverityLevel(90)).toBe("critical")
    expect(getRiskSeverityLevel(76)).toBe("critical")
  })

  it("classifies a score in the third quartile as high", () => {
    expect(getRiskSeverityLevel(75)).toBe("high")
    expect(getRiskSeverityLevel(51)).toBe("high")
  })

  it("classifies a score in the second quartile as medium", () => {
    expect(getRiskSeverityLevel(50)).toBe("medium")
    expect(getRiskSeverityLevel(26)).toBe("medium")
  })

  it("classifies a score in the bottom quartile as low", () => {
    expect(getRiskSeverityLevel(25)).toBe("low")
    expect(getRiskSeverityLevel(0)).toBe("low")
  })

  it("treats null/undefined/NaN as 0 (low), not a crash", () => {
    expect(getRiskSeverityLevel(null)).toBe("low")
    expect(getRiskSeverityLevel(undefined)).toBe("low")
    expect(getRiskSeverityLevel(Number.NaN)).toBe("low")
  })

  // Regression: a real 0-100 residual_score used to be checked against a
  // 1-25-scale threshold set (>12/>8/>4), so almost every real risk (which
  // sits well above 12 on a 0-100 scale) rendered as "critical" regardless
  // of its true severity.
  it("does not classify a genuinely low residual score (e.g. 20/100) as critical", () => {
    expect(getRiskSeverityLevel(20)).toBe("low")
  })
})

describe("isValidScoreValue", () => {
  it("accepts a genuine, finite number, including 0", () => {
    expect(isValidScoreValue(90)).toBe(true)
    expect(isValidScoreValue(0)).toBe(true)
  })

  it("accepts a numeric string", () => {
    expect(isValidScoreValue("42")).toBe(true)
  })

  it("rejects null and undefined", () => {
    expect(isValidScoreValue(null)).toBe(false)
    expect(isValidScoreValue(undefined)).toBe(false)
  })

  // Regression: Number("") and Number(null) both coerce to a *finite* 0, so
  // a naive `Number.isFinite(Number(x))` check would call these "valid" --
  // exactly the malformed values this function exists to catch.
  it("rejects an empty or whitespace-only string despite coercing to a finite 0", () => {
    expect(isValidScoreValue("")).toBe(false)
    expect(isValidScoreValue("   ")).toBe(false)
  })

  it("rejects NaN and an array (which also coerces via Number())", () => {
    expect(isValidScoreValue(Number.NaN)).toBe(false)
    expect(isValidScoreValue([])).toBe(false)
  })

  it("rejects a non-numeric string", () => {
    expect(isValidScoreValue("not-a-number")).toBe(false)
  })
})
