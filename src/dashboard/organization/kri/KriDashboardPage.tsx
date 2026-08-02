/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useCreateNewKriMutation,
  useGetAllKriQuery,
  useGetKriReadingsQuery,
  useSubmitKriValueMutation,
} from "@/redux/apis/organization/kri.api"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import { formatLocaleDate } from "@/utils/formatDate"
import {
  AlertTriangle,
  ChartLine,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Save,
  TrendingUp,
  X,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

const EMPTY_KRI = {
  name: "",
  risk_id: "",
  unit: "",
  current_value: 0,
  target_value: 0,
  alert_threshold: 0,
  frequency: "monthly",
}

export default function KriDashboardPage() {
  const { t, i18n } = useTranslation()
  // aexa-frontend#217
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)
  const {
    data: kriResponse,
    isLoading: krisLoading,
    error: krisError,
  } = useGetAllKriQuery(undefined)
  const { data: riskResponse } = useGetAllRisksQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    category: "",
  })
  const [createKri] = useCreateNewKriMutation()
  const [submitKriValue] = useSubmitKriValueMutation()

  const kris = kriResponse?.data ?? []
  const risks = riskResponse?.data ?? []

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_KRI)
  const [isSaving, setIsSaving] = useState(false)

  const [updatingKriId, setUpdatingKriId] = useState<string | null>(null)
  const [updateValue, setUpdateValue] = useState("")
  const [isUpdatingValue, setIsUpdatingValue] = useState(false)

  // aexa-server#242 / aexa-frontend#211 — GET /kri/:id/readings existed with
  // no frontend consumer at all; this is the trend view. Only fetched while
  // the modal is actually open for a given KRI (skip otherwise).
  const [trendKriId, setTrendKriId] = useState<string | null>(null)
  const { data: readingsResponse, isLoading: isLoadingReadings } =
    useGetKriReadingsQuery(
      { id: trendKriId ?? "", page: 1, limit: 50 },
      { skip: !trendKriId }
    )

  const handleSave = async () => {
    if (!form.name || !form.risk_id) return
    if (form.target_value === form.alert_threshold) {
      toast.error(t("organization.kri.toast.thresholdMustDiffer"))
      return
    }

    setIsSaving(true)
    try {
      await createKri({
        risk_id: form.risk_id,
        name: form.name,
        unit: form.unit,
        current_value: form.current_value,
        alert_threshold: form.alert_threshold,
        target_value: form.target_value,
        frequency: form.frequency,
      }).unwrap()
      toast.success(t("organization.kri.toast.created"))
      setShowForm(false)
      setForm(EMPTY_KRI)
    } catch (err: any) {
      toast.error(err?.data?.message || t("organization.kri.toast.createFailed"))
    } finally {
      setIsSaving(false)
    }
  }

  const openUpdateValue = (kri: any) => {
    setUpdatingKriId(kri.id)
    setUpdateValue(String(kri.current_value))
  }

  const handleUpdateValue = async () => {
    if (!updatingKriId) return
    // Number("") === 0, not NaN — an emptied field would otherwise silently
    // submit 0 as if it were a real reading instead of being rejected.
    // Found by independent review.
    if (updateValue.trim() === "") {
      toast.error(t("organization.kri.toast.enterValidNumber"))
      return
    }
    const value = Number(updateValue)
    if (Number.isNaN(value)) {
      toast.error(t("organization.kri.toast.enterValidNumber"))
      return
    }

    setIsUpdatingValue(true)
    try {
      await submitKriValue({
        id: updatingKriId,
        current_value: value,
      }).unwrap()
      toast.success(t("organization.kri.toast.valueUpdated"))
      setUpdatingKriId(null)
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.kri.toast.updateFailed")
      )
    } finally {
      setIsUpdatingValue(false)
    }
  }

  const trendKri = trendKriId ? kris.find((k: any) => k.id === trendKriId) : null
  // Backend returns newest-first (see kri.api.ts's own comment); a
  // left-to-right chronological chart needs the reverse.
  const trendChartData = (readingsResponse?.data ?? [])
    .slice()
    .reverse()
    .map((r: { value: number; recorded_at: string }) => ({
      value: r.value,
      recorded_at: formatLocaleDate(r.recorded_at, i18n.language, {
        month: "short",
        day: "numeric",
      }),
    }))

  const alertCount = kris.filter((k: any) => k.status === "ALERT").length
  const warningCount = kris.filter((k: any) => k.status === "WARNING").length
  const okCount = kris.filter((k: any) => k.status === "OK").length

  if (krisLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (krisError) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          {t("organization.kri.loadError")}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="animate-fade-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">
            {t("organization.kri.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.kri.description")}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => {
              setForm(EMPTY_KRI)
              setShowForm(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> {t("organization.kri.newKri")}
          </button>
        )}
      </div>

      {/* Status Summary Cards */}
      <div className="animate-slide-up flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-risk-critical/30 bg-risk-critical/5 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-risk-critical" />
          <span className="font-mono-data text-lg font-bold text-risk-critical">
            {alertCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("organization.kri.status.alert")}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-risk-medium/30 bg-risk-medium/5 px-3 py-2">
          <TrendingUp className="h-4 w-4 text-risk-medium" />
          <span className="font-mono-data text-lg font-bold text-risk-medium">
            {warningCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("organization.kri.status.warning")}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-risk-low/30 bg-risk-low/5 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-risk-low" />
          <span className="font-mono-data text-lg font-bold text-risk-low">
            {okCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("organization.kri.status.ok")}
          </span>
        </div>
      </div>

      {/* KRI Cards */}
      <div className="animate-slide-up stagger-2 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kris.map((kri: any) => {
          const statusColor =
            kri.status === "ALERT"
              ? "border-risk-critical/40"
              : kri.status === "WARNING"
                ? "border-risk-medium/40"
                : "border-risk-low/40"

          const risk = risks.find((r: any) => r.id === kri.risk_id)

          return (
            <div
              key={kri.id}
              className={`rounded-xl border-2 ${statusColor} bg-card p-4 lg:p-5`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {kri.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {risk?.name ?? t("organization.kri.unknownRisk")}
                    {kri.frequency
                      ? ` · ${t(`organization.kri.frequency.${kri.frequency}`, { defaultValue: kri.frequency })}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    kri.status === "ALERT"
                      ? "bg-risk-critical/15 text-risk-critical"
                      : kri.status === "WARNING"
                        ? "bg-risk-medium/15 text-risk-medium"
                        : "bg-risk-low/15 text-risk-low"
                  }`}
                >
                  {kri.status === "ALERT"
                    ? t("organization.kri.status.alert")
                    : kri.status === "WARNING"
                      ? t("organization.kri.status.warning")
                      : t("organization.kri.status.ok")}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono-data text-2xl font-bold text-foreground lg:text-3xl">
                  {Number(kri.current_value)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {kri.unit}
                </span>
                <button
                  onClick={() => setTrendKriId(kri.id)}
                  className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={t("organization.kri.trend.viewTooltip")}
                >
                  <ChartLine className="h-3.5 w-3.5" />
                </button>
                {canWrite && (
                  <button
                    onClick={() => openUpdateValue(kri)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={t("organization.kri.updateValueTooltip")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-1 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span>
                  {t("organization.kri.thresholdLabel")}{" "}
                  <span className="font-mono-data font-medium text-risk-critical">
                    {Number(kri.alert_threshold)}
                  </span>
                </span>
                <span>
                  {t("organization.kri.targetLabel")}{" "}
                  <span className="font-mono-data font-medium text-risk-low">
                    {Number(kri.target_value)}
                  </span>
                </span>
                {/* aexa-server#242 — overdue is computed server-side from
                    frequency + last_measured_at; always false with no
                    frequency, so this never shows on a KRI with no cadence. */}
                {kri.overdue && (
                  <span className="ml-auto flex items-center gap-1 font-medium text-risk-critical">
                    <Clock className="h-3 w-3" />
                    {t("organization.kri.overdueLabel")}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {kris.length === 0 && (
          <div className="col-span-full rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {t("organization.kri.noKris")}
            </p>
          </div>
        )}
      </div>

      {/* Update Value Modal */}
      {updatingKriId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setUpdatingKriId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {t("organization.kri.updateValueTitle")}
              </h2>
              <button
                onClick={() => setUpdatingKriId(null)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="number"
              value={updateValue}
              onChange={(e) => setUpdateValue(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setUpdatingKriId(null)}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("organization.kri.cancel")}
              </button>
              <button
                onClick={handleUpdateValue}
                disabled={isUpdatingValue}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isUpdatingValue ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("organization.kri.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New KRI Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {t("organization.kri.newKri")}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.kri.form.name")} *
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder={t("organization.kri.form.namePlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.kri.form.risk")} *
                  </label>
                  <select
                    value={form.risk_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, risk_id: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">
                      {t("organization.kri.form.selectRisk")}
                    </option>
                    {risks.map((r: any) => (
                      <option key={r.id} value={r.id} title={r.name}>
                        {r.name.length > 30
                          ? `${r.name.slice(0, 30)}...`
                          : r.name}
                      </option>
                    ))}
                  </select>
                  {/* option-element title tooltips don't reliably render
                      everywhere (same constraint the ReportsPage "Coming
                      soon" fix documents), so the full name of a truncated
                      selection is also always visible here, not just on
                      hover. */}
                  {(() => {
                    const selected = risks.find(
                      (r: any) => r.id === form.risk_id
                    )
                    return selected && selected.name.length > 30 ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {selected.name}
                      </p>
                    ) : null
                  })()}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.kri.form.unit")}
                  </label>
                  <input
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    placeholder={t("organization.kri.form.unitPlaceholder")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.kri.form.currentValue")}
                  </label>
                  <input
                    type="number"
                    value={form.current_value}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        current_value: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.kri.form.alertThreshold")}
                  </label>
                  <input
                    type="number"
                    value={form.alert_threshold}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        alert_threshold: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.kri.form.target")}
                  </label>
                  <input
                    type="number"
                    value={form.target_value}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        target_value: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.kri.form.frequency")}
                </label>
                <select
                  value={form.frequency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, frequency: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="daily">
                    {t("organization.kri.frequency.daily")}
                  </option>
                  <option value="weekly">
                    {t("organization.kri.frequency.weekly")}
                  </option>
                  <option value="monthly">
                    {t("organization.kri.frequency.monthly")}
                  </option>
                  <option value="quarterly">
                    {t("organization.kri.frequency.quarterly")}
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("organization.kri.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.name || !form.risk_id}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("organization.kri.createKri")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trend modal (aexa-server#242 / aexa-frontend#211) */}
      {trendKriId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setTrendKriId(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {t("organization.kri.trend.modalTitle", {
                  name: trendKri?.name ?? "",
                })}
              </h2>
              <button
                onClick={() => setTrendKriId(null)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingReadings && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoadingReadings && trendChartData.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("organization.kri.trend.empty")}
              </p>
            )}

            {!isLoadingReadings && trendChartData.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData}>
                    <XAxis
                      dataKey="recorded_at"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(220, 10%, 46%)"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(220, 10%, 46%)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(222, 22%, 11%)",
                        border: "1px solid hsl(220, 18%, 18%)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "hsl(220, 14%, 70%)" }}
                    />
                    {trendKri && (
                      <ReferenceLine
                        y={Number(trendKri.alert_threshold)}
                        stroke="hsl(0, 72%, 51%)"
                        strokeDasharray="4 4"
                        label={{
                          value: t("organization.kri.thresholdLabel"),
                          fontSize: 10,
                          fill: "hsl(0, 72%, 51%)",
                        }}
                      />
                    )}
                    {trendKri && (
                      <ReferenceLine
                        y={Number(trendKri.target_value)}
                        stroke="hsl(142, 71%, 45%)"
                        strokeDasharray="4 4"
                        label={{
                          value: t("organization.kri.targetLabel"),
                          fontSize: 10,
                          fill: "hsl(142, 71%, 45%)",
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(168, 60%, 36%)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
