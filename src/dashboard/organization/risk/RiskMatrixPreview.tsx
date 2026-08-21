import { assertPreviewOnly } from "@/utils/assertPreviewOnly"
import RiskMatrixView from "./RiskMatrixView"
import { MOCK_RISKS, MOCK_SITES } from "./riskMatrixMockData"

// PREVIEW-PROTO: proof-of-concept demo entry point. Renders the exact same
// RiskMatrixView the real authenticated RiskMatrixPage.tsx renders, fed
// with static mock data instead of live RTK Query results -- no
// useGetAllRisksQuery/useGetAllSitesQuery call anywhere in this tree, and
// (via SiteFilter's new sitesOverride prop) no live call from the nested
// SiteFilter either. Registered at /preview/risk-matrix in MainRoute.tsx
// for this worktree's live verification only -- throwaway scaffolding, not
// meant to ship as-is (a real landing-page integration would live outside
// the authenticated route tree, without a matching MainRoute entry).
export default function RiskMatrixPreview() {
  // Runtime tripwire: this component only ever renders mock data and must
  // never reach a real production build without an explicit opt-in -- see
  // assertPreviewOnly's own comment for why.
  assertPreviewOnly("RiskMatrixPreview")

  return (
    <RiskMatrixView
      risks={MOCK_RISKS}
      sites={MOCK_SITES}
      isLoading={false}
      risksError={false}
      sitesError={false}
    />
  )
}
