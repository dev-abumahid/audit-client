import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type { LineOfDefense } from "@/types/organization"

/**
 * Issue #97 — "Three Lines of Defense" governance classification board.
 *
 * Response shape verified directly against the live aexa-server source
 * (governance.service.ts's get_three_lines_of_defense_from_db, main branch,
 * PR #229): every row across all 5 entity types is normalized to a common
 * `{ id, title, line_of_defense, ...secondary fields }` shape server-side —
 * NOT each entity's own list-endpoint field names (e.g. Risk.name /
 * Action.actionTitle are already renamed to `title` by the backend before
 * this endpoint returns them). `line_of_defense` is nullable only on
 * `actions` (an existing Action created before #97 with no classification
 * yet — rendered as an "Unclassified" bucket, not defaulted to a line).
 */

interface ThreeLinesRiskRow {
  id: string
  title: string
  category: string
  status: string
  line_of_defense: LineOfDefense
}

interface ThreeLinesActionRow {
  id: string
  title: string
  priority: string
  status: string
  line_of_defense: LineOfDefense | null
}

interface ThreeLinesKriRow {
  id: string
  title: string
  unit: string
  status: string
  line_of_defense: LineOfDefense
}

interface ThreeLinesComplianceRow {
  id: string
  title: string
  domain: string
  status: string
  line_of_defense: LineOfDefense
}

interface ThreeLinesAuditRow {
  id: string
  title: string
  status: string
  lead_auditor: string | null
  line_of_defense: LineOfDefense
}

export interface ThreeLinesOfDefenseResponse {
  risks: ThreeLinesRiskRow[]
  actions: ThreeLinesActionRow[]
  kris: ThreeLinesKriRow[]
  complianceObligations: ThreeLinesComplianceRow[]
  auditEngagements: ThreeLinesAuditRow[]
}

const governanceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getThreeLinesOfDefense: builder.query<
      ApiResponse<ThreeLinesOfDefenseResponse>,
      void
    >({
      query: () => ({
        url: `/governance/three-lines-of-defense`,
        method: "GET",
      }),
      // Also tagged with every underlying entity's own tag (not just
      // GOVERNANCE) so this board refetches automatically whenever a
      // reassignment goes through one of the entities' own update mutations
      // (updateRisk/updateFindingById/updateKri/updateCompliance/
      // updateAuditEngagement each invalidate their own tag already —
      // reassignment reuses those existing mutations rather than duplicating
      // them here).
      providesTags: [
        "GOVERNANCE",
        "RISK",
        "FINDINGS",
        "KRI",
        "COMPLIANCE",
        "AUDIT",
      ],
    }),
  }),
})

export const { useGetThreeLinesOfDefenseQuery } = governanceApi
