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