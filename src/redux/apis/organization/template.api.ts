import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { AnswerType, ITemplate, TemplateSummary } from "@/types/template"

interface GetAllTemplatesArgs {
  page: number
  limit: number
  searchTerm: string
}

interface UpdateOrCreateQuestionArgs {
  questionId?: string
  pageId?: string
  index: number
  question: string
  isRequired: boolean
  answerType: AnswerType
}

interface UpdateOrCreatePageArgs {
  pageId?: string
  pageIndex: number
  title: string
  templateId: string
}

const templateApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllTemplates: builder.query<
      PaginatedApiResponse<TemplateSummary>,
      GetAllTemplatesArgs
    >({
      query: ({ page, limit, searchTerm }) => ({
        url: `/template?${buildQueryString({ page, limit, searchTerm })}`,
        method: "GET",
      }),
      providesTags: ["TEMPLATE"],
    }),
    deleteTemplate: builder.mutation<ApiResponse<unknown>, string>({
      query: (id) => ({
        url: `/template/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    // POST body is a FormData ("data": JSON-stringified TemplateFormValues,
    // optional "file": the logo) — see CreateTemplatePage.tsx's onSubmit.
    createNewTemplate: builder.mutation<ApiResponse<ITemplate>, FormData>({
      query: (data) => ({
        url: `/template`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    getSingleTemplate: builder.query<ApiResponse<ITemplate>, string>({
      query: (id) => ({
        url: `/template/${id}`,
        method: "GET",
      }),
      providesTags: ["TEMPLATE"],
    }),

    // update template basics data
    updateTemplateBasics: builder.mutation<
      ApiResponse<ITemplate>,
      { data: FormData; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/template/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    updateOrCreateQuestion: builder.mutation<
      ApiResponse<unknown>,
      UpdateOrCreateQuestionArgs
    >({
      query: (data) => ({
        url: `/template/update-or-create-new-question`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    deleteQuestion: builder.mutation<ApiResponse<unknown>, string>({
      query: (id) => ({
        url: `/template/delete-page-question/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    updateOrCreatePage: builder.mutation<
      ApiResponse<unknown>,
      UpdateOrCreatePageArgs
    >({
      query: (data) => ({
        url: `/template/update-or-create-new-page`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    deletePage: builder.mutation<ApiResponse<unknown>, string>({
      query: (id) => ({
        url: `/template/delete-template-page/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TEMPLATE"],
    }),
    // aexa-server PR #322 (quality-bar-loop industry-standards fix) --
    // server does a single atomic nested-create copy of the whole
    // template (pages + questions); the duplicate never carries over
    // the source's access grants, starting as a private draft.
    duplicateTemplate: builder.mutation<ApiResponse<ITemplate>, string>({
      query: (id) => ({
        url: `/template/${id}/duplicate`,
        method: "POST",
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
  useDuplicateTemplateMutation,
} = templateApi
