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
    updateRecommendationById: builder.mutation({
      query: ({ body, id }) => ({
        url: `/recommendation/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["RECOMMENDATION"],
    }),
  }),
})

export const {
  useGetRecommendationByInspectionIdQuery,
  useUpdateRecommendationByIdMutation,
} = recommendationApi
