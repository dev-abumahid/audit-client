import { useMemo } from "react"
import {
  useAttestComplianceMutation,
  useCreateComplianceMutation,
  useDeleteComplianceMutation,
  useGetAllComplianceQuery,
  useGetComplianceScorecardQuery,
  useUpdateComplianceMutation,
} from "@/redux/apis/organization/compliance.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import { useGetAllOrgUsersQuery } from "@/redux/apis/organization/org.user.api"

interface UseComplianceDataArgs {
  page: number
  limit: number
  searchTerm: string
  status?: string
  domain?: string
}

// Round 11 (code quality finding): the last named gap on this axis (after
// round 5's submitWithToast dedup and round 6's modal decomposition) was
// the 3 RTK Query hooks + 4 mutations + their derived useMemos still
// inline in CompliancePage.tsx -- the exact same class of gap already
// closed on the KRI Dashboard this session via useKriData. One hook now
// owns obligation/scorecard/site fetching, indexing (none needed here --
// obligations/sites are already server-paginated/filtered), and the 4
// mutation triggers; the page owns only filter/pagination UI state and
// passes it in as args.
//
// `useGetComplianceAttestationsQuery`/`useGetComplianceEditHistoryQuery`
// deliberately stay in CompliancePage.tsx instead of here: both are
// `skip`-gated on which obligation's history modal is open -- genuinely
// UI-state-dependent, not page-wide data -- same boundary decision
// `useKriData` made for KRI's own skip-gated trend-readings query.
export function useComplianceData({
  page,
  limit,
  searchTerm,
  status,
  domain,
}: UseComplianceDataArgs) {
  // Filtering, searching and pagination are all applied server-side (the
  // /compliance list endpoint supports searchTerm / status / domain + page /
  // limit), so results are never silently capped at the first page.
  // quality-bar-loop-derived fix: this query never checked isError before --
  // a genuine fetch failure fell through to `complianceData?.data || []`,
  // rendering the same empty-table state as "no obligations match this
  // filter" (the same false-all-clear pattern already fixed for
  // RiskRegisterPage/aexa-frontend#620's round-4). Also feeds the header
  // subtitle, which previously read "0 obligations tracked" during both
  // loading and error states.
  const {
    data: complianceData,
    isLoading,
    isError: complianceError,
  } = useGetAllComplianceQuery({ page, limit, searchTerm, status, domain })
  // Same discarded-isError bug fixed for this page's own useGetAllComplianceQuery
  // (aexa-frontend#625) -- this is a separate query, out of that PR's scope,
  // but the same false-all-clear pattern: a fetch failure previously fell
  // through to `scorecardData?.data` being undefined, which the summary cards
  // and site x domain matrix already treat identically to "no data yet" (a
  // genuinely empty org), with zero visual distinction.
  const { data: scorecardData, isError: scorecardError } =
    useGetComplianceScorecardQuery()
  // Round 4 (code quality finding): this query's own isError was
  // discarded, same false-all-clear pattern the comment above already
  // documents for scorecardError -- a fetch failure here previously fell
  // through to the same `?? []` empty-array fallback the site select uses
  // for a genuinely site-less org, with zero visual distinction.
  const { data: sitesData, isError: sitesError } = useGetAllSitesQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })
  // quality-bar-loop round (industry-standards, fresh-panel finding):
  // `owner` (ComplianceFormModal) is a plain free-text field with no
  // binding to a real org member -- unlike reference GRC tools, where
  // control owners are real users. A full relational owner (a new
  // ownerAccountId FK + backend migration) is out of scope for a
  // frontend-only round, but the exact same "free text stays free text,
  // but nudge toward canonical spelling via a <datalist> sourced from
  // real org members" pattern already shipped for AuditPage's
  // lead_auditor field (round 6) applies here too -- same underlying
  // constraint (no Account relation to migrate to without a schema
  // change), same fix shape.
  const { data: orgUsersData } = useGetAllOrgUsersQuery(undefined)
  const ownerSuggestions = Array.from(
    new Set(
      (orgUsersData?.data ?? [])
        .map((m) => m.account?.profile?.fullName || m.account?.email)
        .filter((name): name is string => !!name)
    )
  )

  const [createCompliance, { isLoading: isCreating }] =
    useCreateComplianceMutation()
  const [updateCompliance, { isLoading: isUpdating }] =
    useUpdateComplianceMutation()
  const [deleteCompliance] = useDeleteComplianceMutation()
  const [attestCompliance, { isLoading: isAttesting }] =
    useAttestComplianceMutation()

  const obligations = useMemo(
    () => complianceData?.data || [],
    [complianceData]
  )
  const meta = complianceData?.meta
  const totalPages = meta?.totalPage ?? 0
  const scorecard = scorecardData?.data
  // Round 9 (efficiency finding): `|| []` creates a fresh array reference
  // every render when data is still undefined, which would defeat
  // `sitesById`-style memoization in the page -- same efficiency-round-3
  // pattern already applied to `obligations` above.
  const sites = useMemo(() => sitesData?.data ?? [], [sitesData])

  return {
    obligations,
    meta,
    totalPages,
    isLoading,
    complianceError,
    scorecard,
    scorecardError,
    sites,
    sitesError,
    ownerSuggestions,
    createCompliance,
    isCreating,
    updateCompliance,
    isUpdating,
    deleteCompliance,
    attestCompliance,
    isAttesting,
  }
}
