import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { LineOfDefense } from "@/types/organization"
import type { LineReview } from "./governance.api"

// A real Risk record linked to an engagement, as flattened by aexa-server's
// audit GET responses (aexa-frontend#165). Replaces the former free-text
// `linked_risk_refs` tag strings — these carry a real risk `id` (so the UI can
// link through to the Risk Register) plus a human-readable name and category.
export interface LinkedRisk {
  id: string
  name: string
  category: string
}

// Real response shape returned by aexa-server's /api/audit endpoints (the
// Prisma AuditEngagement model), not the old mockAuditEngagements fixture
// shape. Notably the backend uses `org_account_id` (not `organization_id`),
// `createdAt`/`updatedAt` (not snake_case), has no `user_id`, and dates come
// back as ISO strings over JSON. `status` is a loose string (matching
// Risk.status), the frontend uses "planned" | "in_progress" | "completed".
export interface AuditEngagement {
  id: string
  org_account_id: string
  ref: string
  title: string
  scope: string | null
  status: string
  lead_auditor: string | null
  priority_score: number | null
  findings_count: number
  started_at: string | null
  closed_at: string | null
  ai_generated: boolean
  is_edited: boolean
  // aexa-frontend#165: real many-to-many links to Risk records, returned
  // flattened by the backend. Replaces the old `linked_risk_refs: string[]`
  // free-text tags. Writes go through `riskIds` on the create/update payload
  // (see AuditEngagementWrite), reads come back here as resolved records.
  linked_risks: LinkedRisk[]
  report_url: string | null
  createdAt: string
  updatedAt: string
  // Issue #97. Always set — DB default is THIRD for pre-existing rows.
  line_of_defense: LineOfDefense
}

// Write payload for create/update. The linked-risk relation is written as a
// plain array of Risk ids (`riskIds`); the backend validates each id belongs to
// the caller's org and replaces the link set. Every other field mirrors the
// AuditEngagement model (minus the server-managed/read-only ones).
export type AuditEngagementWrite = Partial<
  Omit<AuditEngagement, "linked_risks">
> & {
  riskIds?: string[]
}

interface GetAllAuditEngagementsArgs {
  page: number
  limit: number
  searchTerm: string
}

const auditApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllAuditEngagements: builder.query<
      PaginatedApiResponse<AuditEngagement>,
      GetAllAuditEngagementsArgs
    >({
      query: ({ page, limit, searchTerm }) => ({
        url: `/audit?${buildQueryString({ page, limit, searchTerm })}`,
        method: "GET",
      }),
      providesTags: ["AUDIT"],
    }),
    getAuditEngagementById: builder.query<ApiResponse<AuditEngagement>, string>({
      query: (id) => ({
        url: `/audit/${id}`,
        method: "GET",
      }),
      providesTags: ["AUDIT"],
    }),
    createAuditEngagement: builder.mutation<
      ApiResponse<AuditEngagement>,
      AuditEngagementWrite
    >({
      query: (data) => ({
        url: `/audit`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["AUDIT"],
    }),
    updateAuditEngagement: builder.mutation<
      ApiResponse<AuditEngagement>,
      { data: AuditEngagementWrite; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/audit/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["AUDIT"],
    }),
    // #97: records that `line` independently reviewed this engagement --
    // distinct from updateAuditEngagement's line_of_defense, which
    // reassigns OWNERSHIP (see governance.api.ts's LineReview doc comment).
    // Only invalidates GOVERNANCE, not AUDIT -- a review doesn't change any
    // engagement field.
    recordAuditEngagementLineReview: builder.mutation<
      ApiResponse<LineReview[]>,
      { id: string; line: LineOfDefense; notes?: string }
    >({
      query: ({ id, line, notes }) => ({
        url: `/audit/${id}/line-reviews`,
        method: "POST",
        body: { line, notes },
      }),
      invalidatesTags: ["GOVERNANCE"],
    }),
    deleteAuditEngagement: builder.mutation<ApiResponse<AuditEngagement>, string>(
      {
        query: (id) => ({
          url: `/audit/${id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["AUDIT"],
      }
    ),
  }),
})

export const {
  useGetAllAuditEngagementsQuery,
  useGetAuditEngagementByIdQuery,
  useCreateAuditEngagementMutation,
  useUpdateAuditEngagementMutation,
  useRecordAuditEngagementLineReviewMutation,
  useDeleteAuditEngagementMutation,
} = auditApi
