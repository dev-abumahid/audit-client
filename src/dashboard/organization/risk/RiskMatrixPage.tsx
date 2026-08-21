import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import type { Risk } from "@/types/organization"
import { useMemo } from "react"
import RiskMatrixView from "./RiskMatrixView"

// PREVIEW-PROTO NOTE: this file used to be the whole page -- data-fetching,
// URL-synced state, and the matrix/grid JSX all in one component. It's now
// just the data-fetching shell: the two RTK Query hooks (unchanged from the
// original), normalized into the props RiskMatrixView expects. Everything
// that used to live below the hooks is byte-for-byte preserved in
// RiskMatrixView.tsx, which RiskMatrixPreview.tsx also renders, fed with
// static mock data instead of these hooks' results.
export default function RiskMatrixPage() {
  // quality-bar-loop round 3 (resilience, the round-1 finding carried
  // forward): isError was never checked on either query -- a genuine fetch
  // failure fell through to `risks: [] `/`sites: []` below and rendered a
  // fully-formed, normal-looking empty matrix (every cell present, all
  // reading 0), byte-for-byte indistinguishable from "this org genuinely
  // has zero risks."
  const {
    data: riskResponse,
    isLoading,
    isError: risksError,
  } = useGetAllRisksQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    category: "",
  })
  const { data: siteResponse, isError: sitesError } = useGetAllSitesQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })
  // ?? [] creates a fresh array reference every render when data is still
  // undefined, which would defeat filteredRisks' useMemo inside
  // RiskMatrixView -- memoized so the empty-array fallback is referentially
  // stable too.
  const risks: Risk[] = useMemo(() => riskResponse?.data ?? [], [riskResponse])
  const sites: { id: string; name: string }[] = siteResponse?.data ?? []

  return (
    <RiskMatrixView
      risks={risks}
      sites={sites}
      isLoading={isLoading}
      risksError={risksError}
      sitesError={sitesError}
    />
  )
}
