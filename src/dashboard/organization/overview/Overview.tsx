import { useGetMeQuery } from "@/redux/apis/auth.api"
import { useGetAllAlertsQuery } from "@/redux/apis/organization/alert.api"
import { useGetAllFindingsQuery } from "@/redux/apis/organization/findings.api"
import { useGetAllInspectionQuery } from "@/redux/apis/organization/inspection.api"
import { useGetAllKriQuery } from "@/redux/apis/organization/kri.api"
import { useGetCorrelationMatrixDataQuery } from "@/redux/apis/organization/riskLink.api"
import {
  useGetAllRisksQuery,
  useGetEbitdaAtRiskSummaryQuery,
} from "@/redux/apis/organization/risk.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import type { Risk } from "@/types/organization"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import OverviewView from "./OverviewView"

// PREVIEW-PROTO NOTE (Phase B2, same split as RiskMatrixPage.tsx in Phase
// B1): this file used to be the whole page -- all 7 RTK Query hooks plus
// useGetMeQuery, every derived value (categoryData, PageRank/Tipping
// Points, the loading/error gates), and the entire dashboard JSX all in one
// component. It's now just the data-fetching shell: every hook, unchanged
// from the original, normalized into the grouped props OverviewView
// expects (see OverviewViewProps' own comment for why grouped rather than
// flat). Everything that used to live below the hooks is byte-for-byte
// preserved in OverviewView.tsx, which OverviewPreview.tsx also renders,
// fed with static mock data instead of these hooks' results.
export default function Overview() {
  const { t } = useTranslation()
  // aexa-frontend#471 -- organization.overview.description used to hardcode
  // a fictional company name ("CEBI International S.A.") under every
  // organization's dashboard. useGetMeQuery already exposes the real
  // organizationProfile.organizationName (see OrgSettingPage.tsx for the
  // same pattern) -- interpolated into the description string instead, with
  // a generic fallback for the brief window before /auth/me resolves.
  const { data: meResponse } = useGetMeQuery(undefined)
  const orgName =
    meResponse?.data?.organizationProfile?.organizationName ||
    t("organization.overview.defaultOrgName")
  const {
    data: riskResponse,
    isLoading: risksLoading,
    isError: risksError,
  } = useGetAllRisksQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    category: "",
  })
  const {
    data: kriResponse,
    isLoading: krisLoading,
    isError: krisError,
  } = useGetAllKriQuery(undefined)
  const {
    data: alertResponse,
    isLoading: alertsLoading,
    isError: alertsError,
  } = useGetAllAlertsQuery(undefined)
  // Same limit:100-and-count-client-side approach as the risks query above
  // — getAllFindings/getAllInspection have no status-only "give me the
  // count" endpoint, and #25 didn't ask for a new backend aggregation route.
  const {
    data: findingResponse,
    isLoading: findingsLoading,
    isError: findingsError,
  } = useGetAllFindingsQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
  })
  const {
    data: inspectionResponse,
    isLoading: inspectionsLoading,
    isError: inspectionsError,
  } = useGetAllInspectionQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    status: "",
    siteId: "",
  })
  // Reuses the same endpoint the Correlation Matrix page (#142) calls — just
  // for its riskLinks here, to compute real PageRank over the risk-causality
  // graph for the Tipping Points section below (#25).
  const {
    data: correlationMatrixResponse,
    isLoading: correlationLoading,
    isError: correlationError,
  } = useGetCorrelationMatrixDataQuery()
  // Same limit:100-and-sum-client-side approach as the risks/findings
  // queries above — GET /site has no aggregation route, so this reuses the
  // per-site `revenue` field (site.validation.ts) to total the Revenue KPI
  // card below instead of hardcoding it (#427). Unlike the Tipping Points
  // section below, there's no unpaginated GET /site equivalent to
  // correlation-matrix's full risk list to fall back on, so an org with
  // more than 100 sites will have its revenue total silently undercounted
  // by this card until GET /site grows either a real aggregation route or
  // an unpaginated mode -- flagged here rather than fixed since that's
  // backend work out of scope for #427.
  const {
    data: siteResponse,
    isLoading: sitesLoading,
    isError: sitesError,
  } = useGetAllSitesQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })
  // aexa-server#347: real org-wide EBITDA-at-risk distribution, replacing
  // this page's previous hardcoded static P5...P95 array.
  const {
    data: ebitdaSummaryResponse,
    isLoading: ebitdaSummaryLoading,
    isError: ebitdaSummaryError,
  } = useGetEbitdaAtRiskSummaryQuery()

  // Memoized (rather than a plain `?? []`) so its reference stays stable
  // across renders where riskResponse hasn't changed -- OverviewView's own
  // categoryData useMemo depends on this.
  const risks: Risk[] = useMemo(() => riskResponse?.data ?? [], [riskResponse])

  return (
    <OverviewView
      orgName={orgName}
      risks={{ data: risks, isLoading: risksLoading, isError: risksError }}
      kris={{
        data: kriResponse?.data ?? [],
        isLoading: krisLoading,
        isError: krisError,
      }}
      alerts={{
        data: alertResponse?.data ?? [],
        isLoading: alertsLoading,
        isError: alertsError,
      }}
      findings={{
        data: findingResponse?.data ?? [],
        isLoading: findingsLoading,
        isError: findingsError,
      }}
      inspections={{
        data: inspectionResponse?.data ?? [],
        isLoading: inspectionsLoading,
        isError: inspectionsError,
      }}
      correlationMatrix={{
        data: correlationMatrixResponse?.data,
        isLoading: correlationLoading,
        isError: correlationError,
      }}
      sites={{
        data: siteResponse?.data ?? [],
        isLoading: sitesLoading,
        isError: sitesError,
      }}
      ebitda={{
        data: ebitdaSummaryResponse?.data,
        isLoading: ebitdaSummaryLoading,
        isError: ebitdaSummaryError,
      }}
    />
  )
}
