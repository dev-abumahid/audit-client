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

// Was ThreeLinesOfDefensePage.tsx-only (its LINE_COLOR) while every other
// screen showing line_of_defense (RiskDetails, ComplianceObligationRow)
// rendered it as plain uncolored text -- moved here so a line's color
// means the same thing everywhere it appears, not just on the page that
// owns the concept.
//
// Hue selection: --chart-2 (199°) and --chart-3 (38°) are color-IDENTICAL
// to --risk-info and --risk-medium (src/index.css), and severity badges
// use those exact risk colors -- reusing the full chart-1..4 set would
// make a line color indistinguishable from an unrelated severity
// indicator on the same screen. Keeps --chart-1 (168°, teal), which
// doesn't collide with any --risk-* hue (0°/38°/142°/199°), and replaces
// the remaining 3 slots with literal hues >=25° clear of every --risk-*
// hue and of each other. GOVERNING_BODY's yellow-green/olive (88°) is the
// nearest clear gap once every --risk-* hue and FIRST/SECOND/THIRD's own
// hues are each buffered by >=25°.
//
// Lightness: darkened from an original 36-60%L (white text on which
// measured as low as 2.85:1) to 28-42%L, landing between 5.8:1 and 8.3:1
// against white -- WCAG 1.4.3 needs >=4.5:1 for text this size.
export const LINE_OF_DEFENSE_COLOR: Record<LineOfDefense, string> = {
  FIRST: "bg-[hsl(168_60%_28%)]",
  SECOND: "bg-[hsl(250_70%_50%)]",
  THIRD: "bg-[hsl(320_65%_38%)]",
  GOVERNING_BODY: "bg-[hsl(88_55%_28%)]",
}
