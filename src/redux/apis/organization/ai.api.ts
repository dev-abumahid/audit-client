import { baseApi } from "@/redux/baseApi"

const aiApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateTemplateWithPrompt: builder.mutation({
      query: (body) => ({
        url: `/ai/generate-with-prompt`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    generateTemplateWithPdf: builder.mutation({
      query: (body) => ({
        url: `/ai/generate-with-pdf`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    generateTemplateWithRisk: builder.mutation({
      query: (body) => ({
        url: `/ai/generate-with-risk`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    generateRecommendationFromAi: builder.mutation({
      query: (body) => ({
        url: `/ai/generate-recommendation`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["RECOMMENDATION"],
    }),
    analyzeSiteRisks: builder.mutation({
      query: (siteId: string) => ({
        url: `/ai/analyze-site-risks`,
        method: "POST",
        body: { siteId },
      }),
      // No RISK invalidation here — this only returns candidate suggestions,
      // nothing is persisted until the user explicitly imports one via the
      // existing createNewRisk mutation, which already invalidates RISK.
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
