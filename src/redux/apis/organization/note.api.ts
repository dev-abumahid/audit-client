import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type { Note } from "@/types/note"

// Matches note.validation.ts's create_note zod schema on aexa-server.
type SaveRawNotePayload = Pick<
  Note,
  "title" | "extracted_text" | "inspectionId"
>

// extract-note-from-file is multipart/form-data: a `file` field plus a
// `data` field that is a JSON-stringified `{ inspectionId }` (parsed
// server-side, not real form fields) -- see note.service.ts's
// extract_note_from_any_file_or_image_and_save_into_db.
type ExtractNoteFromFilePayload = FormData

// update_note's zod schema -- attachments can be explicitly cleared/
// replaced (undefined check, not truthy, server-side) same as
// Action/Inspection's attachments PATCH pattern.
type UpdateNotePayload = Partial<
  Pick<Note, "title" | "extracted_text" | "attachments">
>

const noteApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    saveRawNote: builder.mutation<ApiResponse<Note>, SaveRawNotePayload>({
      query: (body) => ({
        url: `/note/save-raw-note`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["NOTE", "INSPECTION"],
    }),
    extractNoteFromFile: builder.mutation<
      ApiResponse<Note>,
      ExtractNoteFromFilePayload
    >({
      query: (body) => ({
        url: `/note/extract-note-from-file`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["NOTE", "INSPECTION"],
    }),
    getNoteByInspectionId: builder.query<ApiResponse<Note>, string>({
      query: (id) => ({
        url: `/note/by-inspection/${id}`,
        method: "GET",
      }),
      providesTags: ["NOTE"],
    }),
    updateNote: builder.mutation<
      ApiResponse<Note>,
      { id: string; body: UpdateNotePayload }
    >({
      query: ({ id, body }) => ({
        url: `/note/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["NOTE"],
    }),
    deleteNoteById: builder.mutation<ApiResponse<Note>, string>({
      query: (id) => ({
        url: `/note/${id}`,
        method: "DELETE",
      }),
      // aexa-frontend#229: saveRawNote/extractNoteFromFile both invalidate
      // INSPECTION too since they change inspection.note's existence --
      // deleting the note changes that same field and must invalidate the
      // same way, or the parent inspection page's cached "note.id" (driving
      // its View Note / Upload Note button label) goes stale until an
      // unrelated navigation forces a refetch.
      invalidatesTags: ["NOTE", "INSPECTION"],
    }),
  }),
})

export const {
  useSaveRawNoteMutation,
  useExtractNoteFromFileMutation,
  useGetNoteByInspectionIdQuery,
  useUpdateNoteMutation,
  useDeleteNoteByIdMutation,
} = noteApi

// aexa-frontend#229: exported so note.api.test.ts can dispatch
// deleteNoteById.initiate directly against a real store, to verify
// cache-invalidation behavior with a real store + mocked fetch rather than
// introspecting RTK Query's internal endpoint config.
export { noteApi }
