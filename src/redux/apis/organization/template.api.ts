import { baseApi } from "@/redux/baseApi"

const templateApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllTemplates: builder.query({
      query: ({ page, limit, searchTerm }) => ({
        url: `/template?page=${page}&limit=${limit}&searchTerm=${searchTerm}`,
        method: "GET",
      }),
      providesTags: ["TEMPLATE"],
    }),
    deleteTemplate: builder.mutation({
      query: (id) => ({
        url: `/template/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    createNewTemplate: builder.mutation({
      query: (data) => ({
        url: `/template`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
  }),
})

export const { useGetAllTemplatesQuery, useDeleteTemplateMutation ,useCreateNewTemplateMutation} =
  templateApi
