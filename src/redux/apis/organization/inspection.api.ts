import { baseApi } from "@/redux/baseApi"

const inspectionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllInspection: builder.query({
      query: ({ page, limit, searchTerm, status, siteId }) => ({
        url: `/inspection?page=${page}&limit=${limit}&searchTerm=${searchTerm}&status=${status}&siteId=${siteId}`,
        method: "GET",
      }),
      providesTags: ["INSPECTION"],
    }),
    deleteInspection: builder.mutation({
      query: (id) => ({
        url: `/inspection/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["INSPECTION"],
    }),
    getSingleInspection: builder.query({
      query: (id) => ({
        url: `/inspection/${id}`,
        method: "GET",
      }),
      providesTags: ["INSPECTION"],
    }),
    createNewInspection: builder.mutation({
      query: (data) => ({
        url: `/inspection`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["INSPECTION"],
    }),
    updateInspection: builder.mutation({
      query: ({ data, id }) => ({
        url: `/inspection/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["INSPECTION"],
    }),
    updateInspectionQuestionAnswer: builder.mutation({
      query: ({ data, id }) => ({
        url: `/inspection/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["INSPECTION"],
    }),
  }),
})

export const {
  useGetAllInspectionQuery,
  useDeleteInspectionMutation,
  useGetSingleInspectionQuery,
  useCreateNewInspectionMutation,
  useUpdateInspectionMutation,
  useUpdateInspectionQuestionAnswerMutation
} = inspectionApi
