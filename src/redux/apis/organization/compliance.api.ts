import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"

// Real response shape returned by aexa-server's /api/compliance endpoints (the
// Prisma ComplianceObligation model), not the old mockCompliance fixture shape.
// The backend uses `org_account_id` (not `organization_id`), `createdAt`/
// `updatedAt` (not snake_case), has no `user_id`, and dates come back as ISO
// strings over JSON. `status` and `domain` are loose strings (matching
// Risk.status / Risk.category); the frontend uses the COMPLIANCE_DOMAINS and
// the four statuses "compliant" | "non_compliant" | "in_progress" |
// "not_applicable".
export interface ComplianceObligation {
  id: string
  org_account_id: string
  site_id: string | null
  title: string
  description: string | null
  domain: string
  status: string
  owner: string | null
  due_date: string | null
  attachments: string[]
  ai_generated: boolean
  is_edited: boolean
  createdAt: string
  updatedAt: string
}

// Computed scorecard returned by GET /compliance/scorecard. A cell's `band`
// follows the CDC 7.7 red/orange/green thresholds (red <70%, orange 70-85%,
// green >85%); "none" means the cell/group has no applicable obligations.
export type ComplianceScoreBand = "green" | "orange" | "red" | "none"

export interface ComplianceScoreCell {
  compliant: number
  total: number
  ratio: number
  band: ComplianceScoreBand
}

export interface ComplianceDomainScore extends ComplianceScoreCell {
  domain: string
}

export interface ComplianceSiteScore extends ComplianceScoreCell {
  site_id: string | null
  site_name: string | null
}

export interface ComplianceMatrixCell extends ComplianceScoreCell {
  site_id: string | null
  site_name: string | null
  domain: string
}

export interface ComplianceScorecard {
  overall: ComplianceScoreCell
  byDomain: ComplianceDomainScore[]
  bySite: ComplianceSiteScore[]
  matrix: ComplianceMatrixCell[]
}

interface GetAllComplianceArgs {
  page: number
  limit: number
  searchTerm: string
  status?: string
  domain?: string
}

const complianceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllCompliance: builder.query<
      PaginatedApiResponse<ComplianceObligation>,
      GetAllComplianceArgs
    >({
      query: ({ page, limit, searchTerm, status, domain }) => ({
        url: `/compliance?${buildQueryString({ page, limit, searchTerm, status, domain })}`,
        method: "GET",
      }),
      providesTags: ["COMPLIANCE"],
    }),
    getComplianceById: builder.query<ApiResponse<ComplianceObligation>, string>({
      query: (id) => ({
        url: `/compliance/${id}`,
        method: "GET",
      }),
      providesTags: ["COMPLIANCE"],
    }),
    getComplianceScorecard: builder.query<
      ApiResponse<ComplianceScorecard>,
      void
    >({
      query: () => ({
        url: `/compliance/scorecard`,
        method: "GET",
      }),
      providesTags: ["COMPLIANCE"],
    }),
    createCompliance: builder.mutation<
      ApiResponse<ComplianceObligation>,
      Partial<ComplianceObligation>
    >({
      query: (data) => ({
        url: `/compliance`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["COMPLIANCE"],
    }),
    updateCompliance: builder.mutation<
      ApiResponse<ComplianceObligation>,
      { data: Partial<ComplianceObligation>; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/compliance/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["COMPLIANCE"],
    }),
    deleteCompliance: builder.mutation<
      ApiResponse<ComplianceObligation>,
      string
    >({
      query: (id) => ({
        url: `/compliance/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["COMPLIANCE"],
    }),
  }),
})

export const {
  useGetAllComplianceQuery,
  useGetComplianceByIdQuery,
  useGetComplianceScorecardQuery,
  useCreateComplianceMutation,
  useUpdateComplianceMutation,
  useDeleteComplianceMutation,
} = complianceApi
