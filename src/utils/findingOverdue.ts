// quality-bar-loop (Findings, round 6, industry-standards finding): a
// finding past its due date rendered identically to one not yet due --
// every reference GRC tool in this category (AuditBoard, ServiceNow GRC,
// LogicGate) gives an overdue finding a distinct visual treatment. Unlike
// CompliancePage.tsx's `obl.overdue` (server-computed from next_review_date,
// see its own comment on why that's preferred there), Action has no such
// field -- dueDate/status are both already present on every finding, so
// this is a pure client-side derivation, not a new field or endpoint.
import type { IAction } from "@/types/finding"

export function isFindingOverdue(
  action: Pick<IAction, "dueDate" | "status">
): boolean {
  if (action.status === "COMPLETE" || action.status === "CANT_DO") {
    return false
  }
  return new Date(action.dueDate) < new Date()
}
