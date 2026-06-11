import { baseApi } from "@/redux/baseApi"

const noteApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    saveRawNote: builder.mutation({
      query: (body) => ({
        url: `/note/save-raw-note`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["NOTE", "INSPECTION"],
    }),
    extractNoteFromFile: builder.mutation({
      query: (body) => ({
        url: `/note/extract-note-from-file`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["NOTE", "INSPECTION"],
    }),
    getNoteByInspectionId: builder.query({
      query: (id: string) => ({
        url: `/note/by-inspection/${id}`,
        method: "GET",
      }),
      providesTags: ["NOTE"],
    }),
    updateNote: builder.mutation({
      query: ({ id, body }) => ({
        url: `/note/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["NOTE"],
    }),
  }),
})

export const {
  useSaveRawNoteMutation,
  useExtractNoteFromFileMutation,
  useGetNoteByInspectionIdQuery,
  useUpdateNoteMutation,
} = noteApi
