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
  }),
})

export const {
  useGenerateTemplateWithPromptMutation,
  useGenerateTemplateWithPdfMutation,
  useGenerateTemplateWithRiskMutation,
  useGenerateRecommendationFromAiMutation,
} = aiApi
