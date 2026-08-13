import {
  Activity,
  Building2,
  DollarSign,
  File,
  Settings,
  Users,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatLocaleDate } from "@/utils/formatDate"
import { severityBadgeClasses } from "@/utils/severityStyles"
import CustomTooltip from "./CustomTooltip"

const AdminOverview = () => {
  const { t, i18n } = useTranslation()
  // Dummy Stats
  // Icon tile: tinted bg-primary/10 + text-primary, same convention as
  // MetricCard.tsx -- these used to be solid-fill bg-*-600 tiles with
  // text-white icons, an off-brand "generic admin template" look next to
  // the rest of the app's tinted-tile icon language.
  const stats = [
    {
      icon: <DollarSign className="h-5 w-5 text-primary" />,
      label: t("admin.overview.stats.totalRevenue"),
      value: "$124,890",
      change: "+12.5",
      changeLabel: t("admin.overview.stats.fromLastMonth"),
    },
    {
      icon: <Users className="h-5 w-5 text-primary" />,
      label: t("admin.overview.stats.totalUsers"),
      value: "8,472",
      change: "+8.2",
      changeLabel: t("admin.overview.stats.fromLastMonth"),
    },
    {
      icon: <Building2 className="h-5 w-5 text-primary" />,
      label: t("admin.overview.stats.activeOrganizations"),
      value: "243",
      change: "+5.1",
      changeLabel: t("admin.overview.stats.fromLastMonth"),
    },
    {
      icon: <Activity className="h-5 w-5 text-primary" />,
      label: t("admin.overview.stats.activeSubscriptions"),
      value: "1,892",
      change: "+14.3",
      changeLabel: t("admin.overview.stats.fromLastMonth"),
    },
  ]

  // Dummy Revenue Chart Data
  const chartData = [
    { name: "Jan", total: 12400 },
    { name: "Feb", total: 15800 },
    { name: "Mar", total: 13200 },
    { name: "Apr", total: 18900 },
    { name: "May", total: 22100 },
    { name: "Jun", total: 19800 },
    { name: "Jul", total: 24500 },
    { name: "Aug", total: 26700 },
    { name: "Sep", total: 23900 },
    { name: "Oct", total: 28400 },
    { name: "Nov", total: 31200 },
    { name: "Dec", total: 29800 },
  ]

  const totalRevenue = chartData.reduce((sum, item) => sum + item.total, 0)

  // Recent Payments Dummy Data
  const recentPayments = [
    {
      _id: "PAY-001",
      organizationId: "TechVision Solutions",
      planName: "Enterprise",
      planType: "Yearly",
      amount: 2999,
      status: "Completed",
      createdAt: "2025-12-15",
    },
    {
      _id: "PAY-002",
      organizationId: "GreenField Academy",
      planName: "Premium",
      planType: "Monthly",
      amount: 149,
      status: "Completed",
      createdAt: "2025-12-14",
    },
    {
      _id: "PAY-003",
      organizationId: "Nexus Dynamics",
      planName: "Business",
      planType: "Quarterly",
      amount: 899,
      status: "Pending",
      createdAt: "2025-12-13",
    },
    {
      _id: "PAY-004",
      organizationId: "Summit Healthcare",
      planName: "Enterprise",
      planType: "Yearly",
      amount: 2999,
      status: "Completed",
      createdAt: "2025-12-12",
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return severityBadgeClasses("low")
      case "Pending":
        return severityBadgeClasses("medium")
      case "Failed":
        return severityBadgeClasses("critical")
      default:
        return severityBadgeClasses("neutral")
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "Completed":
        return t("admin.overview.status.completed")
      case "Pending":
        return t("admin.overview.status.pending")
      case "Failed":
        return t("admin.overview.status.failed")
      default:
        return status
    }
  }

  const formatAmount = (amount: number) => `$${amount.toLocaleString()}`

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="mx-auto w-full p-4 sm:p-6">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {t("admin.overview.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("admin.overview.subtitle")}
            </p>
          </div>
        </div>

        {/* Not-connected-to-backend disclosure. The stats, revenue chart, and
            recent-payments table below are all hardcoded fixtures (no
            src/redux/apis/admin/* endpoint backs this page yet) -- this
            banner discloses that honestly instead of presenting them as
            real platform data, matching the convention established in
            PricingPlans.tsx. */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-400">
          {t("admin.overview.notConnectedNotice")}
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-card p-6 transition-all hover:shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  {stat.icon}
                </div>
              </div>

              <div className="font-mono-data mb-1 text-3xl font-semibold text-foreground">
                {stat.value}
              </div>

              <div className="text-sm">
                <span className="font-medium text-emerald-600 dark:text-emerald-500">
                  {stat.change}%
                </span>{" "}
                <span className="text-muted-foreground">
                  {stat.changeLabel}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Revenue Growth Chart */}
          <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  {t("admin.overview.revenueGrowth")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("admin.overview.revenueSubtitle")}
                </p>
              </div>
              {/* Disabled rather than wired up: chartData above is a static
                  12-month fixture (see the disclosure banner), so there is
                  no real per-period dataset to filter it against yet.
                  Presenting a working-looking select that silently does
                  nothing would be worse than disabling it with an explicit
                  explanation. Re-enable once the chart is backed by a real
                  admin revenue endpoint that can return 6/12-month and
                  30-day slices. */}
              <select
                aria-label={t("admin.overview.periodSelectorLabel")}
                title={t("admin.overview.periodSelectorDisabledHint")}
                disabled
                defaultValue="12m"
                className="rounded-xl border border-input bg-background px-4 py-2 text-sm opacity-60 focus:ring-2 focus:ring-primary focus:outline-none disabled:cursor-not-allowed"
              >
                <option value="12m">{t("admin.overview.last12Months")}</option>
                <option value="6m">{t("admin.overview.last6Months")}</option>
                <option value="30d">{t("admin.overview.last30Days")}</option>
              </select>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--risk-low))"
                        stopOpacity={0.85}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--risk-low))"
                        stopOpacity={0.08}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--risk-low))"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                    dot={{
                      stroke: "hsl(var(--risk-low))",
                      strokeWidth: 2,
                      r: 4,
                      fill: "hsl(var(--card))",
                    }}
                    activeDot={{ r: 7, fill: "hsl(var(--risk-low))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Actions + Total Revenue */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-5 text-lg font-semibold text-foreground">
                {t("admin.overview.quickActions")}
              </h3>
              <div className="space-y-3">
                <Link to="/admin/settings">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-border px-5 py-4 text-left transition-colors hover:bg-muted"
                  >
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {t("admin.overview.managePlans")}
                    </span>
                  </button>
                </Link>

                <Link to="/admin/transaction">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-border px-5 py-4 text-left transition-colors hover:bg-muted"
                  >
                    <File className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {t("admin.overview.viewTransactions")}
                    </span>
                  </button>
                </Link>
              </div>
            </div>

            {/* Total Revenue Card */}
            <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/90 p-6 text-primary-foreground">
              <div className="text-sm opacity-90">{t("admin.overview.totalRevenueCard")}</div>
              <div className="mt-2 text-4xl font-bold">
                ${totalRevenue.toLocaleString()}
              </div>
              <div className="mt-1 text-sm opacity-75">
                {t("admin.overview.acrossMonths", { count: chartData.length })}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-muted/50 px-6 py-5">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {t("admin.overview.recentPayments")}
            </h2>
            <Link to="/admin/transaction">
              <button
                type="button"
                className="rounded-xl border border-border bg-background px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {t("admin.overview.viewAll")}
              </button>
            </Link>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                    {t("admin.overview.colOrganization")}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                    {t("admin.overview.colPlan")}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                    {t("admin.overview.colType")}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                    {t("admin.overview.colAmount")}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                    {t("admin.overview.colStatus")}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                    {t("admin.overview.colDate")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentPayments.map((payment) => (
                  <tr
                    key={payment._id}
                    className="transition-colors hover:bg-muted/50"
                  >
                    <td className="px-6 py-5 font-medium text-foreground">
                      {payment.organizationId}
                    </td>
                    <td className="px-6 py-5 text-muted-foreground">
                      {payment.planName}
                    </td>
                    <td className="px-6 py-5 text-muted-foreground">
                      {payment.planType}
                    </td>
                    <td className="font-mono-data px-6 py-5 font-medium text-foreground">
                      {formatAmount(payment.amount)}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(payment.status)}`}
                      >
                        {getStatusLabel(payment.status)}
                      </span>
                    </td>
                    <td className="font-mono-data px-6 py-5 text-sm text-muted-foreground">
                      {formatLocaleDate(payment.createdAt, i18n.language, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="divide-y divide-border lg:hidden">
            {recentPayments.map((payment) => (
              <div key={payment._id} className="p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="font-medium text-foreground">
                      {payment.organizationId}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ID: {payment._id}
                    </div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(payment.status)}`}
                  >
                    {getStatusLabel(payment.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("admin.overview.colPlan")}</p>
                    <p className="font-medium text-foreground">
                      {payment.planName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("admin.overview.colAmount")}</p>
                    <p className="font-semibold text-foreground">
                      {formatAmount(payment.amount)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {formatLocaleDate(payment.createdAt, i18n.language, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                  >
                    {t("admin.overview.viewDetails")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminOverview
