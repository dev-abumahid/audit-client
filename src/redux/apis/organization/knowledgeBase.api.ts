import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type {
  PineconeDocument,
  PineconeUploadStatus,
} from "@/types/knowledgeBase"

const knowledgeBaseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadPdfIntoPinecone: builder.mutation<
      ApiResponse<PineconeDocument>,
      FormData
    >({
      query: (body) => ({
        url: `/ai/upload-pdf-into-pinecone`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["KNOWLEDGE_BASE"],
    }),
    checkUploadFileStatus: builder.query<
      ApiResponse<PineconeUploadStatus>,
      string
    >({
      query: (id) => ({
        url: `/ai/check-upload-file-status/${id}`,
        method: "GET",
      }),
      providesTags: ["KNOWLEDGE_BASE"],
    }),
    // Backend does a Prisma deleteMany scoped to this org+fileName, so the
    // response is the raw { count } result, not the deleted document.
    deleteFileFromPinecone: builder.mutation<
      ApiResponse<{ count: number }>,
      string
    >({
      query: (fileName: string) => ({
        url: `/ai/delete-file-from-pinecone?${buildQueryString({ fileName })}`,
        method: "DELETE",
      }),
      invalidatesTags: ["KNOWLEDGE_BASE"],
    }),
    // Plain findMany with no pagination on the backend (see
    // ai.service.ts's get_all_pinecone_data_from_database) -- there's no
    // `meta.total` to read here, unlike the paginated list endpoints.
    getAllFilesFromPinecone: builder.query<
      ApiResponse<PineconeDocument[]>,
      void
    >({
      query: () => ({
        url: `/ai/get-all-files-from-pinecone`,
        method: "GET",
      }),
      providesTags: ["KNOWLEDGE_BASE"],
    }),
  }),
})

export const {
  useUploadPdfIntoPineconeMutation,
  useCheckUploadFileStatusQuery,
  useDeleteFileFromPineconeMutation,
  useGetAllFilesFromPineconeQuery,
} = knowledgeBaseApi
