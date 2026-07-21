import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type {
  Recommendation,
  RecommendationBase,
  RecommendationResult,
} from "@/types/recommendation"

type UpdateRecommendationQuestionPayload = Partial<
  Pick<RecommendationResult, "observation" | "standard" | "recommendation">
>

type UpdateRecommendationSummaryPayload = Partial<
  Pick<RecommendationBase, "summary">
>

const recommendationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRecommendationByInspectionId: builder.query<
      ApiResponse<Recommendation>,
      string
    >({
      query: (inspectionId) => ({
        url: `/recommendation/inspection/${inspectionId}`,
        method: "GET",
      }),
      providesTags: ["RECOMMENDATION"],
    }),
    // Route param is recQuestionId -- this targets a RecommendationResult
    // row directly, not the parent Recommendation. No `question` field is
    // accepted server-side (recommendation.validation.ts's
    // update_recommendation_question) -- question text isn't editable via
    // this endpoint.
    updateRecommendationQuestionById: builder.mutation<
      ApiResponse<RecommendationResult>,
      { data: UpdateRecommendationQuestionPayload; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/recommendation/update-question/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["RECOMMENDATION"],
    }),
    // Returns the bare updated Recommendation with no `questions` included,
    // unlike the GET endpoints (see recommendation.service.ts's
    // update_recommendation_summary_into_db -- no `include`).
    updateRecommendationSummary: builder.mutation<
      ApiResponse<RecommendationBase>,
      { data: UpdateRecommendationSummaryPayload; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/recommendation/update-summary/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["RECOMMENDATION"],
    }),
  }),
})

export const {
  useGetRecommendationByInspectionIdQuery,
  useUpdateRecommendationQuestionByIdMutation,
  useUpdateRecommendationSummaryMutation,
} = recommendationApi
