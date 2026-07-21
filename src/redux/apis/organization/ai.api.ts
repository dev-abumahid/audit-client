import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type { RiskSuggestion } from "@/types/ai"
import type { Recommendation } from "@/types/recommendation"
import type { ITemplate } from "@/types/template"

const aiApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateTemplateWithPrompt: builder.mutation<
      ApiResponse<ITemplate>,
      { prompt: string }
    >({
      query: (body) => ({
        url: `/ai/generate-with-prompt`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    generateTemplateWithPdf: builder.mutation<ApiResponse<ITemplate>, FormData>(
      {
        query: (body) => ({
          url: `/ai/generate-with-pdf`,
          method: "POST",
          body,
        }),
        invalidatesTags: ["TEMPLATE"],
      }
    ),
    generateTemplateWithRisk: builder.mutation<
      ApiResponse<ITemplate>,
      { riskId: string }
    >({
      query: (body) => ({
        url: `/ai/generate-with-risk`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    // Persists and returns the full Recommendation with its questions
    // included (see ai.service.ts's
    // generate_recommendation_with_inspection_from_ai).
    generateRecommendationFromAi: builder.mutation<
      ApiResponse<Recommendation>,
      { inspectionId: string }
    >({
      query: (body) => ({
        url: `/ai/generate-recommendation`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["RECOMMENDATION"],
    }),
    // Doesn't persist anything -- returns candidate risk suggestions for the
    // caller to review and selectively import via createNewRisk, which
    // already invalidates RISK. Field casing (Probability/Velocity/Trend/
    // Responsable) is deliberately kept exactly as aexa-ai produces it.
    analyzeSiteRisks: builder.mutation<ApiResponse<RiskSuggestion[]>, string>({
      query: (siteId) => ({
        url: `/ai/analyze-site-risks`,
        method: "POST",
        body: { siteId },
      }),
    }),
  }),
})

export const {
  useGenerateTemplateWithPromptMutation,
  useGenerateTemplateWithPdfMutation,
  useGenerateTemplateWithRiskMutation,
  useGenerateRecommendationFromAiMutation,
  useAnalyzeSiteRisksMutation,
} = aiApi
