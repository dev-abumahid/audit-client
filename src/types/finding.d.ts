import type { Site } from "./organization"

type TAssignBy = {
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

  // Date time
  createdAt: string
  updatedAt: string
}

export interface IActionMessage {
  id: string

  // FK
  actionId: string
  senderAccountId: string

  // Main body
  message: string

  // Relations
  action?: IAction
  //   account: Account

  // Date time
  createdAt: string
  updatedAt: string
}
