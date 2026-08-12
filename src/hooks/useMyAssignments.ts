import { useGetMyInspectionAssignmentsQuery } from "@/redux/apis/organization/inspection.api"
import { useGetMyFindingAssignmentsQuery } from "@/redux/apis/organization/findings.api"
import { deriveAssignmentState } from "@/utils/assignmentScope"
import type { OrgRole } from "@/types/organizationMember"

/**
 * aexa-frontend#270: fetches the caller's own InspectionAssignment rows
 * (GET /inspection/assignments/mine, added in the same PR) and derives the
 * set of inspection ids they're actively assigned to -- the data
 * assignmentScope.ts's canWriteInspection/canWriteFinding need to narrow a
 * LEAD_AUDITOR's write affordances by real assignment state instead of role
 * alone.
 *
 * Returns `undefined` while loading or on error, which every consumer in
 * assignmentScope.ts treats as "assignment data unavailable -- degrade to
 * the pre-#270 role-only behavior" rather than newly denying access or
 * throwing. Only ADMIN/LEAD_AUDITOR ever need this (the endpoint 200s with
 * `[]` for any other role per its own self-scoped `if (!ctx.orgMemberId)
 * return []` guard, and VIEWER/LIGHT_USER never reach the LEAD_AUDITOR
 * branch in assignmentScope.ts regardless), so callers can call this
 * unconditionally without checking role first.
 *
 * quality-bar-loop (Inspections, round 50, efficiency finding): "can call
 * unconditionally" doesn't mean "should" -- a VIEWER/LIGHT_USER caller who
 * already knows their own role gets a real, if cheap, wasted network round
 * trip every time. The optional `role` param lets a caller that's already
 * resolved its role skip the request entirely once it's known to be
 * guaranteed-empty; omitting it (every pre-existing caller) preserves the
 * original always-fetch behavior exactly.
 */
export function useMyAssignedInspectionIds(
  role?: OrgRole
): Set<string> | undefined {
  const { data, isLoading, isError } = useGetMyInspectionAssignmentsQuery(
    undefined,
    { skip: role !== undefined && role !== "ADMIN" && role !== "LEAD_AUDITOR" }
  )

  if (isLoading || isError) return undefined

  const rows = data?.data ?? []
  return deriveAssignmentState(
    rows,
    (row) => row.inspectionId
  ).activeIds
}

/**
 * Sibling to useMyAssignedInspectionIds for a LIGHT_USER's own
 * FindingAssignment rows (GET /action/assignments/mine, already existed
 * server-side). "Active" here additionally requires `status === 'ACTIVE'`
 * (not just non-revoked) -- a PENDING_APPROVAL or REJECTED sub-assignment
 * grants nothing, mirroring getAssignedActionIds server-side.
 *
 * Same `undefined` == "unavailable, degrade" contract as
 * useMyAssignedInspectionIds.
 */
export function useMyActiveFindingAssignmentIds(): Set<string> | undefined {
  const { data, isLoading, isError } = useGetMyFindingAssignmentsQuery()

  if (isLoading || isError) return undefined

  const rows = data?.data ?? []
  return deriveAssignmentState(
    rows,
    (row) => row.actionId,
    (row) => row.status === "ACTIVE" && row.revokedAt === null
  ).activeIds
}
