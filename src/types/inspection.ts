export type InspectionStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"

export interface InspectionSummary {
  id: string
  status: InspectionStatus
  createdAt: string
  updatedAt: string
  template: { id: string; templateName: string } | null
  site: { id: string; name: string } | null
  inspector: { id: string; fullName: string } | null
}

export interface QuestionDef {
  id: string
  index: number
  question: string
  isRequired: boolean
  answerType: string
  value: unknown // type-specific config: options[], { min, max }, etc.
}

export interface PageDef {
  id: string
  pageIndex: number
  title: string
  questions: QuestionDef[]
}

export interface QuestionAnswer {
  id: string // questionAnswer.id — used for PUT
  questionId: string
  answer: unknown
  note: string | null
  mediaFiles: unknown
  question: {
    id: string
    question: string
    answerType: string
    value: unknown
  }
}

export interface InspectionDetail {
  id: string
  status: InspectionStatus
  createdAt: string
  updatedAt: string
  unSplitText: string | null
  template: {
    id: string
    templateName: string
    pages: PageDef[]
  } | null
  site: { id: string; name: string } | null
  note: { id: string } | null
  questionAnswers: QuestionAnswer[]
}

export interface PaginatedResponse<T> {
  meta: {
    page: number
    limit: number
    total: number
    totalPage: number
  }
  data: T[]
}
