// Backend Action/Finding status and priority enum -> i18n key. These same
// maps were previously duplicated (with slightly different names) in
// FindingDetails.tsx, AllFindingsPage.tsx, CreateNewFindingModal.tsx, and
// InspectionActions.tsx -- each pointing at the same
// organization.findings.status*/priority* i18n keys. Extracted here so new
// callers (e.g. ThreeLinesOfDefensePage) don't add a 5th copy. Resolve with
// getEnumLabel() from "@/utils/enumLabel". The existing per-file consts also
// carry style/color maps this file intentionally doesn't duplicate, since
// not every caller needs badge styling.
export const FINDING_STATUS_LABEL_KEYS: Record<string, string> = {
  TO_DO: "organization.findings.statusToDo",
  IN_PROGRESS: "organization.findings.statusInProgress",
  COMPLETE: "organization.findings.statusComplete",
  CANT_DO: "organization.findings.statusCantDo",
}

export const FINDING_PRIORITY_LABEL_KEYS: Record<string, string> = {
  Low: "organization.findings.priorityLow",
  Medium: "organization.findings.priorityMedium",
  High: "organization.findings.priorityHigh",
}
