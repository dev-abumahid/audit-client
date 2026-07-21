// Confirmed against the real Note Prisma model + note.service.ts (issue
// #108). Field naming on this model is camelCase (orgAccountId/
// inspectionId), unlike most other modules' snake_case org_account_id --
// matches the module's own naming table in aexa-server's CLAUDE.md.
export interface Note {
  id: string
  title: string
  extracted_text: string
  attachments: string[]
  orgAccountId: string
  inspectionId: string
  createdAt: string
  updatedAt: string
}
