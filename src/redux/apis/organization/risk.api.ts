import { baseApi } from "@/redux/baseApi"

const risksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllRisks: builder.query({
      query: ({ page, limit, searchTerm, siteId, category }) => ({
        url: `/risk?page=${page}&limit=${limit}&searchTerm=${searchTerm}&siteId=${siteId}&category=${category}`,
        method: "GET",
      }),
      providesTags: ["RISK"],
    }),
    deleteRisk: builder.mutation({
      query: (id) => ({
        url: `/risk/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["RISK"],
    }),
    createNewRisk: builder.mutation({
      query: (data) => ({
        url: `/risk`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["RISK"],
    }),
  }),
})

export const {
  useGetAllRisksQuery,
  useDeleteRiskMutation,
  useCreateNewRiskMutation,
} = risksApi
