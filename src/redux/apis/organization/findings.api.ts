import { baseApi } from "@/redux/baseApi"

const findingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllFindings: builder.query({
      query: ({ page, limit, searchTerm, siteId, inspectionId }) => ({
        url: `/action?page=${page}&limit=${limit}&searchTerm=${searchTerm}&siteId=${siteId}&inspectionId=${inspectionId ?? ""}`,
        method: "GET",
      }),
      providesTags: ["FINDINGS"],
    }),
    getFindingById: builder.query({
      query: (id: string) => ({
        url: `/action/${id}`,
        method: "GET",
      }),
      providesTags: ["FINDINGS"],
    }),
    deleteFindingById: builder.mutation({
      query: (id) => ({
        url: `/action/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["FINDINGS"],
    }),
    createNewFinding: builder.mutation({
      query: (body) => ({
        url: `/action`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["FINDINGS"],
    }),
    updateFindingById: builder.mutation({
      query: ({ body, id }) => ({
        url: `/action/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["FINDINGS"],
    }),
    // POST /action/attachment doesn't touch any Action row itself (see the
    // backend's own doc comment) — it just uploads to Cloudinary and returns
    // { url }. Persisting that URL onto a finding is a separate
    // updateFindingById call, same two-step pattern InspectionActions.tsx
    // already uses. No tag invalidation here for that reason.
    uploadFindingAttachment: builder.mutation({
      query: (formData: FormData) => ({
        url: `/action/attachment`,
        method: "POST",
        body: formData,
      }),
    }),
  }),
})

export const {
  useGetAllFindingsQuery,
  useDeleteFindingByIdMutation,
  useCreateNewFindingMutation,
  useUpdateFindingByIdMutation,
  useGetFindingByIdQuery,
  useUploadFindingAttachmentMutation,
} = findingsApi
