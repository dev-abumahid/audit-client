import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type {
  AnswerType,
  ITemplate,
  TemplateStatus,
  TemplateSummary,
} from "@/types/template"

interface GetAllTemplatesArgs {
  page: number
  limit: number
  searchTerm: string
  category?: string
  status?: TemplateStatus
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
      query: ({ page, limit, searchTerm, category, status }) => ({
        url: `/template?${buildQueryString({ page, limit, searchTerm, category, status })}`,
        method: "GET",
      }),
      providesTags: ["TEMPLATE"],
    }),
    // aexa-server PR #323 (quality-bar-loop industry-standards fix) --
    // flat list of the org's own distinct, already-used category values,
    // for a suggest-from-existing-values datalist (see AuditPage's
    // lead-auditor field for the same pattern) rather than a managed
    // taxonomy.
    getTemplateCategories: builder.query<ApiResponse<string[]>, void>({
      query: () => ({
        url: `/template/categories`,
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
    // quality-bar-loop round 5 (industry-standards): publish/unpublish
    // toggle. PATCH /:id always expects the multipart "data" envelope
    // (template.route.ts's uploader.single('file') + JSON.parse), even
    // for a single-field change -- there's no separate lightweight JSON
    // PATCH route, so this builds the same FormData shape
    // updateTemplateBasics uses rather than adding a new backend route
    // for what's really the same update operation.
    updateTemplateStatus: builder.mutation<
      ApiResponse<ITemplate>,
      { id: string; status: TemplateStatus }
    >({
      query: ({ id, status }) => {
        const formData = new FormData()
        formData.append("data", JSON.stringify({ status }))
        return {
          url: `/template/${id}`,
          method: "PATCH",
          body: formData,
        }
      },
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
  useGetTemplateCategoriesQuery,
  useDeleteTemplateMutation,
  useCreateNewTemplateMutation,
  useGetSingleTemplateQuery,
  useUpdateTemplateBasicsMutation,
  useUpdateTemplateStatusMutation,
  useUpdateOrCreateQuestionMutation,
  useDeleteQuestionMutation,
  useUpdateOrCreatePageMutation,
  useDeletePageMutation,
  useDuplicateTemplateMutation,
} = templateApi
