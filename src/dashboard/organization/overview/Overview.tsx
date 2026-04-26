import CriticalAlertBanner from "@/components/dashboard/organization/CriticalAlertBanner"
import MetricCard from "@/components/dashboard/organization/MetricCard"
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import {
  mockAlerts,
  mockKRIs,
  mockRisks,
  riskCategories,
} from "@/data/mockData"
import {
  Activity,
  AlertTriangle,
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

const ebitdaData = [
  { name: "P5", value: 14200 },
  { name: "P10", value: 16100 },
  { name: "P25", value: 18500 },
  { name: "P50", value: 20800 },
  { name: "P75", value: 22400 },
  { name: "P90", value: 23100 },
  { name: "P95", value: 23800 },
]

const categoryData = Object.entries(
  mockRisks.reduce(
    (acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
).map(([key, value]) => ({
  name: riskCategories[key]?.label || key,
  value,
  color: riskCategories[key]?.color || "#888",
}))

const kriAlerts = mockKRIs.filter((k) => k.status === "alert").length
const criticalAlerts = mockAlerts.filter(
  (a) => a.severity === "critical"
).length

export default function Overview() {
  const { t } = useTranslation()
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
          value={mockRisks.filter((r) => r.status === "open").length}
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
              <span className="font-mono-data text-risk-critical font-semibold">
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
              <span className="font-mono-data text-risk-low font-semibold">
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
            {mockRisks.length} {t("organization.overview.category.des")}
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
            {mockRisks
              .filter((r) => r.is_tipping_point)
              .map((risk) => (
                <div
                  key={risk.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                >
                  <div
                    className="font-mono-data flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold"
                    style={{
                      backgroundColor: risk.color_hex + "20",
                      color: risk.color_hex,
                    }}
                  >
                    {risk.ref}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {risk.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {riskCategories[risk.category]?.label}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-data text-sm font-bold text-foreground">
                      {risk.pagerank_score.toFixed(1)}
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
            <AlertTriangle className="text-risk-critical h-4 w-4" />
          </div>
          <div className="mt-4 space-y-3">
            {mockAlerts.slice(0, 4).map((alert) => (
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
                        {new Date(alert.created_at).toLocaleDateString(
                          "fr-FR",
                          {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                      <span>·</span>
                      <span className="font-mono-data">
                        {(alert.relevance_score * 100).toFixed(0)}% pertinent
                      </span>
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
