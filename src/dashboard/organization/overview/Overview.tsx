/* eslint-disable @typescript-eslint/no-explicit-any */
import CriticalAlertBanner from "@/components/dashboard/organization/CriticalAlertBanner"
import MetricCard from "@/components/dashboard/organization/MetricCard"
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import { riskCategories } from "@/data/mockData"
import { useGetAllAlertsQuery } from "@/redux/apis/organization/alert.api"
import { useGetAllFindingsQuery } from "@/redux/apis/organization/findings.api"
import { useGetAllInspectionQuery } from "@/redux/apis/organization/inspection.api"
import { useGetAllKriQuery } from "@/redux/apis/organization/kri.api"
import { useGetCorrelationMatrixDataQuery } from "@/redux/apis/organization/riskLink.api"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import type { Alert, Risk } from "@/types/organization"
import {
  buildRiskCorrelationEdges,
  computePageRank,
  topPercentileByPageRank,
} from "@/utils/pageRank"
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  ListChecks,
  Loader2,
  Shield,
  TrendingDown,
  Zap,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Area,
  AreaChart,
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
  const { t } = useTranslation()
  const { data: riskResponse, isLoading: risksLoading } = useGetAllRisksQuery(
    {
      page: 1,
      limit: 100,
      searchTerm: "",
      siteId: "",
      category: "",
    }
  )
  const { data: kriResponse, isLoading: krisLoading } =
    useGetAllKriQuery(undefined)
  const { data: alertResponse, isLoading: alertsLoading } =
    useGetAllAlertsQuery(undefined)
  // Same limit:100-and-count-client-side approach as the risks query above
  // — getAllFindings/getAllInspection have no status-only "give me the
  // count" endpoint, and #25 didn't ask for a new backend aggregation route.
  const { data: findingResponse, isLoading: findingsLoading } =
    useGetAllFindingsQuery({
      page: 1,
      limit: 100,
      searchTerm: "",
      siteId: "",
    })
  const { data: inspectionResponse, isLoading: inspectionsLoading } =
    useGetAllInspectionQuery({
      page: 1,
      limit: 100,
      searchTerm: "",
      status: "",
      siteId: "",
    })
  // Reuses the same endpoint the Correlation Matrix page (#142) calls — just
  // for its riskLinks here, to compute real PageRank over the risk-causality
  // graph for the Tipping Points section below (#25).
  const { data: correlationMatrixResponse, isLoading: correlationLoading } =
    useGetCorrelationMatrixDataQuery()

  const risks: Risk[] = riskResponse?.data ?? []
  const kris = kriResponse?.data ?? []
  const alerts: Alert[] = alertResponse?.data ?? []
  const findings = findingResponse?.data ?? []
  const inspections = inspectionResponse?.data ?? []

  const categoryData = Object.entries(
    risks.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
  ).map(([key, value]) => ({
    name: riskCategories[key]
      ? t(`organization.riskCategories.${riskCategories[key].labelKey}`)
      : key,
    value,
    color: riskCategories[key]?.color || "#888",
  }))

  const kriAlerts = kris.filter((k: any) => k.status === "ALERT").length
  const criticalAlerts = alerts.filter(
    (a) => a.severity === "critical"
  ).length
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
  const allRisksForCorrelation = correlationMatrixResponse?.data?.risks ?? []
  const riskLinks = correlationMatrixResponse?.data?.riskLinks ?? []
  const riskRefs = allRisksForCorrelation.map((r) => r.ref)
  const correlationEdges = buildRiskCorrelationEdges(riskLinks)
  const pageRankScores = computePageRank(riskRefs, correlationEdges)
  const maxPageRankScore = Math.max(0, ...Object.values(pageRankScores))
  const tippingPointRefs = new Set(
    topPercentileByPageRank(riskRefs, correlationEdges, 0.15)
  )
  const tippingPointRisks = allRisksForCorrelation
    .filter((r) => tippingPointRefs.has(r.ref))
    .sort((a, b) => pageRankScores[b.ref] - pageRankScores[a.ref])

  if (
    risksLoading ||
    krisLoading ||
    alertsLoading ||
    findingsLoading ||
    inspectionsLoading ||
    correlationLoading
  ) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <CriticalAlertBanner />
      {/* Title */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("organization.overview.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("organization.overview.description")}
        </p>
      </div>

      {/* Metrics */}
      <div className="animate-slide-up grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t("organization.overview.activeRisk")}
          value={risks.filter((r) => r.status === "open").length}
          icon={Shield}
          trend="up"
          trendValue="+2"
          trendGood={false}
        />
        <MetricCard
          title={t("organization.overview.kriAlert")}
          value={kriAlerts}
          icon={Activity}
          trend="up"
          trendValue="+3"
          trendGood={false}
        />
        <MetricCard
          title={t("organization.overview.criticalAlert")}
          value={criticalAlerts}
          icon={AlertTriangle}
          trend="up"
          trendValue="+2"
          trendGood={false}
        />
        {/* No trend/trendValue on these two: unlike the cards above, there's
            no prior-period snapshot anywhere to diff against, so there's no
            real number to show here (the deltas on the other cards are
            themselves static placeholders, not something to copy). */}
        <MetricCard
          title={t("organization.overview.openActions")}
          value={openActions}
          icon={ListChecks}
        />
        <MetricCard
          title={t("organization.overview.activeInspections")}
          value={activeInspections}
          icon={ClipboardList}
        />
        <MetricCard
          title={t("organization.overview.revenue")}
          value="€8.6M"
          icon={TrendingDown}
          trend="down"
          trendValue="-12%"
          trendGood={false}
        />
      </div>

      {/* Charts row */}
      <div className="animate-slide-up stagger-2 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-2 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">
            {t("organization.overview.chart.title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("organization.overview.chart.des")}
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ebitdaData}>
                <defs>
                  <linearGradient id="ebitdaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(168, 60%, 36%)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(168, 60%, 36%)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(220, 10%, 46%)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(220, 10%, 46%)"
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}M`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(222, 22%, 11%)",
                    border: "1px solid hsl(220, 18%, 18%)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(220, 14%, 70%)" }}
                  // formatter={(v: number) => [
                  //   `€${(v / 1000).toFixed(1)}M`,
                  //   "EBITDA",
                  // ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(168, 60%, 36%)"
                  fill="url(#ebitdaGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-6 text-xs">
            <div>
              <span className="text-muted-foreground">
                {t("organization.overview.chart.p5Worst")}:
              </span>{" "}
              <span className="font-mono-data font-semibold text-risk-critical">
                €14.2M
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {t("organization.overview.chart.p5Median")}:
              </span>{" "}
              <span className="font-mono-data font-semibold text-foreground">
                €20.8M
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {t("organization.overview.chart.budget")}:
              </span>{" "}
              <span className="font-mono-data font-semibold text-risk-low">
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
            {risks.length} {t("organization.overview.category.des")}
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
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(222, 22%, 11%)",
                    border: "1px solid hsl(220, 18%, 18%)",
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
                <div className="font-mono-data flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold">
                  {risk.ref}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {risk.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {riskCategories[risk.category] &&
                      t(
                        `organization.riskCategories.${riskCategories[risk.category].labelKey}`
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
                  <p className="text-[10px] text-muted-foreground">
                    PageRank
                  </p>
                </div>
                <RiskBadge
                  level={
                    risk.residual_score > 12
                      ? "critical"
                      : risk.residual_score > 8
                        ? "high"
                        : "medium"
                  }
                />
              </div>
            ))}
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
            <AlertTriangle className="h-4 w-4 text-risk-critical" />
          </div>
          <div className="mt-4 space-y-3">
            {alerts.slice(0, 4).map((alert) => (
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
                        {new Date(alert.createdAt).toLocaleDateString(
                          "fr-FR",
                          {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                      {/* No relevance_score field exists on the real Alert
                          model (see alert.service.ts) — that "% pertinent"
                          badge always read undefined * 100 = NaN%. Found
                          while typing this endpoint (issue #108). */}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
