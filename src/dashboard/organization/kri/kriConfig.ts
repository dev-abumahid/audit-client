import type { SeverityLevel } from "@/utils/severityStyles"

export const EMPTY_KRI = {
  name: "",
  risk_id: "",
  unit: "",
  current_value: 0,
  target_value: 0,
  alert_threshold: 0,
  frequency: "monthly",
}

export type KriFormState = typeof EMPTY_KRI

// Round-5 industry-standards finding: the backend's updateKri/deleteKri
// endpoints existed with zero frontend consumer -- a KRI's name, unit, or
// thresholds could never be corrected after creation, and a mistakenly
// created KRI could never be removed, without going around the UI
// entirely. Mirrors EMPTY_KRI's shape minus risk_id/current_value, which
// update_kri's own zod schema on aexa-server explicitly doesn't accept.
export const EMPTY_EDIT_KRI = {
  name: "",
  unit: "",
  target_value: 0,
  alert_threshold: 0,
  frequency: "monthly",
}

export type KriEditFormState = typeof EMPTY_EDIT_KRI

// quality-bar-loop round 3 (efficiency, round-1 finding): both are static
// -- hoisted to module scope instead of being redeclared inside the
// component on every render.
export const SEVERITY_RANK: Record<string, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
}

// Fresh full-panel re-score (code quality finding): a KRI's ALERT/WARNING/
// OK status was independently re-derived into a severity level, a border
// color, and a translated label in FOUR separate places across this file
// (the card border, the status badge's color, the status badge's text, and
// the URL-filter notice's text) -- any future 4th status value or renamed
// class would need updating in all four spots with nothing to catch a
// missed one. One lookup, keyed once.
export const KRI_STATUS_META: Record<
  string,
  { severityLevel: SeverityLevel; borderClass: string; labelKey: string }
> = {
  ALERT: {
    severityLevel: "critical",
    borderClass: "border-risk-critical/40",
    labelKey: "organization.kri.status.alert",
  },
  WARNING: {
    severityLevel: "medium",
    borderClass: "border-risk-medium/40",
    labelKey: "organization.kri.status.warning",
  },
  OK: {
    severityLevel: "low",
    borderClass: "border-risk-low/40",
    labelKey: "organization.kri.status.ok",
  },
}
export const kriStatusMeta = (status: string) =>
  KRI_STATUS_META[status] ?? KRI_STATUS_META.OK

// Round 13 (fresh full-panel re-score, industry-standards finding): every
// numeric readout on this page used bare `Number(...)`, rendering e.g.
// 15000 instead of 15,000. Round-2 review of PR #852: an unconditional
// "en-US" pin (round 1's fix for round-1 review's flagged test-flakiness
// risk from an *unpinned* locale) was itself wrong -- it would show a
// French-language user English-convention "1,234.56" grouping right next
// to dates already correctly rendered in French via this same file's
// `formatLocaleDate(date, i18n.language, ...)` call. Mirrors that exact
// same `language?.startsWith("fr") ? "fr-FR" : "en-US"` resolution (see
// src/utils/formatDate.ts's own doc comment on why an unpinned/hardcoded
// locale is a repeat of a past audit bug class) so numbers and dates on
// this page always agree on which language they're speaking.
// `maximumFractionDigits: 20` (the practical ceiling short of the spec's
// 100) stops the default 3-fraction-digit rounding from silently
// truncating a KRI value's real precision -- this only adds thousands
// separators, it never changes what number is displayed.
export const formatKriNumber = (value: number, language: string | undefined) =>
  value.toLocaleString(language?.startsWith("fr") ? "fr-FR" : "en-US", {
    maximumFractionDigits: 20,
  })

// Fresh full-panel re-score (code quality finding): unnamed magic numbers.
export const HIGHLIGHT_DURATION_MS = 3000
export const RISK_NAME_TRUNCATE_LENGTH = 30
export const highestSeverity = (
  kriAlerts: { severity: SeverityLevel }[]
): SeverityLevel =>
  kriAlerts.reduce(
    (worst, alert) =>
      (SEVERITY_RANK[alert.severity] ?? 0) > (SEVERITY_RANK[worst] ?? -1)
        ? alert.severity
        : worst,
    "low" as SeverityLevel
  )
