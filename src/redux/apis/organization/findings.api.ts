import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { IAction } from "@/types/finding"
import type { LineOfDefense } from "@/types/organization"
import type { LineReview } from "./governance.api"

interface GetAllFindingsArgs {
  page: number
  limit: number
  searchTerm: string
  siteId: string
  inspectionId?: string
  // Audit Missions industry-standards round: scopes findings to a single
  // audit engagement via the FK aexa-server#244 already added to Action,
  // so a completed engagement's remediation status can be read without a
  // new schema/migration.
  auditEngagementId?: string
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
  // Optional back-link to the ComplianceObligation this action remediates
  // (aexa-frontend#166 "Create Action" from a non-compliant obligation).
  // create_action_into_db validates it belongs to the caller's org and writes
  // the real FK; update_action_into_db deliberately never reads it, so it is
  // only ever sent on create (aexa-server#226).
  complianceObligationId?: string
  // Only `message` is persisted per item — see MESSAGES include comment in
  // finding.d.ts for why the full IActionMessage shape doesn't round-trip
  // through a request body.
  messages?: { message: string }[]
  attachments?: string[]
  // aexa-server#244 — IIA's Five Cs. All optional, same as actionDisc.
  criteria?: string
  condition?: string
  cause?: string
  effect?: string
  // Issue #97 — Three Lines of Defense reassignment. update_action_into_db
  // gates this specifically to ADMIN/LEAD_AUDITOR (403 otherwise); the
  // frontend hides the control for other roles rather than duplicating that
  // check (see useMyOrgRole / ThreeLinesOfDefensePage.tsx).
  line_of_defense?: LineOfDefense
}

// aexa-frontend#270: mirrors aexa-server's FindingAssignment row shape
// returned by get_my_finding_assignments (action.service.ts) --
// { id, orgMemberId, actionId, status, revokedAt, createdAt, action: {...} }.
// Only the fields the frontend actually reads are declared.
export interface MyFindingAssignment {
  id: string
  actionId: string
  status: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED"
  revokedAt: string | null
  createdAt: string
  action: {
    id: string
    actionTitle: string
    inspectionId: string
    status: IAction["status"]
  }
}

const findingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllFindings: builder.query<
      PaginatedApiResponse<IAction>,
      GetAllFindingsArgs
    >({
      query: ({ page, limit, searchTerm, siteId, inspectionId, auditEngagementId }) => ({
        url: `/action?${buildQueryString({ page, limit, searchTerm, siteId, inspectionId, auditEngagementId })}`,
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
    // #97: records that `line` independently reviewed this finding --
    // distinct from updateFindingById's line_of_defense, which reassigns
    // OWNERSHIP (see governance.api.ts's LineReview doc comment). Only
    // invalidates GOVERNANCE, not FINDINGS -- a review doesn't change any
    // Action field.
    recordFindingLineReview: builder.mutation<
      ApiResponse<LineReview[]>,
      { id: string; line: LineOfDefense; notes?: string }
    >({
      query: ({ id, line, notes }) => ({
        url: `/action/${id}/line-reviews`,
        method: "POST",
        body: { line, notes },
      }),
      invalidatesTags: ["GOVERNANCE"],
    }),
    // update_action_into_db (the PATCH handler above) never reads
    // body.messages -- it only persists actionTitle/actionDisc/priority/
    // dueDate/status/attachments/assignBy (see action.service.ts on
    // aexa-server). Adding a comment to an *existing* finding has to go
    // through this separate PUT endpoint (update_action_messages_into_db,
    // added by #106) instead, which appends a single message server-side.
    // See #170 -- the frontend was never wired to call it.
    addFindingMessage: builder.mutation<
      ApiResponse<IAction>,
      { id: string; message: string }
    >({
      query: ({ id, message }) => ({
        url: `/action/${id}`,
        method: "PUT",
        body: { message },
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
    // aexa-frontend#270 -- self-scoped, no args. GET /action/assignments/mine
    // already existed server-side (added for a Light User's own "pending vs
    // active vs rejected" sub-assignment view) but had no frontend caller;
    // reused here to derive LIGHT_USER's real write scope for
    // useMyAssignments.ts. Returns every status (PENDING_APPROVAL/ACTIVE/
    // REJECTED) and revoked rows, not just active ones -- narrowing to
    // ACTIVE + non-revoked happens client-side in assignmentScope.ts, same
    // split the server itself does in getAssignedActionIds.
    getMyFindingAssignments: builder.query<
      ApiResponse<MyFindingAssignment[]>,
      void
    >({
      query: () => ({
        url: `/action/assignments/mine`,
        method: "GET",
      }),
      providesTags: ["FINDINGS"],
    }),
  }),
})

export const {
  useGetAllFindingsQuery,
  useDeleteFindingByIdMutation,
  useCreateNewFindingMutation,
  useUpdateFindingByIdMutation,
  useRecordFindingLineReviewMutation,
  useAddFindingMessageMutation,
  useGetFindingByIdQuery,
  useUploadFindingAttachmentMutation,
  useGetMyFindingAssignmentsQuery,
} = findingsApi
