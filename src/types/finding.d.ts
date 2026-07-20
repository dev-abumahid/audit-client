import type { Site } from "./organization"

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

  // Main body
  actionTitle: string
  actionDisc: string
  priority: "Low" | "Medium" | "High"
  dueDate: string
  status: "TO_DO" | "IN_PROGRESS" | "COMPLETE" | "CANT_DO"

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

  // Date time
  createdAt: string
  updatedAt: string
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
