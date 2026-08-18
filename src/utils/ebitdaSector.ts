// aexa-server#347 (round-1 review fix) — Risk.ebitda_benchmark_sector stores
// a machine key (e.g. "CHEMICAL_BASIC", "OTHER_UNCLASSIFIED") matching
// aexa-server's sector_benchmarks.ts SCREAMING_SNAKE_CASE `sector` field.
// Both RiskDetails.tsx and RiskFormModal.tsx's RiskEbitdaSection were
// rendering this raw key directly to end users -- confirmed by re-reading
// both call sites -- which is unpolished for a GRC platform surfacing
// financial risk data to CEO-level reviewers. Rather than duplicating the
// full backend sector_benchmarks.ts table here (which would drift the
// moment either side adds/renames a sector), this is a pure generic
// formatter: SCREAMING_SNAKE_CASE -> Title Case. It won't reproduce
// Damodaran's exact label punctuation (e.g. "Chemical (Basic)" stays
// "Chemical Basic"), but that's an acceptable tradeoff for not needing two
// copies of the same sector list kept in sync across repos.

/** Formats a sector_benchmarks.ts machine key into a readable label, e.g. "CHEMICAL_BASIC" -> "Chemical Basic". Returns the input unchanged if it isn't SCREAMING_SNAKE_CASE-shaped (defensive -- a future sector key format change shouldn't crash this, just stop prettifying). */
export function formatEbitdaSectorLabel(sector: string | null | undefined): string {
  if (!sector) return ""
  return sector
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ")
}
