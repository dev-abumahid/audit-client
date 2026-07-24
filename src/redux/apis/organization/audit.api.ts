import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"

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
  linked_risk_refs: string[]
  report_url: string | null
  createdAt: string
  updatedAt: string
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
      Partial<AuditEngagement>
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
      { data: Partial<AuditEngagement>; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/audit/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["AUDIT"],
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
  useDeleteAuditEngagementMutation,
} = auditApi
