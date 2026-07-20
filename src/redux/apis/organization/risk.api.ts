import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { Risk } from "@/types/organization"

interface GetAllRisksArgs {
  page: number
  limit: number
  searchTerm: string
  siteId: string
  category: string
}

const risksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllRisks: builder.query<PaginatedApiResponse<Risk>, GetAllRisksArgs>({
      query: ({ page, limit, searchTerm, siteId, category }) => ({
        url: `/risk?page=${page}&limit=${limit}&searchTerm=${searchTerm}&siteId=${siteId}&category=${category}`,
        method: "GET",
      }),
      providesTags: ["RISK"],
    }),
    deleteRisk: builder.mutation<ApiResponse<Risk>, string>({
      query: (id) => ({
        url: `/risk/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["RISK"],
    }),
    createNewRisk: builder.mutation<ApiResponse<Risk>, Partial<Risk>>({
      query: (data) => ({
        url: `/risk`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["RISK"],
    }),
    updateRisk: builder.mutation<
      ApiResponse<Risk>,
      { data: Partial<Risk>; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/risk/${id}`,
        method: "PATCH",
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
  useUpdateRiskMutation,
} = risksApi
