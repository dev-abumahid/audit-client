import { isValidScoreValue } from "@/utils/riskScoring"
import type { Risk } from "@/types/organization"

// Extracted verbatim from RiskMatrixView.tsx (theme-improvement-initiative,
// landing overhaul PR3) -- these four functions were already pure and
// module-level (no JSX, no hooks), so this is a mechanical move with zero
// behavior change, confirmed by RiskMatrixView.tsx's own existing test
// suite passing unmodified. Pulled out so the landing page's
// LandingRiskMatrixWidget can share the exact same cell-mapping and color
// logic the real authenticated RiskMatrixPage uses, instead of a second
// hand-copied implementation that could silently drift from it.
export type MatrixSize = 3 | 4 | 5

// Axis tick labels are the same wording across matrix sizes wherever the
// underlying concept repeats (e.g. "Unlikely" appears in the 3x3, 4x4, and
// 5x5 matrices alike), so each distinct label maps to a single shared i18n
// key rather than a per-size one -- resolved with t() at render, mirroring
// CorrelationMatrixPage's AXIS_LABELS_MAP pattern. Moved here alongside the
// calc functions (landing overhaul PR3, react-refresh/only-export-
// components forced this out of RiskMatrixView.tsx along with them) so
// LandingRiskMatrixWidget can reuse the exact same real label keys instead
// of a second hand-copied array.
export const LABEL_KEYS: Record<
  MatrixSize,
  { likelihood: string[]; impact: string[] }
> = {
  3: {
    likelihood: ["likelihoodUnlikely", "likelihoodPossible", "likelihoodLikely"],
    impact: ["impactMinor", "impactModerate", "impactMajor"],
  },
  4: {
    likelihood: [
      "likelihoodRare",
      "likelihoodUnlikely",
      "likelihoodProbable",
      "likelihoodQuasiCertain",
    ],
    impact: [
      "impactNegligible",
      "impactModerate",
      "impactMajor",
      "impactCatastrophic",
    ],
  },
  5: {
    likelihood: [
      "likelihoodVeryUnlikely",
      "likelihoodUnlikely",
      "likelihoodModeratelyLikely",
      "likelihoodProbable",
      "likelihoodVeryLikely",
    ],
    impact: [
      "impactNegligible",
      "impactMinor",
      "impactModerate",
      "impactMajor",
      "impactCatastrophic",
    ],
  },
}

// Same --risk-* ramp as the landing page's HeroProductVisual heat grid
// (src/pages/home/components/HeroProductVisual.tsx CELL_CLASS) instead of
// an independently-invented red/orange/yellow/green scale.
//
// quality-bar-loop round 10 (visual polish, round-1 finding): bg-risk-medium
// at a flat /45 in both themes rendered as a washed-out pale peach in light
// mode and a genuinely muddy brown/olive in dark mode -- confirmed via
// HSL->sRGB composite math against --card (light: /45 composites to
// rgb(250,212,145), a pastel tan; dark: /45 composites to rgb(123,90,34), a
// desaturated brown, not the clean amber --risk-medium actually is at full
// opacity). Light mode has huge contrast headroom against black text (14.9:1
// even at /45), so /75 there gives a genuinely vivid amber (rgb(248,178,59),
// 11.4:1) with no accessibility cost. Dark mode is the binding constraint:
// the small 9px count text (white at 90% opacity, composited a SECOND time
// over the already-alpha-blended cell color) drops below the 4.5:1
// small-text floor above /53 (measured: /53 gives 4.58:1, /54 gives 4.48:1)
// -- so dark mode only moves to /50 (4.90:1), a real but modest improvement,
// not a full fix. Fully fixing the dark-mode muddiness needs a base-token
// change to --risk-medium itself (src/index.css), which affects every
// consumer of that token across the app (RiskBadge, HeroProductVisual,
// etc.) -- out of scope for this page-local fix; flagged as a follow-up
// instead of attempted here.
//
// quality-bar-loop round 11 (accessibility, surfaced during round 10's own
// review): bg-risk-high's dark-mode tint (previously /70) was verified back
// when this ramp was first built, but only against the LARGE bold score
// number, never against this same small 9px count badge that round 10 above
// had to account for -- re-checking with the same doubly-composited
// methodology found BOTH bg-risk-critical/90 and bg-risk-high/70 actually
// fail the small-text 4.5:1 floor in dark mode (4.40:1 and 4.05:1
// respectively), a real, pre-existing gap this file's own comments never
// caught because they only checked the large number. Dark mode moves to
// critical/85 (4.73:1) and high/63 (4.62:1) -- both keep real margin above
// the floor while staying close to the original vividness. Light mode
// already clears 4.5:1 comfortably at both tiers' existing values (4.61:1,
// 8.24:1) -- no change needed there.
//
// quality-bar-loop round 12 (the round-10 follow-up, now done): the base
// --risk-medium/--risk-high dark-mode HSL values (src/index.css) were
// retuned -- medium's hue shifted 38->44 and lightness 55%->52%, high's
// hue shifted 25->20 -- fixing dark-mode medium's muddiness at the token
// level (not just this page's opacity) and, as a side effect, recovering
// the medium/high visual separation round 11's opacity cut had narrowed.
// The opacity classes below are unchanged; only the underlying token
// moved, and it was re-verified against every real consumer app-wide
// (see the src/index.css comment for the full composite-math table) --
// this page's own small-text contrast: medium/50 4.90:1->4.54:1 (still
// real margin above the 4.5:1 floor), high/63 4.62:1->5.02:1 (improved).
// quality-bar-loop round 14 (code quality finding, open since round 1):
// these were unnamed magic numbers -- named here as what they actually are,
// the normalized-score cutoffs a cell's row/col position maps to.
const CRITICAL_SCORE_THRESHOLD = 0.64
const HIGH_SCORE_THRESHOLD = 0.36
const MEDIUM_SCORE_THRESHOLD = 0.16

export function getMatrixColor(
  row: number,
  col: number,
  size: MatrixSize
): string {
  const score = ((row + 1) / size) * ((col + 1) / size)
  if (score >= CRITICAL_SCORE_THRESHOLD)
    return "bg-risk-critical/90 dark:bg-risk-critical/85"
  if (score >= HIGH_SCORE_THRESHOLD)
    return "bg-risk-high/80 dark:bg-risk-high/63"
  if (score >= MEDIUM_SCORE_THRESHOLD)
    return "bg-risk-medium/75 dark:bg-risk-medium/50"
  return "bg-risk-low/55"
}

// quality-bar-loop round 5 (resilience, found during a full-panel re-check):
// RiskBadge's severity color comes from getRiskSeverityLevel(residual_score),
// which has the identical Number(x) || 0 silent-fallback bug this function
// was built to catch -- but the original version only checked probability/
// inherent_score, so a malformed residual_score still rendered a confident
// "Low" badge with no unscored indication, right next to a correctly-flagged
// badge on the same card. residual_score is included here too.
export function hasValidRiskScore(risk: Risk): boolean {
  return (
    isValidScoreValue(risk.probability) &&
    isValidScoreValue(risk.inherent_score) &&
    isValidScoreValue(risk.residual_score)
  )
}

export function mapRiskToCell(
  risk: Risk,
  size: MatrixSize
): { row: number; col: number } {
  // probability and inherent_score are both a 0-100 scale (aexa-ai's
  // risk-generation prompts spec both as "number 0-100"), not 0-1 or 1-25 --
  // normalize each to a 0-1 fraction before mapping onto the grid. This used
  // to multiply a 0-100 probability directly by `max` (any risk with
  // probability >= ~13 clamped straight to the top likelihood row) and
  // divide inherent_score by 25 then multiply by max again (double-scaled,
  // clamping to the max impact column for any inherent_score >= 32) --
  // between the two, nearly every real risk piled into one corner cell.
  // A missing/malformed value still needs *some* cell to land in absent
  // better information -- 0 (lowest row/col) is that fallback -- but see
  // hasValidRiskScore above for how callers flag this to the user.
  const prob = (Number(risk.probability) || 0) / 100
  const impact = (Number(risk.inherent_score) || 0) / 100
  const max = size - 1
  const row = Math.min(max, Math.max(0, Math.round(prob * max)))
  const col = Math.min(max, Math.max(0, Math.round(impact * max)))
  return { row, col }
}

// quality-bar-loop round 12 (UX, round-1 finding): matrixSize/groupMode/
// siteFilter/selectedCell all used to reset on navigating away and back
// (e.g. clicking a risk name to its detail page, then hitting browser
// back) since none of it was reflected in the URL. A malformed/missing
// URL value (a stale bookmark, a hand-edited link) must fall back to "no
// selection" rather than crash or coerce to a false 0 -- same discipline
// as isValidScoreValue elsewhere in this file.
export function parseMatrixSize(value: string | null): MatrixSize | null {
  const n = Number(value)
  return n === 3 || n === 4 || n === 5 ? (n as MatrixSize) : null
}
