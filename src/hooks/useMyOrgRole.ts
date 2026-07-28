import { useGetMeQuery } from "@/redux/apis/auth.api"
import { useGetAllOrgUsersQuery } from "@/redux/apis/organization/org.user.api"
import type { OrgRole } from "@/types/organizationMember"

/**
 * Resolves the current user's org-tier role (OrgRole), which drives UI gating
 * for org-governance actions like the risk approval workflow (aexa-frontend#95).
 *
 * There's no dedicated "my membership" endpoint, so this derives the role the
 * same way the backend's resolveCallerOrgContext does conceptually: match the
 * signed-in account against the org's member list. GET /organization/members is
 * readable by any active member (not just admins), so every role can resolve
 * its own. Matching is by email since the members endpoint exposes
 * `account.email` but not a raw accountId.
 *
 * Fallback to ADMIN when no membership row matches mirrors the server's
 * ADMIN-of-self fallback for a solo account with no OrgMember row at all. The
 * UI gate is a convenience only — every approval endpoint re-checks the role
 * server-side — so a permissive fallback here can't grant real authority.
 *
 * Returns `undefined` while either query is still loading, so callers can hold
 * off rendering role-specific controls until the role is known rather than
 * flashing an ADMIN-defaulted UI at a Lead Auditor.
 */
export function useMyOrgRole(): OrgRole | undefined {
  const { data: me, isLoading: meLoading } = useGetMeQuery()
  const { data: members, isLoading: membersLoading } =
    useGetAllOrgUsersQuery(undefined)

  if (meLoading || membersLoading) return undefined

  const myEmail = me?.data?.email
  const myMembership = members?.data?.find(
    (member) => member.account.email === myEmail
  )

  return myMembership?.role ?? "ADMIN"
}

// aexa-frontend#217 — the base entity write gate shared by Risk/Compliance/
// KRI/Sites/Findings CRUD (all backed by assertCanWriteOrgResource or, for
// Findings, assertCanWriteToInspection/assertCanWriteToAction, which are
// each at least as permissive as ADMIN/LEAD_AUDITOR and only *narrower* for
// a specific LEAD_AUDITOR/LIGHT_USER row based on inspection/finding
// assignment data this frontend doesn't have yet -- see FindingAssignment's
// own tracking issue. Hiding the affordance entirely for VIEWER/LIGHT_USER
// (who can never write via these base CRUD paths) fixes the "looks broken"
// UX gap #217 describes; it deliberately does NOT attempt row-level
// LEAD_AUDITOR/LIGHT_USER assignment gating, which needs data this hook
// doesn't have access to. `undefined` (role still loading) is treated as
// "hide" — same conservative-default convention as every other
// useMyOrgRole() consumer in this codebase (e.g. RiskApprovalControls).
export function canWriteOrgResource(role: OrgRole | undefined): boolean {
  return role === "ADMIN" || role === "LEAD_AUDITOR"
}
