import type { LineOfDefense, Site } from "./organization"

export type TAssignBy = {
  id: string
  name: string
}

export interface IAction {
  id: string

  // FK
  orgAccountId: string
  inspectionId: string
  siteId?: string | null
  questionId?: string | null
  // aexa-server#244 -- always present on the raw Prisma row (no `select`
  // narrows the list endpoint's response), just never typed here before
  // the Audit Missions remediation-status round needed to group a
  // multi-engagement findings fetch back out client-side by engagement.
  auditEngagementId?: string | null

  // Main body
  actionTitle: string
  // Optional at the DB level (aexa-server prisma/schema/action.prisma:
  // actionDisc String?, see aexa-server#173) -- omitted/null on rows
  // created with a blank "Description (Optional)" field.
  actionDisc?: string | null
  priority: "Low" | "Medium" | "High"
  dueDate: string
  status: "TO_DO" | "IN_PROGRESS" | "COMPLETE" | "CANT_DO"

  // aexa-server#244: IIA's "Five Cs" for a defensible finding record
  // (Criteria, Condition, Cause, Consequence/Effect — actionTitle/
  // actionDisc/priority/dueDate above already serve as the fifth C,
  // Corrective Action). All optional/nullable at the DB level: plenty of
  // legitimate findings are still plain remediation tasks, not formal
  // audit findings, so nothing is forced to classify.
  criteria?: string | null
  condition?: string | null
  cause?: string | null
  effect?: string | null

  // aexa-frontend#166 wrote this on create; aexa-server#531 is the read-side
  // fix that finally joins it back (GET /action/:id only -- the list
  // endpoint wasn't touched, this is a detail-page-only feature).
  complianceObligationId?: string | null
  complianceObligation?: { id: string; title: string } | null

  // Relations
  site?: Site | null
  messages: IActionMessage[]
  assignBy: TAssignBy[]
  // The real Prisma field (see aexa-server prisma/schema/action.prisma) is
  // `attachments`, not `mediaFiles` — there is no mediaFiles column on
  // Action. CreateNewFindingModal.tsx used to read/send `mediaFiles`, which
  // the backend silently ignored on create/update (it only ever persists
  // `body.attachments`), so uploaded attachments were dropped on every
  // create/edit through that modal. Found while typing this endpoint
  // (issue #108).
  attachments: string[]

  // Issue #97. Unlike Risk/Kri/ComplianceObligation/AuditEngagement, Action's
  // line_of_defense is nullable — rows created before #97 have no value and
  // surface as "Unclassified" in the Three Lines of Defense board rather than
  // being defaulted to any one line (see governance.service.ts on
  // aexa-server).
  line_of_defense: LineOfDefense | null

  // Date time
  createdAt: string
  updatedAt: string
}

// aexa-server#252: finding closure maker-checker workflow. A finding only
// ever reaches COMPLETE/CANT_DO via an approved closure request; a direct
// PATCH /action/:id sending either status as `status` is rejected (400) --
// even a no-op resend of an already-terminal status, which is why
// CreateNewFindingModal.tsx must never include `status` in its payload for
// a finding that's already COMPLETE/CANT_DO.
export type ActionClosureApprovalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED"

// The display state GET /action/:id/closure derives (deriveClosureState on
// the backend): NOT_SUBMITTED covers both "never submitted" and "was
// pending/approved but a later edit invalidated it, so it needs
// resubmission" -- same collapsing convention as Risk's approval state.
export type ClosureDisplayState = "NOT_SUBMITTED" | ActionClosureApprovalStatus

export interface ActionClosureApproval {
  id: string
  actionId: string
  status: ActionClosureApprovalStatus
  // The terminal status this cycle is requesting -- only ever COMPLETE or
  // CANT_DO (enforced server-side), typed as the full STATUS union since
  // that's what the field's own Prisma type is.
  requestedStatus: IAction["status"]
  submittedById: string
  decidedById: string | null
  decidedAt: string | null
  decisionNote: string | null
  invalidatedAt: string | null
  invalidatedById: string | null
  createdAt: string
  updatedAt: string
}

// GET /action/:id/closure response shape (get_action_closure_state).
export interface ActionClosureState {
  actionId: string
  status: ClosureDisplayState
  closure: ActionClosureApproval | null
}

// Matches aexa-server's MESSAGES_INCLUDE (action.service.ts) exactly — that
// select does NOT include actionId or a back-reference to the parent
// Action, and it DOES include the sender's account/profile so the UI can
// render a display name. The previous shape here (actionId, no account,
// optional `action` back-ref) didn't match what the endpoint actually
// returns; it went unnoticed because the endpoint was untyped `any`.
export interface IActionMessage {
  id: string

  // FK
  senderAccountId: string

  // Main body
  message: string

  // Relations — who sent it, for display. Falls back to organization
  // profile the same way action.service.ts's shapeResponsibleAssignees
  // falls back to email: prefer the personal profile name, then the org
  // profile name.
  account: {
    profile: { fullName: string | null; profilePhoto: string | null } | null
    organizationProfile: {
      organizationName: string | null
      organizationLogo: string | null
    } | null
  }

  // Date time
  createdAt: string
  updatedAt: string
}
