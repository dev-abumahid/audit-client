import type { InspectionStatus } from "@/types/inspection"
import type { SeverityLevel } from "@/utils/severityStyles"

// Maps each InspectionStatus enum value to its i18n key under
// organization.inspection.* in en.json/fr.json. Shared by the status filter
// dropdown (InspectionTable.tsx), the status badge in InspectionTable.tsx,
// and the status badge in InspectionReport.tsx so all three stay in sync
// instead of rendering the raw enum value (aexa-frontend bug batch).
export const INSPECTION_STATUS_LABEL_KEYS: Record<InspectionStatus, string> = {
  DRAFT: "organization.inspection.statusDraft",
  IN_PROGRESS: "organization.inspection.statusInProgress",
  COMPLETED: "organization.inspection.statusCompleted",
  CANCELLED: "organization.inspection.statusCancelled",
}

/**
 * Resolves a humanized, translated label for an inspection status.
 * Falls back to the raw value for any status not in the map, so an
 * unexpected/legacy value never crashes rendering.
 */
export function getInspectionStatusLabel(
  t: (key: string) => string,
  status: string
): string {
  const key = INSPECTION_STATUS_LABEL_KEYS[status as InspectionStatus]
  return key ? t(key) : status
}

// quality-bar-loop (Inspections, round 14, visual polish): InspectionTable.tsx
// and UpdateInspection.tsx each independently re-derived this same
// status->severity mapping (a Record lookup in one, a nested ternary in the
// other), and InspectionReport.tsx skipped it entirely, hardcoding a single
// teal pill regardless of actual status. Centralizing here so all three (and
// any future caller) render the same color for the same status.
export const INSPECTION_STATUS_SEVERITY: Record<InspectionStatus, SeverityLevel> = {
  COMPLETED: "low",
  IN_PROGRESS: "medium",
  CANCELLED: "critical",
  DRAFT: "neutral",
}

export function getInspectionStatusSeverity(status: string): SeverityLevel {
  return INSPECTION_STATUS_SEVERITY[status as InspectionStatus] ?? "info"
}
