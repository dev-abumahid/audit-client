import { describe, expect, it } from "vitest"
import { severityBadgeClasses, severityTextClasses } from "./severityStyles"

// quality-bar-loop (Inspections, round 24, review finding on PR #698):
// InspectionReport.tsx's new compliance score used to extract just the
// text-color classes out of severityBadgeClasses' combined bg+text output
// by parsing the string -- fragile, since that string's format was never
// part of severityBadgeClasses' contract. severityTextClasses exposes the
// text color directly instead.
describe("severityTextClasses", () => {
  it("returns only the text-color classes for a severity level", () => {
    expect(severityTextClasses("critical")).toBe(
      "text-red-700 dark:text-red-400"
    )
  })

  it("matches the text portion of severityBadgeClasses' own combined output", () => {
    for (const level of [
      "critical",
      "high",
      "medium",
      "low",
      "info",
      "neutral",
    ] as const) {
      expect(severityBadgeClasses(level)).toContain(severityTextClasses(level))
    }
  })
})
