import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { LineOfDefense } from "@/types/organization"

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
  // Issue #97. Always set — DB default is SECOND for pre-existing rows.
  line_of_defense: LineOfDefense
  // aexa-server#243 — which specific law/regulation/clause this obligation
  // derives from. Free text (see the backend's own schema comment).
  regulation_reference: string | null
  // aexa-server#250 — declared re-attestation cadence: "monthly" |
  // "quarterly" | "annual", or null/"one_time" for non-recurring.
  recurrence: string | null
  // aexa-server#250 — derived, never client-settable (stripped from
  // create/update payloads server-side even if sent). Seeded from due_date
  // at creation when a recurrence is set, then recomputed from
  // attested_at + the cadence's interval on every new attestation.
  next_review_date: string | null
  // aexa-server#250 — computed on every read from next_review_date
  // (falling back to due_date when unset), NOT a stored column. Prefer
  // this over re-deriving overdue-ness client-side (see with_overdue on
  // the backend) since it already accounts for next_review_date.
  overdue: boolean
  // aexa-server#531 — remediation action(s) raised against this obligation
  // (aexa-frontend#166's "Create Action" flow). Lets CompliancePage tell
  // "no action yet" from "one already exists" instead of always offering to
  // create a duplicate.
  actions: { id: string; actionTitle: string; status: string }[]
}

// aexa-server#250 — a permanent, append-only re-attestation record. Never
// updated/deleted once written; note is optional.
export interface ComplianceAttestation {
  id: string
  org_account_id: string
  obligation_id: string
  // accountId of whoever attested — plain string, not resolvable to a
  // display name through any endpoint this frontend currently has access
  // to (OrgMember's own shape only exposes account.email/profile, not the
  // underlying accountId to join against). Shown as-is for now.
  attested_by: string
  attested_at: string
  // A snapshot of ComplianceObligation.status at the moment this row was
  // written (backend: `status_at_attestation: current.status`, same
  // transaction) -- always the exact same value vocabulary as `status`
  // above, not a separate status enum, so reusing STATUS_BADGE/statusLabel
  // in the attestation-history UI is safe rather than a coincidental match.
  status_at_attestation: string
  note: string | null
  createdAt: string
}

// Computed scorecard returned by GET /compliance/scorecard. A cell's `band`
// follows the CDC 7.7 red/orange/green thresholds. The backend boundaries are
// inclusive on the lower edge (`>=`), so the exact semantics are: green when
// ratio >= 0.85 (85% and above), orange when 0.70 <= ratio < 0.85, red when
// ratio < 0.70. "none" means the cell/group has no applicable obligations.
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
  // Org-wide tally per status (e.g. { compliant: 12, non_compliant: 3, ... }).
  // Used by the summary cards so their counts reflect the whole org, not just
  // the current (server-paginated) page of the obligation list. Optional so
  // older cached responses / test fixtures without it degrade gracefully.
  statusCounts?: Record<string, number>
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
    // aexa-server#250. Response carries both the new attestation row and the
    // updated obligation (with its recomputed next_review_date/overdue), so
    // invalidating COMPLIANCE to refetch the list is enough -- no need to
    // hand-patch the cache from this mutation's own response.
    attestCompliance: builder.mutation<
      ApiResponse<{ attestation: ComplianceAttestation; obligation: ComplianceObligation }>,
      { id: string; note?: string }
    >({
      query: ({ id, note }) => ({
        url: `/compliance/${id}/attest`,
        method: "POST",
        // Found live-verifying the compliance decomposition round: an
        // omitted `body` here isn't an empty request -- fetchBaseQuery
        // still needs *something* to serialize, and `undefined` produces no
        // body at all, which the backend's `z.object({ note: ... })` schema
        // rejects outright ("expected object, received undefined") even
        // though `note` itself is optional. Always sending `{ note }`
        // degrades to `{}` for the common no-note case (JSON.stringify
        // drops the undefined key), which the same schema accepts.
        body: { note },
      }),
      invalidatesTags: ["COMPLIANCE"],
    }),
    getComplianceAttestations: builder.query<
      PaginatedApiResponse<ComplianceAttestation>,
      { id: string; page: number; limit: number }
    >({
      query: ({ id, page, limit }) => ({
        url: `/compliance/${id}/attestations?${buildQueryString({ page, limit })}`,
        method: "GET",
      }),
      providesTags: ["COMPLIANCE"],
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
  useAttestComplianceMutation,
  useGetComplianceAttestationsQuery,
} = complianceApi

export { complianceApi }
