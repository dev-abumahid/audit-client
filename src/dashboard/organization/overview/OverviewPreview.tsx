import { assertPreviewOnly } from "@/utils/assertPreviewOnly"
import OverviewView from "./OverviewView"
import {
  MOCK_ALERTS,
  MOCK_CORRELATION_MATRIX_DATA,
  MOCK_EBITDA_SUMMARY,
  MOCK_FINDINGS,
  MOCK_INSPECTIONS,
  MOCK_KRIS,
  MOCK_ORG_NAME,
  MOCK_RISKS,
  MOCK_SITES,
} from "./overviewMockData"

// PREVIEW-PROTO: proof-of-concept demo entry point, same shape as
// RiskMatrixPreview.tsx (Phase B1). Renders the exact same OverviewView the
// real authenticated Overview.tsx renders, fed with static mock data
// instead of live RTK Query results -- no useGetAllRisksQuery/
// useGetAllKriQuery/useGetAllAlertsQuery/useGetAllFindingsQuery/
// useGetAllInspectionQuery/useGetCorrelationMatrixDataQuery/
// useGetAllSitesQuery/useGetEbitdaAtRiskSummaryQuery/useGetMeQuery call
// anywhere in this tree, and (via CriticalAlertBanner's new
// alertsOverride prop) no live call from the nested CriticalAlertBanner
// either. Not registered on any route in this PR -- throwaway scaffolding
// used for this worktree's own live verification only (a temporary route
// was added and reverted before committing, same workflow RiskMatrixPreview
// documented in Phase B1's PR). A real landing-page integration is Phase
// E's job, once the landing page actually consumes this pattern.
export default function OverviewPreview() {
  // Runtime tripwire: this component only ever renders mock data and must
  // never reach a real production build without an explicit opt-in -- see
  // assertPreviewOnly's own comment for why.
  assertPreviewOnly("OverviewPreview")

  return (
    <OverviewView
      orgName={MOCK_ORG_NAME}
      risks={{ data: MOCK_RISKS, isLoading: false, isError: false }}
      kris={{ data: MOCK_KRIS, isLoading: false, isError: false }}
      alerts={{ data: MOCK_ALERTS, isLoading: false, isError: false }}
      findings={{ data: MOCK_FINDINGS, isLoading: false, isError: false }}
      inspections={{ data: MOCK_INSPECTIONS, isLoading: false, isError: false }}
      correlationMatrix={{
        data: MOCK_CORRELATION_MATRIX_DATA,
        isLoading: false,
        isError: false,
      }}
      sites={{ data: MOCK_SITES, isLoading: false, isError: false }}
      ebitda={{ data: MOCK_EBITDA_SUMMARY, isLoading: false, isError: false }}
    />
  )
}
