import { baseApi } from "@/redux/baseApi"

const recommendationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRecommendationByInspectionId: builder.query({
      query: (inspectionId) => ({
        url: `/recommendation/inspection/${inspectionId}`,
        method: "GET",
      }),
      providesTags: ["RECOMMENDATION"],
    }),
    updateRecommendationQuestionById: builder.mutation({
      query: ({ data, id }) => ({
        url: `/recommendation/update-question/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["RECOMMENDATION"],
    }),
    updateRecommendationSummary: builder.mutation({
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
