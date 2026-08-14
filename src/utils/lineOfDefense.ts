import type { LineOfDefense } from "@/types/organization"

// Round 4 (Compliance code-quality finding): this exact Record was
// independently defined three times (RiskDetails.tsx's LINE_OF_DEFENSE_KEY,
// ThreeLinesOfDefensePage.tsx's LINE_TITLE_KEY, CompliancePage.tsx's own
// LINE_OF_DEFENSE_KEY -- the last one added in round 3 with a comment
// claiming it "reused" RiskDetails.tsx's mapping, but nothing was actually
// imported). One shared source of truth for the IIA Three Lines Model's
// four line values (Issue #97/#208/#209).
export const LINE_OF_DEFENSE_LABEL_KEY: Record<LineOfDefense, string> = {
  FIRST: "organization.threeLinesOfDefense.lines.first",
  SECOND: "organization.threeLinesOfDefense.lines.second",
  THIRD: "organization.threeLinesOfDefense.lines.third",
  GOVERNING_BODY: "organization.threeLinesOfDefense.lines.governingBody",
}
