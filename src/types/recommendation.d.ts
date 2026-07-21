// Confirmed against the real Recommendation/RecommendationResult Prisma
// models + recommendation.service.ts (issue #108).
export interface RecommendationResult {
  id: string
  recommendationId: string
  question: string
  observation: string
  standard: string
  recommendation: string
  createdAt: string
  updatedAt: string
}

// update_recommendation_summary_into_db (PATCH /recommendation/update-summary/:id)
// updates and returns the bare Recommendation row with no `include`, unlike
// the GET endpoints -- so it never has `questions` on it. Modeled as its own
// base interface rather than making `questions` optional on Recommendation,
// since every other consumer of Recommendation (GET by inspection, single
// GET) always has it populated.
export interface RecommendationBase {
  id: string
  orgAccountId: string
  inspectionId: string
  riskId: string | null
  siteId: string | null
  summary: string
  createdAt: string
  updatedAt: string
}

export interface Recommendation extends RecommendationBase {
  questions: RecommendationResult[]
}
