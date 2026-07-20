interface IQuestion {
  id: string
  pageId: string
  index: number
  question: string
  isRequired: boolean
  answerType: string
  config: JsonValue
}
export interface IPage {
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

// GET /template's list select doesn't include `pages` or full `access` rows
// (see aexa-server template.service.ts get_all_template_from_db) — it's a
// narrower shape than a single-template fetch (ITemplate above). Using
// ITemplate for list results was previously masked by the endpoint being
// untyped `any`.
export interface TemplateSummary {
  id: string
  templateLogo?: string | null
  templateName: string
  templateDisc?: string | null
  createdAt: string
  updatedAt: string
  access: { userId: string }[]
}

export type AnswerType =
  | { answerType: "input"; value: string }
  | { answerType: "multipleSelect"; value: string[] }
  | { answerType: "date"; value: Date }
  | { answerType: "media"; value: string }
  | { answerType: "checkbox"; value: boolean }
  | { answerType: "slider"; value: number }

export interface QuestionField {
  id: string
  index: number
  question: string
  isRequired: boolean
  answerType: AnswerType
}

export interface PageField {
  id: string
  pageIndex: number
  title: string
  questions: QuestionField[]
}

export interface TemplateFormValues {
  templateName: string
  templateDisc: string
  pages: PageField[]
}
