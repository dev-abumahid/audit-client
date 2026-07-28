import type { OrgRole } from "@/types/organizationMember"

/**
 * aexa-frontend#270: client-side mirror of aexa-server's
 * src/app/utils/org_scope.ts write-gating rules (applyInspectionScope,
 * applyActionScope, assertCanWriteToInspection, assertCanWriteToAction,
 * getInspectionAssignmentState). Client-side write gating was role-only
 * (useMyOrgRole/canWriteOrgResource) — it never narrowed a LEAD_AUDITOR down
 * to only their assigned InspectionAssignment rows, or a LIGHT_USER down to
 * only their sub-assigned (ACTIVE, non-revoked) FindingAssignment rows, so
 * both roles saw write affordances (Edit/Delete/Submit) on records the
 * server would 403 on the moment they were clicked.
 *
 * These are pure functions deliberately kept free of any RTK Query/React
 * dependency, so the exact same asymmetries the server enforces (see
 * org_scope.ts's own docstrings) can be unit-tested directly without
 * mocking a hook or a network call. useMyAssignments.ts wires the live
 * `/inspection/assignments/mine` and `/action/assignments/mine` data into
 * these functions.
 *
 * `undefined` for an assignment-id set below always means "the assignment
 * data isn't available right now" (still loading, or the fetch failed) --
 * never "known to have zero assignments" (that's an empty Set). Every
 * function here treats `undefined` as "degrade to the pre-#270 role-only
 * behavior", per this issue's design requirement to never break the page
 * or newly deny access when assignment data just hasn't loaded yet.
 */

export type AssignmentRow = { revokedAt: string | null }

/** Derived shape mirroring org_scope.ts's InspectionAssignmentState. */
export type AssignmentState = {
  activeIds: Set<string>
  everAssigned: boolean
}

/**
 * Builds an AssignmentState from a raw list of assignment-like rows,
 * mirroring getInspectionAssignmentState's activeIds/everAssigned split —
 * fetches every row (active or revoked) once, same as the server does,
 * rather than a separate "active" and "any" query.
 *
 * `isActive` defaults to plain non-revoked (InspectionAssignment has no
 * status field). FindingAssignment additionally requires `status ===
 * 'ACTIVE'` (a still-PENDING_APPROVAL or REJECTED row grants nothing, same
 * as getAssignedActionIds server-side) — pass a custom predicate for that
 * case rather than only checking revokedAt.
 */
export function deriveAssignmentState<T extends AssignmentRow>(
  rows: T[],
  idOf: (row: T) => string,
  isActive: (row: T) => boolean = (row) => row.revokedAt === null
): AssignmentState {
  const activeIds = new Set(rows.filter(isActive).map(idOf))
  return { activeIds, everAssigned: rows.length > 0 }
}

/**
 * Mirrors org_scope.ts's applyViewerAssignmentScope: a Viewer with active
 * assignments is scoped to exactly those; a Viewer who WAS assigned but had
 * every assignment revoked is denied (empty set), not handed org-wide
 * fallback visibility -- an admin cutting off access must not silently
 * upgrade to broader access than before. A Viewer who was NEVER assigned
 * anything falls back to org-wide visibility (returns `null`, meaning "no
 * restriction" -- the caller should not filter by id at all), the
 * board-member/compliance-officer case.
 *
 * `null` (fallback / no restriction) and an empty Set (denied) are
 * deliberately distinct return values -- collapsing them would reintroduce
 * exactly the never-assigned-vs-revoked bug getInspectionAssignmentState's
 * own docstring warns about.
 */
export function resolveViewerVisibleIds(
  state: AssignmentState
): Set<string> | null {
  if (state.activeIds.size > 0) return state.activeIds
  if (state.everAssigned) return new Set()
  return null
}

/**
 * Mirrors assertCanWriteToInspection: ADMIN always; LEAD_AUDITOR only if
 * assigned (active InspectionAssignment) to this exact inspection; every
 * other role never (VIEWER and LIGHT_USER's real write surface for
 * inspections doesn't exist -- LIGHT_USER's is the separate
 * canWriteFinding below).
 *
 * `assignedInspectionIds === undefined` means the caller's own assignment
 * data hasn't loaded / failed to load -- degrades to the pre-#270 role-only
 * behavior (true for LEAD_AUDITOR) rather than newly hiding the control or
 * crashing the page.
 */
export function canWriteInspection(
  role: OrgRole | undefined,
  inspectionId: string,
  assignedInspectionIds: Set<string> | undefined
): boolean {
  if (role === "ADMIN") return true
  if (role !== "LEAD_AUDITOR") return false
  if (assignedInspectionIds === undefined) return true
  return assignedInspectionIds.has(inspectionId)
}

/**
 * Mirrors assertCanWriteToAction: ADMIN always; LEAD_AUDITOR if assigned to
 * the finding's PARENT inspection (findings live inside an inspection, so
 * this reuses the same InspectionAssignment data as canWriteInspection,
 * keyed by inspectionId, not the finding's own id); LIGHT_USER only if they
 * hold a live (ACTIVE, non-revoked) FindingAssignment for this exact
 * finding; VIEWER never.
 *
 * Each `undefined` set independently means "that role's assignment data
 * hasn't loaded" and degrades to the pre-#270 role-only default for that
 * branch -- a LEAD_AUDITOR degrades to allowed (matching
 * canWriteInspection's degrade), a LIGHT_USER degrades to
 * `lightUserDegradeDefault` since different call sites had different
 * pre-#270 defaults for LIGHT_USER (FindingClosureControls allowed any
 * LIGHT_USER; FindingDetails/AllFindingsPage's canWriteOrgResource excluded
 * LIGHT_USER entirely) -- defaults to `false`, the more common case.
 */
export function canWriteFinding(
  role: OrgRole | undefined,
  actionId: string,
  inspectionId: string,
  leadAuditorAssignedInspectionIds: Set<string> | undefined,
  lightUserActiveActionIds: Set<string> | undefined,
  lightUserDegradeDefault = false
): boolean {
  if (role === "ADMIN") return true
  if (role === "LEAD_AUDITOR") {
    if (leadAuditorAssignedInspectionIds === undefined) return true
    return leadAuditorAssignedInspectionIds.has(inspectionId)
  }
  if (role === "LIGHT_USER") {
    if (lightUserActiveActionIds === undefined) return lightUserDegradeDefault
    return lightUserActiveActionIds.has(actionId)
  }
  return false
}
