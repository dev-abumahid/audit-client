// Confirmed against the real OrgMember/OrgInvitation Prisma models +
// organization.service.ts (issue #108). Both GET /organization/members and
// GET /organization/invitations return a plain array in `data` -- neither
// endpoint paginates (plain findMany, no skip/take), so these wrap in
// ApiResponse<T[]>, not PaginatedApiResponse.

export type OrgRole = "ADMIN" | "LEAD_AUDITOR" | "LIGHT_USER" | "VIEWER"
export type OrgMemberStatus = "ACTIVE" | "SUSPENDED"
export type OrgInvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED"

// GET /organization/members row shape (get_org_members_from_db's select +
// derived `isExpired`). `isExpired` is computed per-request from
// expiresAt, not a stored column -- status alone stays "ACTIVE" indefinitely
// past a lapsed expiresAt, which is exactly what this field exists to
// surface instead of letting the UI silently lie about who has access.
export interface OrgMember {
  id: string
  role: OrgRole
  status: OrgMemberStatus
  expiresAt: string | null
  createdAt: string
  account: {
    email: string
    profile: { fullName: string } | null
  }
  isExpired: boolean
}

// PATCH /organization/members/:id's response shape -- a narrower select
// than the list endpoint above: no createdAt, and no isExpired (that's only
// computed on the list read, not appended here).
export type UpdatedOrgMember = Omit<OrgMember, "createdAt" | "isExpired">

// GET /organization/invitations row shape (get_pending_invitations_from_db's
// select) -- despite the endpoint name, `status` can theoretically be
// anything on OrgInvitationStatus since it's not filtered by the DB query
// beyond `status: 'PENDING'` in the where clause, which does make every row
// PENDING in practice; kept as the full enum for accuracy.
export interface PendingInvitation {
  id: string
  email: string
  role: OrgRole
  status: OrgInvitationStatus
  expiresAt: string
  createdAt: string
}

// POST /organization/invite and POST /organization/invite/:id/resend both
// return this same hand-built trimmed shape (not a Prisma select) -- no
// createdAt, no token (never sent to the client).
export interface InviteResult {
  id: string
  email: string
  role: OrgRole
  status: OrgInvitationStatus
  expiresAt: string
}
