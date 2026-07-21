import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"

const knowledgeBaseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadPdfIntoPinecone: builder.mutation({
      query: (body) => ({
        url: `/ai/upload-pdf-into-pinecone`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["KNOWLEDGE_BASE"],
    }),
    checkUploadFileStatus: builder.query({
      query: (id) => ({
        url: `/ai/check-upload-file-status/${id}`,
        method: "GET",
      }),
      providesTags: ["KNOWLEDGE_BASE"],
    }),
    deleteFileFromPinecone: builder.mutation({
      query: (fileName: string) => ({
        url: `/ai/delete-file-from-pinecone?${buildQueryString({ fileName })}`,
        method: "DELETE",
      }),
      invalidatesTags: ["KNOWLEDGE_BASE"],
    }),
    getAllFilesFromPinecone: builder.query({
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
