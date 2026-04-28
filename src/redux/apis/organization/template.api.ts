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
    getSingleTemplate: builder.query({
      query: (id) => ({
        url: `/template/${id}`,
        method: "GET",
      }),
      providesTags: ["TEMPLATE"],
    }),

    // update template basics data
    updateTemplateBasics: builder.mutation({
      query: ({ data, id }) => ({
        url: `/template/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    updateOrCreateQuestion: builder.mutation({
      query: (data) => ({
        url: `/template/update-or-create-new-question`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    deleteQuestion: builder.mutation({
      query: (id) => ({
        url: `/template/delete-page-question/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    updateOrCreatePage: builder.mutation({
      query: (data) => ({
        url: `/template/update-or-create-new-page`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    deletePage: builder.mutation({
      query: (id) => ({
        url: `/template/delete-template-page/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
  }),
})

export const {
  useGetAllTemplatesQuery,
  useDeleteTemplateMutation,
  useCreateNewTemplateMutation,
  useGetSingleTemplateQuery,
  useUpdateTemplateBasicsMutation,
  useUpdateOrCreateQuestionMutation,
  useDeleteQuestionMutation,
  useUpdateOrCreatePageMutation,
  useDeletePageMutation,
} = templateApi
