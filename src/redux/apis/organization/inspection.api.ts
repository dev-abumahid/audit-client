import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type {
  InspectionDetail,
  InspectionStatus,
  InspectionSummary,
} from "@/types/inspection"

interface GetAllInspectionArgs {
  page: number
  limit: number
  searchTerm: string
  status: string
  siteId: string
}

interface CreateInspectionArgs {
  templateId: string
  siteId: string
  questionAnswers: {
    questionId: string
    answer: unknown
    note: string
    mediaFiles: unknown
  }[]
}

interface UpdateInspectionArgs {
  id: string
  data: {
    siteId?: string
    status?: InspectionStatus
    attachments?: string[]
  }
}

interface UpdateInspectionQuestionAnswerArgs {
  id: string
  // note/mediaFiles are genuinely optional on the wire — the backend's
  // update_question_answer validation (inspection.validation.ts) accepts
  // either key missing, and RunInspection.tsx's optimistic per-keystroke
  // save intentionally sends `{ answer }` alone.
  data: {
    answer: unknown
    note?: string
    mediaFiles?: unknown
  }
}

const inspectionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllInspection: builder.query<
      PaginatedApiResponse<InspectionSummary>,
      GetAllInspectionArgs
    >({
      query: ({ page, limit, searchTerm, status, siteId }) => ({
        url: `/inspection?${buildQueryString({ page, limit, searchTerm, status, siteId })}`,
        method: "GET",
      }),
      providesTags: ["INSPECTION"],
    }),
    deleteInspection: builder.mutation<ApiResponse<unknown>, string>({
      query: (id) => ({
        url: `/inspection/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["INSPECTION"],
    }),
    getSingleInspection: builder.query<ApiResponse<InspectionDetail>, string>({
      query: (id) => ({
        url: `/inspection/${id}`,
        method: "GET",
      }),
      providesTags: ["INSPECTION"],
    }),
    createNewInspection: builder.mutation<
      ApiResponse<unknown>,
      CreateInspectionArgs
    >({
      query: (data) => ({
        url: `/inspection`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["INSPECTION"],
    }),
    updateInspection: builder.mutation<
      ApiResponse<unknown>,
      UpdateInspectionArgs
    >({
      query: ({ data, id }) => ({
        url: `/inspection/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["INSPECTION"],
    }),
    updateInspectionQuestionAnswer: builder.mutation<
      ApiResponse<unknown>,
      UpdateInspectionQuestionAnswerArgs
    >({
      query: ({ data, id }) => ({
        url: `/inspection/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["INSPECTION"],
    }),
    splitInspectionNote: builder.mutation<ApiResponse<unknown>, string>({
      query: (inspectionId: string) => ({
        url: `/inspection/split-note-into-inspection/${inspectionId}`,
        method: "POST",
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
  useUpdateInspectionQuestionAnswerMutation,
  useSplitInspectionNoteMutation,
} = inspectionApi
