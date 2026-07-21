import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"

const sitesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllSites: builder.query({
      query: ({ page, limit, searchTerm }) => ({
        url: `/site?${buildQueryString({ page, limit, searchTerm })}`,
        method: "GET",
      }),
      providesTags: ["SITE"],
    }),
    createNewSite: builder.mutation({
      query: (data) => ({
        url: `/site`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["SITE"],
    }),
    updateSite: builder.mutation({
      query: ({ data, id }) => ({
        url: `/site/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["SITE"],
    }),
    deleteSite: builder.mutation({
      query: (id) => ({
        url: `/site/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SITE"],
    }),
  }),
})

export const {
  useGetAllSitesQuery,
  useCreateNewSiteMutation,
  useUpdateSiteMutation,
  useDeleteSiteMutation,
} = sitesApi
