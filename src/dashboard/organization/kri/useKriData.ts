import { useMemo } from "react"
import {
  useCreateNewKriMutation,
  useDeleteKriMutation,
  useGetAllKriQuery,
  useSubmitKriValueMutation,
  useUpdateKriMutation,
} from "@/redux/apis/organization/kri.api"
import { useGetAllAlertsQuery } from "@/redux/apis/organization/alert.api"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import type { Alert, Risk } from "@/types/organization"

// Round 19 (code quality finding): the last named half of round-17/18's
// "whole component doing everything in one function" gap -- 3 RTK Query
// hooks, 4 mutations, and their derived useMemos (risksById,
// unreadAlertsByKriId, the alert/warning/ok summary) were still inline in
// KriDashboardPage.tsx after round 18 pulled the modals out. Everything
// this hook owns is genuinely one concern (fetch KRIs/risks/alerts, index
// them, mutate KRIs) independent of which modal is open or what the New/
// Edit KRI forms currently hold -- a new engineer adding a 5th piece of
// KRI-list-derived state now has an obvious seam to put it in.
//
// The trend-readings query (`useGetKriReadingsQuery`) deliberately stays
// in KriDashboardPage.tsx instead of here: it's `skip`-gated on
// `trendKriId`, genuinely UI-state-dependent (is the trend modal open,
// and for which KRI), not page-wide data the rest of the dashboard needs
// -- pulling it in here would just relocate the same tight coupling this
// hook exists to remove.
export function useKriData() {
  const {
    data: kriResponse,
    isLoading: krisLoading,
    error: krisError,
  } = useGetAllKriQuery(undefined)
  // Fresh full-panel re-score (resilience finding): neither secondary
  // query below checked isError -- a genuine fetch failure fell through
  // to the same `?? []` empty-array fallback every KRI card already uses
  // when a risk/alert genuinely doesn't exist, so a real outage looked
  // identical to "this KRI has no related risk/alerts." Same
  // isError-omission bug class already fixed on Alerts/Intelligence/etc.
  // this session.
  const { data: riskResponse, isError: risksError } = useGetAllRisksQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    category: "",
  })
  // aexa-frontend#530: drives the per-card alert-count badge -- the other,
  // already-shipped half of this cross-link is AlertsPage.tsx's "View KRI"
  // link, which lands on KriDashboardPage with a ?highlight= param.
  const { data: alertsResponse, isError: alertsError } =
    useGetAllAlertsQuery(undefined)
  const [createKri] = useCreateNewKriMutation()
  const [submitKriValue] = useSubmitKriValueMutation()
  const [updateKri] = useUpdateKriMutation()
  const [deleteKri] = useDeleteKriMutation()

  // quality-bar-loop round 3 (efficiency, review finding): `?? []` creates
  // a fresh array reference every render when data is still undefined,
  // which would defeat every useMemo below keyed on these -- memoized so
  // the empty-array fallback is referentially stable too.
  const kris = useMemo(() => kriResponse?.data ?? [], [kriResponse])
  const risks = useMemo(() => riskResponse?.data ?? [], [riskResponse])
  const alerts = useMemo(() => alertsResponse?.data ?? [], [alertsResponse])
  // quality-bar-loop round 3 (efficiency, round-1 finding): a plain
  // `risks.find(...)` inside the KRI `.map()` in the page was an O(n*m)
  // lookup instead of a pre-built index -- at "low hundreds of KRIs x low
  // hundreds of risks" that's a few thousand redundant scans per render.
  const risksById = useMemo(
    () => new Map(risks.map((r: Risk) => [r.id, r])),
    [risks]
  )
  // Unread only: a read alert no longer represents an outstanding issue on
  // the KRI, so it shouldn't keep inflating this badge indefinitely.
  // quality-bar-loop round 3 (efficiency, round-1 finding): recomputed
  // every render before this, including on every keystroke in the New KRI
  // form (unrelated state that now lives in the page, not this hook).
  const unreadAlertsByKriId = useMemo(
    () =>
      alerts.reduce<Record<string, Alert[]>>((acc, alert: Alert) => {
        if (alert.kri_id && !alert.is_read) {
          acc[alert.kri_id] = [...(acc[alert.kri_id] ?? []), alert]
        }
        return acc
      }, {}),
    [alerts]
  )
  // quality-bar-loop round 3 (efficiency, round-1 finding): three separate
  // `.filter().length` passes over `kris` recomputed every render (same
  // unrelated-state-triggers-rescan issue as above) -- combined into a
  // single pass.
  const { alertCount, warningCount, okCount } = useMemo(() => {
    let alert = 0
    let warning = 0
    let ok = 0
    for (const k of kris) {
      if (k.status === "ALERT") alert++
      else if (k.status === "WARNING") warning++
      else if (k.status === "OK") ok++
    }
    return { alertCount: alert, warningCount: warning, okCount: ok }
  }, [kris])

  return {
    kris,
    risks,
    risksById,
    unreadAlertsByKriId,
    krisLoading,
    krisError,
    risksError,
    alertsError,
    alertCount,
    warningCount,
    okCount,
    createKri,
    submitKriValue,
    updateKri,
    deleteKri,
  }
}
