import type { InspectionStatus } from "@/types/inspection"

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
