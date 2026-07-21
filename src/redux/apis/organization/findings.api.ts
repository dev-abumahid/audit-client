import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { IAction } from "@/types/finding"

interface GetAllFindingsArgs {
  page: number
  limit: number
  searchTerm: string
  siteId: string
  inspectionId?: string
}

// What create/update actually send to the backend — action.service.ts's
// create_action_into_db/update_action_into_db only ever read these fields
// off req.body (see the destructured `data:` blocks there); anything else
// on IAction (id, orgAccountId, site, assignBy as {id,name} objects, etc.)
// is either server-assigned or sent in a different shape than IAction
// carries it in.
interface FindingRequestBody {
  actionTitle?: string
  actionDisc?: string
  priority?: IAction["priority"]
  status?: IAction["status"]
  dueDate?: string
  assignBy?: string[]
  questionId?: string
  inspectionId?: string
  // Only `message` is persisted per item — see MESSAGES include comment in
  // finding.d.ts for why the full IActionMessage shape doesn't round-trip
  // through a request body.
  messages?: { message: string }[]
  attachments?: string[]
}

const findingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllFindings: builder.query<
      PaginatedApiResponse<IAction>,
      GetAllFindingsArgs
    >({
      query: ({ page, limit, searchTerm, siteId, inspectionId }) => ({
        url: `/action?${buildQueryString({ page, limit, searchTerm, siteId, inspectionId })}`,
        method: "GET",
      }),
      providesTags: ["FINDINGS"],
    }),
    getFindingById: builder.query<ApiResponse<IAction>, string>({
      query: (id: string) => ({
        url: `/action/${id}`,
        method: "GET",
      }),
      providesTags: ["FINDINGS"],
    }),
    deleteFindingById: builder.mutation<ApiResponse<unknown>, string>({
      query: (id) => ({
        url: `/action/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["FINDINGS"],
    }),
    createNewFinding: builder.mutation<
      ApiResponse<IAction>,
      FindingRequestBody
    >({
      query: (body) => ({
        url: `/action`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["FINDINGS"],
    }),
    updateFindingById: builder.mutation<
      ApiResponse<IAction>,
      { body: FindingRequestBody; id: string }
    >({
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
    uploadFindingAttachment: builder.mutation<
      ApiResponse<{ url: string }>,
      FormData
    >({
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
