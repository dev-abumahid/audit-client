interface IQuestion {
  id: string
  pageId: string
  index: number
  question: string
  isRequired: boolean
  answerType: string
  config: JsonValue
}
interface IPage {
  id: string
  templateId: string
  pageIndex: number
  title: string
  questions: IQuestion[]
}

interface ITemplateAccess {
  id: string
  templateId: string
  userId: string
}

export interface ITemplate {
  id: string
  orgAccountId: string
  templateLogo?: string | null
  templateName: string
  templateDisc?: string | null
  pages: IPage[]
  access: ITemplateAccess[]
  createdAt: Date
  updatedAt: Date
}
