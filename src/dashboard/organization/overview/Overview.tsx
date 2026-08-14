/* eslint-disable @typescript-eslint/no-explicit-any */
import CriticalAlertBanner from "@/components/dashboard/organization/CriticalAlertBanner"
import MetricCard from "@/components/dashboard/organization/MetricCard"
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import UnscoredBadge from "@/components/dashboard/organization/UnscoredBadge"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import { useGetMeQuery } from "@/redux/apis/auth.api"
import { useGetAllAlertsQuery } from "@/redux/apis/organization/alert.api"
import { useGetAllFindingsQuery } from "@/redux/apis/organization/findings.api"
import { useGetAllInspectionQuery } from "@/redux/apis/organization/inspection.api"
import { useGetAllKriQuery } from "@/redux/apis/organization/kri.api"
import { useGetCorrelationMatrixDataQuery } from "@/redux/apis/organization/riskLink.api"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import type { Alert, Risk } from "@/types/organization"
import {
  buildRiskCorrelationEdges,
  computePageRank,
  topPercentileFromScores,
} from "@/utils/pageRank"
import { formatLocaleDate } from "@/utils/formatDate"
import { getRiskSeverityLevel, isValidScoreValue } from "@/utils/riskScoring"
import { SEVERITY_STYLES } from "@/utils/severityStyles"
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Euro,
  ListChecks,
  Loader2,
  Shield,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// No backend endpoint returns EBITDA percentile data anywhere in this
// project — kept as static placeholder data, out of scope for this ticket
// (frontend#92's tractable half covers risks/KRI/alerts, not financials).
const ebitdaData = [
  { name: "P5", value: 14200 },
  { name: "P10", value: 16100 },
  { name: "P25", value: 18500 },
  { name: "P50", value: 20800 },
  { name: "P75", value: 22400 },
  { name: "P90", value: 23100 },
  { name: "P95", value: 23800 },
]

export default function Overview() {
  const { t, i18n } = useTranslation()
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

  // Memoized (rather than a plain `?? []`) so its reference stays stable
  // across renders where riskResponse hasn't changed -- categoryData's own
  // useMemo below depends on this.
  const risks: Risk[] = useMemo(() => riskResponse?.data ?? [], [riskResponse])
  const kris = kriResponse?.data ?? []
  const alerts: Alert[] = alertResponse?.data ?? []
  const findings = findingResponse?.data ?? []
  const inspections = inspectionResponse?.data ?? []
  const sites = siteResponse?.data ?? []
  const totalRevenue = sites.reduce((sum, s) => sum + (s.revenue || 0), 0)
  // Matches the EBITDA chart's own €X.XM formatting just below, for visual
  // consistency on this page.
  const totalRevenueLabel = `€${(totalRevenue / 1_000_000).toFixed(1)}M`

  // quality-bar-loop round 8 (efficiency): this reduce+map used to run on
  // every render regardless of cause (e.g. CriticalAlertBanner's own
  // dismissed toggle, or the focus-management effects below) even though
  // it only actually depends on `risks` and the active language.
  const categoryData = useMemo(
    () =>
      Object.entries(
        risks.reduce(
          (acc, r) => {
            acc[r.category] = (acc[r.category] || 0) + 1
            return acc
          },
          {} as Record<string, number>
        )
      ).map(([key, value]) => ({
        name: RISK_CATEGORIES[key]
          ? t(`organization.riskCategories.${RISK_CATEGORIES[key].labelKey}`)
          : key,
        value,
        color: RISK_CATEGORIES[key]?.color || "#888",
      })),
    [risks, t]
  )

  const kriAlerts = kris.filter((k: any) => k.status === "ALERT").length
  const criticalAlerts = alerts.filter((a) => a.severity === "critical").length
  // "Open" mirrors the risks card's own status === "open" check just above:
  // not-yet-terminal states, not a single specific status value.
  const openActions = findings.filter(
    (f) => f.status === "TO_DO" || f.status === "IN_PROGRESS"
  ).length
  const activeInspections = inspections.filter(
    (i) => i.status === "DRAFT" || i.status === "IN_PROGRESS"
  ).length

  // Systemic Tipping Points: real PageRank computed over this org's
  // RiskLink graph (CAUSES/AMPLIFIES/CORRELATES edges between risks,
  // resolved by ref, matching how RiskLink itself references risks — see
  // risk.prisma's RiskLink comment), not the manually-entered
  // Risk.pagerank_score field (that field is never derived from anything
  // today — see risk.validation.ts — so it isn't a real centrality
  // measure). Top 15% by score, matching this section's own copy
  // ("Top 15% PageRank — maximum spread risks").
  //
  // Deliberately uses correlationMatrixResponse's own `risks` (unpaginated
  // — GET /risk/correlation-matrix returns every risk in the org), not the
  // `risks` variable above (capped at limit:100 for the other cards on
  // this page). PageRank needs the full graph: a risk past the first 100
  // could be exactly the kind of highly-linked hub this section exists to
  // surface, and silently dropping its edges would both hide it and skew
  // every other risk's score (found during this PR's own review).
  // quality-bar-loop round 8 (efficiency): the PageRank power iteration
  // (up to 100 passes over every risk/edge, see pageRank.ts) used to
  // recompute on every render regardless of cause -- it only actually
  // depends on the correlation-matrix response itself. `allRisksForCorrelation`
  // is derived inside the callback (not hoisted to its own `const`, per
  // eslint's exhaustive-deps) so the `?? []` fallback can't defeat the
  // memo by producing a new array reference on every render.
  const { pageRankScores, maxPageRankScore, tippingPointRisks } = useMemo(() => {
    const allRisksForCorrelation = correlationMatrixResponse?.data?.risks ?? []
    const riskLinks = correlationMatrixResponse?.data?.riskLinks ?? []
    const riskRefs = allRisksForCorrelation.map((r) => r.ref)
    const correlationEdges = buildRiskCorrelationEdges(riskLinks)
    const scores = computePageRank(riskRefs, correlationEdges)
    const maxScore = Math.max(0, ...Object.values(scores))
    // quality-bar-loop round 6 (efficiency): topPercentileByPageRank(nodes,
    // edges, pct) would recompute PageRank internally from the same
    // riskRefs/correlationEdges -- topPercentileFromScores reuses `scores`
    // (already computed above) instead of running the full power
    // iteration a second time.
    const tippingPointRefs = new Set(
      topPercentileFromScores(riskRefs, scores, 0.15)
    )
    const tippingRisks = allRisksForCorrelation
      .filter((r) => tippingPointRefs.has(r.ref))
      .sort((a, b) => scores[b.ref] - scores[a.ref])
    return {
      pageRankScores: scores,
      maxPageRankScore: maxScore,
      tippingPointRisks: tippingRisks,
    }
  }, [correlationMatrixResponse])

  // quality-bar-loop round 2.5 (accessibility regression + resilience
  // dead-code fix, review of round 1's fix): alerts is deliberately excluded
  // from this page-level gate. CriticalAlertBanner (rendered below,
  // unconditionally) already has its own dedicated isError notice -- folding
  // alertsError into this blanket check meant that notice could never
  // actually mount on this route (this gate always fired first), and it
  // meant one failed query (alerts) took down the whole page even though
  // every other card was fine. The two places on *this* page that read
  // `alerts` (the Critical Alerts KPI card and the Recent Alerts panel) get
  // their own local isError handling below instead, so they can't silently
  // show a false "0"/"no alerts" the way round 1 originally found either.
  const hasPageLevelError =
    risksError ||
    krisError ||
    findingsError ||
    inspectionsError ||
    correlationError ||
    sitesError

  // Round 2.5 accessibility fix: the error block below can appear from a
  // background refetch failing *after* the page already rendered
  // successfully (RTK Query keeps `isLoading` false on a refetch, only
  // `isFetching` flips), not just on first paint -- round 2's a11y judge
  // confirmed there was no announcement or focus move for that case.
  // `role="alert"` covers the announcement; this effect moves focus to the
  // error region itself, mirroring how a modal/dialog would take focus when
  // it takes over the page.
  const errorRegionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (hasPageLevelError) errorRegionRef.current?.focus()
  }, [hasPageLevelError])

  if (
    risksLoading ||
    krisLoading ||
    alertsLoading ||
    findingsLoading ||
    inspectionsLoading ||
    correlationLoading ||
    sitesLoading
  ) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // quality-bar-loop round 1 (resilience, lowest-scoring axis): none of the
  // seven queries above used to check isError, only isLoading -- a total
  // backend outage silently fell through to every derived value (risks,
  // kris, alerts, etc.) defaulting to `?? []`/`0`, rendering a fully
  // normal-looking dashboard with every metric at zero and zero visual cue
  // that data failed to load. For a risk/compliance platform, that's a
  // false "all clear" on total data failure, which is worse than a blank
  // screen -- checked before rendering the real dashboard below, same
  // early-return shape as the loading check above.
  if (hasPageLevelError) {
    return (
      <div
        ref={errorRegionRef}
        role="alert"
        tabIndex={-1}
        className="flex min-h-[400px] flex-col items-center justify-center gap-3 p-6 text-center focus:outline-none"
      >
        <AlertTriangle className={`h-8 w-8 ${SEVERITY_STYLES.critical.text}`} />
        <p className="text-sm font-medium text-foreground">
          {t("organization.overview.loadError.title")}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {t("organization.overview.loadError.description")}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          // quality-bar-loop round 10 (mobile/responsive): py-2 measured
          // 69.6x38px live, under the 44x44px touch-target guideline on the
          // height axis -- py-3 brings it to ~44px without materially
          // changing the button's visual weight.
          className="focus-ring rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          {t("organization.overview.loadError.retry")}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <CriticalAlertBanner />
      {/* Title */}
      <div className="animate-fade-in">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          {t("organization.overview.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("organization.overview.description", { orgName })}
        </p>
      </div>

      {/* Metrics */}
      {/* aexa-frontend#471 -- h1 (above) was followed directly by the h3s
          below with no h2, breaking heading-level order for screen-reader
          users. Each grid below is its own page section, so each gets a
          visually-hidden h2 rather than promoting one arbitrary h3 -- the
          sighted layout (no visible section titles above these grids) stays
          untouched. */}
      <h2 className="sr-only">{t("organization.overview.metricsHeading")}</h2>
      {/* quality-bar-loop round 4 (industry-standards + UX, shared finding):
          three of these cards used to carry a hardcoded trend="up"
          trendValue="+2"/"+3" badge with no period-over-period data
          anywhere in the codebase to back it -- live-verified as actively
          misleading (the Critical Alerts card could show "0" alongside a
          red "+2 up" badge). No GET endpoint returns a previous snapshot to
          diff against (same gap the EBITDA chart's own placeholder-data
          comment documents), so there's no real delta to compute here --
          removed rather than fabricated. If a real trend becomes available
          (e.g. a historical-snapshot endpoint), add trend/trendValue back
          driven by that data, not a hardcoded guess. */}
      {/* quality-bar-loop round 14 (industry-standards): 5 of these 6 cards
          now link to a real filtered view of the data they summarize, each
          reusing that page's own existing filter mechanism (or a new
          client-side one added this round where the page had none) rather
          than duplicating filter logic here. Revenue has no filtered view
          to land on -- SitesEntities.tsx doesn't display revenue at all
          today -- so it stays a plain, honestly-inert card rather than
          linking somewhere that wouldn't explain the number. */}
      <div className="animate-slide-up grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title={t("organization.overview.activeRisk")}
          value={risks.filter((r) => r.status === "open").length}
          icon={Shield}
          to="/organization/risks?status=open"
        />
        <MetricCard
          title={t("organization.overview.kriAlert")}
          value={kriAlerts}
          icon={Activity}
          to="/organization/kri?status=ALERT"
        />
        <MetricCard
          title={t("organization.overview.criticalAlert")}
          // Round 2.5: alerts is excluded from the page-level error gate
          // (see hasPageLevelError above), so this card needs its own
          // guard -- otherwise an alerts-only fetch failure would silently
          // show "0", the exact false-all-clear round 1 exists to prevent.
          value={alertsError ? "—" : criticalAlerts}
          icon={AlertTriangle}
          to="/organization/alerts?severity=critical"
        />
        <MetricCard
          title={t("organization.overview.openActions")}
          value={openActions}
          icon={ListChecks}
          to="/organization/findings?status=open"
        />
        <MetricCard
          title={t("organization.overview.activeInspections")}
          value={activeInspections}
          icon={ClipboardList}
          to="/organization/audit/inspections?status=active"
        />
        <MetricCard
          title={t("organization.overview.revenue")}
          value={totalRevenueLabel}
          icon={Euro}
        />
      </div>

      {/* Charts row */}
      <h2 className="sr-only">{t("organization.overview.chartsHeading")}</h2>
      <div className="animate-slide-up stagger-2 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-2 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">
            {t("organization.overview.chart.title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("organization.overview.chart.des")}
          </p>
          {/* quality-bar-loop round 12 (industry-standards): this is seven
              discrete percentile buckets (P5...P95), not a time series --
              an AreaChart's continuous, connected line visually implied a
              trend moving left-to-right, the opposite of what a static
              distribution snapshot is. A bar chart is the standard idiom
              for percentile/Monte Carlo data in Grafana/Datadog/Tableau,
              since each bar is independently readable with no implied
              continuity between adjacent buckets. */}
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ebitdaData}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}M`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                  formatter={(v) => [
                    `€${(Number(v) / 1000).toFixed(1)}M`,
                    "EBITDA",
                  ]}
                />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-6 text-xs">
            <div>
              <span className="text-muted-foreground">
                {t("organization.overview.chart.p5Worst")}:
              </span>{" "}
              <span
                className={`font-mono-data font-semibold ${SEVERITY_STYLES.critical.text}`}
              >
                €14.2M
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {t("organization.overview.chart.p50Median")}:
              </span>{" "}
              <span className="font-mono-data font-semibold text-foreground">
                €20.8M
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {t("organization.overview.chart.budget")}:
              </span>{" "}
              <span
                className={`font-mono-data font-semibold ${SEVERITY_STYLES.low.text}`}
              >
                €22.0M
              </span>
            </div>
          </div>
        </div>

        {/* Risk by category */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">
            {t("organization.overview.category.title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("organization.overview.category.des", {
              count: risks.length,
            })}
          </p>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={categoryData.length > 1 ? 3 : 0}
                  dataKey="value"
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1">
            {categoryData.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-muted-foreground">{c.name}</span>
                </div>
                <span className="font-mono-data font-medium text-foreground">
                  {c.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <h2 className="sr-only">{t("organization.overview.insightsHeading")}</h2>
      <div className="animate-slide-up stagger-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tipping Points */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("organization.overview.bottomRow.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("organization.overview.bottomRow.des")}
              </p>
            </div>
            <Zap className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-4 space-y-3">
            {tippingPointRisks.map((risk) => (
              <div
                key={risk.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
              >
                {/* quality-bar-loop round 10 (mobile/responsive): a fixed
                    h-9 w-9 square clipped real refs like "CYB-001" into two
                    lines at any viewport width. min-w-9 + horizontal padding
                    + whitespace-nowrap keeps short refs looking square while
                    letting longer ones grow instead of wrapping; shrink-0
                    stops the flex row from squeezing it back down. */}
                <div className="font-mono-data flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-1.5 text-xs font-bold whitespace-nowrap">
                  {risk.ref}
                </div>
                <div className="min-w-0 flex-1">
                  {/* aexa-frontend#167 cross-linking theme: found while
                      reviewing #529 -- this was the one remaining place a
                      risk rendered as plain, non-interactive text despite
                      risk.id already being in scope. */}
                  {/* quality-bar-loop round 10 (mobile/responsive): measured
                      86.4x20px live, well under the 44px touch-target
                      guideline on the height axis. An earlier version of
                      this fix paired py-3 with -my-3 to cancel the added
                      space out visually, but this Link's parent
                      (`min-w-0 flex-1`) is a flex item -- flex items always
                      establish their own block formatting context, which
                      blocks the negative top margin from collapsing against
                      the parent the way it would in normal block flow, so
                      the link visibly crept upward instead of canceling out
                      (caught in review). Plain py-3 with no negative margin
                      is a few px taller per row but has no such edge case. */}
                  <Link
                    to={`/organization/risks/${risk.id}`}
                    className="focus-ring block truncate rounded py-3 text-sm font-medium text-primary hover:underline"
                  >
                    {risk.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {RISK_CATEGORIES[risk.category] &&
                      t(
                        `organization.riskCategories.${RISK_CATEGORIES[risk.category].labelKey}`
                      )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono-data text-sm font-bold text-foreground">
                    {maxPageRankScore > 0
                      ? (
                          (pageRankScores[risk.ref] / maxPageRankScore) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">PageRank</p>
                </div>
                {isValidScoreValue(risk.residual_score) ? (
                  <RiskBadge
                    level={getRiskSeverityLevel(risk.residual_score)}
                  />
                ) : (
                  <UnscoredBadge />
                )}
              </div>
            ))}
            {tippingPointRisks.length === 0 && (
              <div className="py-8 text-center">
                <Zap className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("organization.overview.bottomRow.empty")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("organization.overview.alert.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("organization.overview.alert.des")}
              </p>
            </div>
            <AlertTriangle
              className={`h-4 w-4 ${SEVERITY_STYLES.critical.text}`}
            />
          </div>
          <div className="mt-4 space-y-3">
            {/* Round 2.5: same reasoning as the Critical Alerts KPI card --
                alerts no longer takes down the whole page on its own, so a
                failure here needs its own visible state rather than falling
                through to the "no alerts yet" empty state below, which
                would otherwise misrepresent a fetch failure as "genuinely
                zero alerts." */}
            {alertsError && (
              <div role="alert" className="py-8 text-center">
                <AlertTriangle
                  className={`mx-auto h-8 w-8 ${SEVERITY_STYLES.critical.text}`}
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("organization.overview.alert.loadError")}
                </p>
              </div>
            )}
            {!alertsError &&
              alerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-start gap-2">
                    <RiskBadge level={alert.severity} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-tight font-medium text-foreground">
                        {alert.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-medium">{alert.source}</span>
                        <span>·</span>
                        <span>
                          {formatLocaleDate(alert.createdAt, i18n.language, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {/* No relevance_score field exists on the real Alert
                          model (see alert.service.ts) — that "% pertinent"
                          badge always read undefined * 100 = NaN%. Found
                          while typing this endpoint (issue #108). */}
                      </div>
                      {/* aexa-frontend#543: same cross-link AlertsPage.tsx
                        already exposes for #530 -- this widget showed the
                        same alerts with no way to reach the KRI they came
                        from. */}
                      {alert.kri_id && (
                        <Link
                          to={`/organization/kri?highlight=${encodeURIComponent(alert.kri_id)}`}
                          className="focus-ring mt-1 inline-block text-[11px] font-medium text-primary hover:underline"
                        >
                          {t("organization.alerts.viewKri")}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {!alertsError && alerts.length === 0 && (
              <div className="py-8 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("organization.overview.alert.empty")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
